// The browser only calls this Site. Provider settings and credentials live on the server.
export function initApiPanel({notify}){
  let busy=false;
  async function requestAt(endpoint,payload,signal,timeout){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    const relay=()=>controller.abort();signal?.addEventListener('abort',relay,{once:true});
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload),signal:controller.signal});
      let data;try{data=await response.json();}catch{throw new Error('服务暂时没有返回结果，请稍后再试。');}
      if(!response.ok)throw new Error(data.error||'服务暂时不可用，当前设计未修改。');return data;
    }catch(error){if(error.name==='AbortError'&&!signal?.aborted)throw new Error(endpoint.includes('image')?'生成超时，请先检查结果，避免立即重复生成。':'回应超时，请稍后重试。');throw error;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',relay);}
  }
  const mode=document.querySelector('#creation-mode'),label=document.querySelector('#chat-connection-label');
  mode.onchange=()=>{label.textContent=mode.value==='image'?'生成一张原创外观贴图':'描述想法，一起调整';};mode.onchange();
  return {mode:'api',name:'AI 助手',includeHistory:true,isTesting:false,ready:()=>true,
    request:(payload,signal)=>requestAt('/api/chat',payload,signal,95_000),
    generate:(payload,signal)=>requestAt('/api/image',payload,signal,310_000),
    setBusy(value){busy=value;mode.disabled=value;},showError:notify};
}
