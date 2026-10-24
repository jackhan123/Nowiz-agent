import { Buffer } from 'node:buffer';
import { managedImageConfig } from './ai-config.mjs';
import { resolveEndpoint } from './design-api.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const windows=new Map();
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function limited(response,limit){const chunks=[];let total=0;const reader=response.body?.getReader();if(!reader)throw fail(502,'生图服务没有返回内容。');while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw fail(502,'返回图片过大，请使用更简单的描述重新生成。');}chunks.push(value);}return Buffer.concat(chunks,total);}
function mime(bytes){if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';throw fail(502,'生图服务返回了无法识别的图片，未修改设计。');}
export function validateImageUrl(value,env={}){
  let url;try{url=new URL(value);}catch{throw fail(502,'生图服务返回的图片地址无效。');}
  const host=url.hostname.toLowerCase(),extra=String(env.COSHAPE_IMAGE_DOWNLOAD_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean);
  const allowed=host==='api.openai-next.com'||host.endsWith('.openai-next.com')||host.endsWith('.oaiusercontent.com')||host.endsWith('.blob.core.windows.net')||extra.includes(host);
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!allowed)throw fail(502,'生成已完成，但图片下载域名尚未配置。请联系站点维护者，避免重复生成。');return url.href;
}
export async function handleImageRequest(request,{environment={},fetchImpl=fetch,timeoutMs=300_000}={}){
  let timer;
  try{
    if(request.method!=='POST')return reply({error:'仅支持 POST 请求。'},405);
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw fail(403,'请从本站工作台生成图案。');
    if(!request.headers.get('content-type')?.includes('application/json'))throw fail(415,'请求格式无效。');
    let text;try{text=(await limited(request,20_000)).toString('utf8');}catch{throw fail(413,'描述过长，请缩短后重试。');}let input;try{input=JSON.parse(text);}catch{throw fail(400,'请求格式无效。');}
    if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>4000)throw fail(400,'请描述你想生成的图案，最多 4000 字。');
    if(/承重|接受腔|修改关节|临床适配|固定装置/.test(input.prompt))throw fail(400,'这里仅生成外观贴图。结构、接受腔和临床适配需要专业人员评估。');
    let config;try{config=managedImageConfig(environment);}catch(error){throw fail(503,error.message);}
    const endpoint=resolveEndpoint(config).url.replace(/\/chat\/completions$/,'/images/generations');
    const id=request.headers.get('oai-authenticated-user-id')||request.headers.get('cf-connecting-ip')||'anonymous',now=Date.now();
    if(windows.size>1000)for(const [key,w]of windows)if(now-w.start>600_000)windows.delete(key);
    const window=windows.get(id);if(window&&now-window.start<600_000){if(window.count>=4)throw fail(429,'图案生成较频繁，请稍后再试。');window.count++;}else windows.set(id,{start:now,count:1});
    const controller=new AbortController();timer=setTimeout(()=>controller.abort(),timeoutMs);request.signal?.addEventListener('abort',()=>controller.abort(),{once:true});
    const prompt='Create a square, flat surface artwork texture for a prosthetic cosmetic cover. Fill the entire canvas edge to edge; suitable for wrapping onto a 3D surface. No product mockup, no prosthesis, no limbs, no text, no logo, no watermark, no perspective. Follow the user\'s visual request: '+input.prompt.trim();
    const response=await fetchImpl(endpoint,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.apiKey},body:JSON.stringify({model:config.model,prompt,size:'1024x1024'}),signal:controller.signal});
    if(!response.ok){await response.body?.cancel();throw fail(response.status===401||response.status===403?503:response.status===429?429:502,response.status===429?'生图服务繁忙或额度不足，请稍后再试。':'生图服务暂时不可用，当前设计未修改。');}
    let result;try{result=JSON.parse((await limited(response,16_000_000)).toString('utf8'));}catch(error){if(error.status)throw error;throw fail(502,'生图服务返回格式无效，当前设计未修改。');}
    const item=result?.data?.[0];let bytes;
    if(typeof item?.b64_json==='string'){const encoded=item.b64_json.replace(/^data:image\/[^;]+;base64,/,'');if(encoded.length>12_000_000||!/^[A-Za-z0-9+/=\r\n]+$/.test(encoded))throw fail(502,'图片内容无效或过大，未修改设计。');bytes=Buffer.from(encoded,'base64');}
    else if(item?.url){const url=validateImageUrl(item.url,environment);const download=await fetchImpl(url,{redirect:'manual',signal:controller.signal});if(!download.ok)throw fail(502,'图案已生成，但下载失败，请勿立即重复生成。');bytes=await limited(download,9_000_000);}
    else throw fail(502,'生图服务没有返回图片，未修改设计。');
    const type=mime(bytes);return reply({reply:'新图案已生成，可应用到当前选区。',image:{dataUrl:'data:'+type+';base64,'+bytes.toString('base64'),mime:type},description:input.prompt.trim()});
  }catch(error){return reply({error:error?.name==='AbortError'?'生成已停止或超时。服务可能已计费，请先检查结果，避免立即重复生成。':error.status?error.message:'无法连接生图服务，当前设计未修改。'},error.status||504);}
  finally{clearTimeout(timer);}
}
