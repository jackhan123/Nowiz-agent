import test from 'node:test';
import assert from 'node:assert/strict';
import { handleChatRequest } from '../lib/design-api.mjs';
import { handleImageRequest, validateImageUrl } from '../lib/image-api.mjs';
import { applyDesignChanges } from '../public/studio/api-contract.js';
const environment={COSHAPE_GATEWAY_API_KEY:'test-server-only-secret',COSHAPE_IMAGE_API_KEY:'test-image-only-secret',COSHAPE_CHAT_MODEL:'gpt-6.1-sol',COSHAPE_IMAGE_MODEL:'gpt-image-2.5'};
let serial=0;
const req=body=>new Request('https://example.test/api/image',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://example.test','cf-connecting-ip':'test-'+(++serial)},body:JSON.stringify(body)});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('hosted chat ignores browser supplied credentials, model and destination',async()=>{
  let call;const response=await handleChatRequest(req({mode:'test',config:{apiKey:'attacker-key',baseUrl:'https://bad.example',model:'wrong-model'}}),{environment,fetchImpl:async(url,options)=>{call={url,body:JSON.parse(options.body),headers:options.headers};return Response.json({choices:[{message:{content:'READY'}}]});}});
  assert.equal(response.status,200);assert.equal(call.url,'https://api.openai-next.com/v1/chat/completions');assert.equal(call.headers.Authorization,'Bearer '+environment.COSHAPE_GATEWAY_API_KEY);assert.equal(call.body.model,'gpt-6.1-sol');assert.ok(!JSON.stringify(await response.json()).includes(environment.COSHAPE_GATEWAY_API_KEY));
});
test('hosted chat cannot fall back to browser configuration when runtime secrets are missing',async()=>{
  const response=await handleChatRequest(req({mode:'test',config:{apiKey:'browser-key'}}),{environment:{},fetchImpl:()=>assert.fail('must not call upstream')});assert.equal(response.status,503);
});
test('image request uses server-only credentials, exact image model and returns image pixels',async()=>{
  let call;const response=await handleImageRequest(req({prompt:'米白色底，红色银杏叶',config:{apiKey:'browser-key',model:'wrong-model'}}),{environment,fetchImpl:async(url,options)=>{call={url,headers:options.headers,body:JSON.parse(options.body)};return Response.json({data:[{b64_json:png}]});}});
  const result=await response.json();assert.equal(response.status,200);assert.equal(call.url,'https://api.openai-next.com/v1/images/generations');assert.equal(call.body.model,'gpt-image-2.5');assert.equal(call.body.size,'1024x1024');assert.equal(call.headers.Authorization,'Bearer '+environment.COSHAPE_IMAGE_API_KEY);assert.match(result.image.dataUrl,/^data:image\/png;base64,/);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.ok(!JSON.stringify(result).includes(environment.COSHAPE_IMAGE_API_KEY));
});
test('image download rejects loopback, arbitrary hosts and credential-bearing URLs',()=>{
  for(const url of ['https://127.0.0.1/p.png','http://api.openai-next.com/p.png','https://evil.example/p.png','https://secret@api.openai-next.com/p.png'])assert.throws(()=>validateImageUrl(url));
  assert.equal(validateImageUrl('https://cdn.openai-next.com/p.png'),'https://cdn.openai-next.com/p.png');
});
test('downloaded images never receive the API key',async()=>{
  let count=0;const response=await handleImageRequest(req({prompt:'red leaves'}),{environment,fetchImpl:async(url,options)=>{count++;if(count===1)return Response.json({data:[{url:'https://cdn.openai-next.com/texture.png'}]});assert.equal(options.headers,undefined);return new Response(Buffer.from(png,'base64'));}});assert.equal(response.status,200);assert.equal(count,2);
});
test('upstream failure never reflects keys or triggers an automatic image retry',async()=>{
  let calls=0;const response=await handleImageRequest(req({prompt:'red leaves'}),{environment,fetchImpl:async()=>{calls++;return new Response(environment.COSHAPE_IMAGE_API_KEY,{status:500});}});assert.equal(response.status,502);assert.equal(calls,1);assert.ok(!(await response.text()).includes(environment.COSHAPE_IMAGE_API_KEY));
});
test('invalid image bytes are not accepted as a generated texture',async()=>{
  const response=await handleImageRequest(req({prompt:'red leaves'}),{environment,fetchImpl:async()=>Response.json({data:[{b64_json:Buffer.from('<script>bad</script>').toString('base64')}]})});assert.equal(response.status,502);
});
test('structural requests are blocked before spending image credits',async()=>{
  const response=await handleImageRequest(req({prompt:'修改接受腔尺寸'}),{environment,fetchImpl:()=>assert.fail('must not call upstream')});assert.equal(response.status,400);
});
test('preset selection exits generated-image mode while scale and finish preserve image identity',()=>{
  const d={pattern:'flow',scale:100,zone:'all',imageTexture:{id:'img-demo'},regions:{upper:null,lower:null}};assert.equal(applyDesignChanges(d,{scale:120,finish:'matte'}).imageTexture.id,'img-demo');assert.equal(applyDesignChanges(d,{pattern:'stars'}).imageTexture,undefined);
});
test('oversized image request is rejected before an upstream call',async()=>{
  const response=await handleImageRequest(req({prompt:'a'.repeat(25_000)}),{environment,fetchImpl:()=>assert.fail('must not call upstream')});assert.equal(response.status,413);
});
test('image service fails closed without configured credentials',async()=>{
  const response=await handleImageRequest(req({prompt:'red leaves'}),{environment:{},fetchImpl:()=>assert.fail('must not call upstream')});assert.equal(response.status,503);
});
test('hosted requests use edge-compatible manual redirects and never follow a redirect',async()=>{
  let calls=0;const response=await handleChatRequest(req({mode:'test'}),{environment,fetchImpl:async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://evil.example/steal'}});}});assert.equal(calls,1);assert.equal(response.status,400);
  const image=await handleImageRequest(req({prompt:'red leaves'}),{environment,fetchImpl:async(url,options)=>{assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://evil.example/steal'}});}});assert.equal(image.status,502);
});
