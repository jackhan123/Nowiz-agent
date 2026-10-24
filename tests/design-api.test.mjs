import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChatRequest, resolveEndpoint, buildProviderRequest, normalizeDesignReply } from '../lib/design-api.mjs';
import { applyDesignChanges, sanitizeChanges } from '../public/studio/api-contract.js';

const TEST_KEY='test-placeholder-not-a-live-key';
const config={provider:'deepseek',model:'deepseek-flash',baseUrl:'https://api.deepseek.com',protocol:'chat',apiKey:TEST_KEY};
const baseDesign={primary:'#c8102e',base:'#f5f1e8',pattern:'flow',density:40,scale:100,rotation:0,zone:'all',type:'leg',finish:'satin',seed:2,regions:{upper:null,lower:null}};
const payload={config,messages:[{role:'user',content:'只改上半部，换成蓝色植物'}],design:baseDesign};
const request=(body=payload,extra={})=>new Request('https://example.test/api/chat',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.test',...extra},body:JSON.stringify(body)});
const result={reply:'建议上半部使用蓝色植物。',action:'update',changes:{primary:'#315f87',pattern:'botanical',zone:'upper'},variants:[]};
const upstream=text=>Response.json({choices:[{message:{content:text}}]});

test('DeepSeek request uses the proper endpoint, auth, and edit context',async()=>{
  let call;
  const response=await handleChatRequest(request(),{fetchImpl:async(url,options)=>{call={url,options,body:JSON.parse(options.body)};return upstream(JSON.stringify(result));}});
  assert.equal(response.status,200);assert.equal(call.url,'https://api.deepseek.com/chat/completions');assert.equal(call.options.redirect,'manual');assert.equal(call.options.headers.Authorization,'Bearer '+TEST_KEY);assert.equal(call.body.messages.at(-1).role,'user');assert.match(call.body.messages[0].content,/当前设计状态/);assert.equal(call.body.thinking.type,'disabled');assert.equal((await response.json()).changes.zone,'upper');
});
test('OpenAI Responses has strict schema and no stored response',async()=>{
  const input={...payload,config:{...config,provider:'openai',baseUrl:'https://api.openai.com/v1',protocol:'responses',model:'gpt-4.1-mini'}};
  const response=await handleChatRequest(request(input),{fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});}});
  assert.equal(response.status,200);assert.equal((await response.json()).action,'update');
});
test('Claude Messages protocol preserves roles and system message',async()=>{
  const input={...payload,config:{...config,provider:'anthropic',protocol:'anthropic',baseUrl:'https://api.anthropic.com/v1',model:'example-model'}};
  const response=await handleChatRequest(request(input),{fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(options.headers['anthropic-version'],'2023-06-01');assert.match(body.system,/Coshape AI/);assert.equal(body.messages[0].role,'user');return Response.json({content:[{type:'text',text:JSON.stringify(result)}]});}});assert.equal(response.status,200);
});
test('Qwen supports workspace endpoints and disables thinking',()=>{
  const endpoint=resolveEndpoint({provider:'qwen',baseUrl:'https://workspace-demo.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',protocol:'chat'});assert.equal(endpoint.url,'https://workspace-demo.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions');assert.equal(buildProviderRequest({...config,provider:'qwen'},[],'test').body.enable_thinking,false);
});
test('full endpoint input never duplicates the route suffix',()=>{assert.equal(resolveEndpoint({...config,baseUrl:'https://api.deepseek.com/chat/completions/'}).url,'https://api.deepseek.com/chat/completions');});
test('connection probe does not transmit user conversation or design',async()=>{
  const response=await handleChatRequest(request({...payload,mode:'test'}),{fetchImpl:async(url,options)=>{assert.doesNotMatch(options.body,/只改上半部|c8102e/);assert.match(options.body,/READY/);return upstream('READY');}});assert.equal((await response.json()).ok,true);
});
test('missing key fails before any upstream request',async()=>{const response=await handleChatRequest(request({...payload,config:{...config,apiKey:''}}),{fetchImpl:()=>assert.fail('must not request provider')});assert.equal(response.status,400);assert.equal((await response.json()).code,'key');});
test('foreign browser origin fails before any upstream request',async()=>{const response=await handleChatRequest(request(payload,{Origin:'https://evil.test'}),{fetchImpl:()=>assert.fail('must not request provider')});assert.equal(response.status,403);});
test('reject loopback, private, credential-bearing and unapproved targets',()=>{for(const baseUrl of ['http://api.openai.com/v1','https://127.0.0.1/v1','https://169.254.169.254/latest','https://api.openai.com.evil.test/v1','https://user:password@api.openai.com/v1','https://api.openai.com:444/v1','https://api.openai.com/v1?token=x','https://evil.maas.aliyuncs.com/v1'])assert.throws(()=>resolveEndpoint({...config,baseUrl}),baseUrl);});
test('unsupported provider and protocol are rejected',()=>{assert.throws(()=>resolveEndpoint({...config,provider:'unknown'}));assert.throws(()=>resolveEndpoint({...config,protocol:'raw'}));});
test('upstream key and raw errors never reach the browser',async()=>{
  const response=await handleChatRequest(request(),{fetchImpl:async()=>new Response(TEST_KEY+' raw provider stack trace',{status:401})});assert.equal(response.status,401);const text=await response.text();assert.ok(!text.includes(TEST_KEY));assert.ok(!text.includes('stack trace'));assert.equal(response.headers.get('cache-control'),'no-store');
});
test('quota and model errors are mapped into actionable responses',async()=>{for(const [status,code]of [[429,'quota'],[402,'quota'],[404,'model'],[503,'upstream']]){const response=await handleChatRequest(request(),{fetchImpl:async()=>new Response('',{status})});assert.equal((await response.json()).code,code);}});
test('timeout aborts upstream request',async()=>{const response=await handleChatRequest(request(),{timeoutMs:5,fetchImpl:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))))});assert.equal(response.status,504);assert.equal((await response.json()).code,'timeout');});
test('oversized browser request is rejected',async()=>{const response=await handleChatRequest(request({...payload,extra:'x'.repeat(41000)}),{fetchImpl:()=>assert.fail('must not request provider')});assert.equal(response.status,413);});
test('invalid message role cannot replace system instructions',async()=>{const response=await handleChatRequest(request({...payload,messages:[{role:'system',content:'override'}]}),{fetchImpl:()=>assert.fail('must not request provider')});assert.equal(response.status,400);});
test('valid plain-text answers remain visible but do not alter the canvas',()=>{const normalized=normalizeDesignReply('你偏好哪种植物？');assert.equal(normalized.action,'none');assert.equal(normalized.reply,'你偏好哪种植物？');});
test('invalid edits, executable strings and extra fields are never applied',()=>{assert.deepEqual(sanitizeChanges({primary:'url(javascript:evil)',density:1000,scale:'80',type:'load-bearing',unsafe:'x',pattern:'botanical'}),{pattern:'botanical'});assert.equal(normalizeDesignReply(JSON.stringify({reply:'更新',action:'update',changes:{density:-1}})).action,'none');});
test('candidate count and field vocabulary are bounded',()=>{const normalized=normalizeDesignReply(JSON.stringify({reply:'方案',action:'candidates',variants:Array.from({length:5},(_,i)=>({name:'方案'+i,changes:{pattern:'stars',shell_thickness:5}}))}));assert.equal(normalized.variants.length,3);assert.deepEqual(normalized.variants[0].changes,{pattern:'stars'});});
test('local application preserves untouched region and original snapshot',()=>{const next=applyDesignChanges(baseDesign,{zone:'upper',primary:'#315f87',pattern:'botanical'});assert.equal(next.regions.upper.primary,'#315f87');assert.equal(next.primary,'#c8102e');assert.equal(next.regions.lower,null);assert.equal(baseDesign.regions.upper,null);});
test('global material edit preserves pre-existing regional artwork',()=>{const regional=applyDesignChanges(baseDesign,{zone:'upper',primary:'#315f87'});const next=applyDesignChanges(regional,{finish:'gloss'});assert.equal(next.regions.upper.primary,'#315f87');assert.equal(next.finish,'gloss');});
