import { PROVIDERS } from './api-contract.js';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const SETTINGS_KEY='coshape-api-preferences-v1';

export function initApiPanel({notify}){
  const keys=new Map();let mode='demo',provider='deepseek',settings={},revision=0,working=false,testing=false;
  try{const stored=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(PROVIDERS.some(p=>p.id===stored?.provider))provider=stored.provider;if(stored?.settings&&typeof stored.settings==='object')settings=stored.settings;}catch{}
  const definition=()=>PROVIDERS.find(p=>p.id===provider);
  function readConfig(){return {provider,model:$('#api-model').value.trim(),baseUrl:$('#api-base-url').value.trim(),protocol:$('#api-protocol').value,apiKey:keys.get(provider)||''};}
  function savePreferences(){
    const config=readConfig();settings[provider]={model:config.model,baseUrl:config.baseUrl,protocol:config.protocol};
    // Explicit allowlist: never serialize the complete request config or API key.
    try{const safeSettings={};for(const p of PROVIDERS){const value=settings[p.id];if(value){let safeUrl=p.baseUrl;try{const candidate=new URL(value.baseUrl);if(candidate.protocol==='https:'&&!candidate.username&&!candidate.password&&!candidate.search&&!candidate.hash)safeUrl=candidate.href.slice(0,320);}catch{}safeSettings[p.id]={model:typeof value.model==='string'?value.model.slice(0,160):p.model,baseUrl:safeUrl,protocol:['chat','responses','anthropic'].includes(value.protocol)?value.protocol:p.protocol};}}localStorage.setItem(SETTINGS_KEY,JSON.stringify({provider,settings:safeSettings}));}catch{}
  }
  function status(message,state='neutral'){$('#api-status').textContent=message;$('#api-status').dataset.state=state;$('#api-led').dataset.state=state;}
  function updateMode(){
    $$('[data-chat-mode]').forEach(b=>{const selected=b.dataset.chatMode===mode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected);});
    $('#chat-mode-badge').textContent=mode==='api'?'API':'DEMO';$('#chat-mode-badge').classList.toggle('api-active',mode==='api');
    $('#api-summary').textContent=mode==='api'?`${definition().name} · ${keys.has(provider)?'本页已配置':'待填写密钥'}`:'连接你的 AI 模型';
    $('#chat-connection-label').textContent=mode==='api'?`${definition().name} · ${$('#api-model').value.trim()||'待选模型'}`:'本地演示 · 无需 API Key';
    $('#chat-privacy-note').textContent=mode==='api'?(($('#api-include-history').checked)?'将发送最近对话与当前外观参数':'仅发送本次问题与当前外观参数'):'本地演示不发送外部请求';
    $('#api-disclosure').textContent=($('#api-include-history').checked?'发送时经本站后端转发最近对话（可能包含其他厂商的回复）与当前外观参数。':'发送时经本站后端转发本次问题与当前外观参数。')+'连接测试会调用模型，可能产生厂商费用。';
  }
  function loadFields(){
    const p=definition(),saved=settings[provider]||{};$('#api-provider').value=provider;$('#api-model').value=saved.model??p.model;$('#api-base-url').value=saved.baseUrl??p.baseUrl;$('#api-protocol').value=saved.protocol??p.protocol;$('#api-key').value=keys.get(provider)||'';$('#api-key').type='password';$('#api-key-visibility').textContent='显示';
    const docs=$('#api-docs');docs.hidden=!p.docs;if(p.docs)docs.href=p.docs;
    status(keys.has(provider)?'本页已填写密钥，尚未测试。':'密钥仅在本页内存中保留，刷新后清除。');updateMode();
  }
  function requireReady(){const config=readConfig();if(!config.apiKey||!config.model||!config.baseUrl){$('#api-settings').open=true;status('请填写模型名称、API Key 和接口地址。','error');throw new Error('请先在上方完整配置 API 服务。');}return config;}
  async function request(payload,signal){
    const config=requireReady();const localController=new AbortController();const timer=setTimeout(()=>localController.abort(),55_000);const relay=()=>localController.abort();signal?.addEventListener('abort',relay,{once:true});
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({...payload,config}),signal:localController.signal});
      let data;try{data=await response.json();}catch{throw new Error('站点 API 服务没有返回有效数据，请刷新后重试。');}
      if(!response.ok)throw new Error(data.error||'API 调用失败，请检查配置。');return data;
    }catch(error){if(error.name==='AbortError'&&!signal?.aborted)throw new Error('模型响应超时，请重试或更换模型。');throw error;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',relay);}
  }
  for(const p of PROVIDERS){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;$('#api-provider').append(option);}
  $('#api-provider').addEventListener('change',()=>{savePreferences();provider=$('#api-provider').value;revision++;loadFields();savePreferences();});
  for(const id of ['api-model','api-base-url','api-protocol'])$('#'+id).addEventListener('input',()=>{revision++;savePreferences();status('配置已修改，尚未测试。');updateMode();});
  $('#api-key').addEventListener('input',()=>{const key=$('#api-key').value.trim();key?keys.set(provider,key):keys.delete(provider);revision++;status('密钥仅在本页内存中保留。');updateMode();});
  $('#api-key-visibility').onclick=()=>{const show=$('#api-key').type==='password';$('#api-key').type=show?'text':'password';$('#api-key-visibility').textContent=show?'隐藏':'显示';};
  $('#api-clear-key').onclick=()=>{keys.delete(provider);$('#api-key').value='';revision++;status('已清除当前厂商的会话密钥。');updateMode();notify('当前 API Key 已从页面内存清除');};
  $('#api-include-history').onchange=updateMode;
  $$('[data-chat-mode]').forEach(button=>button.onclick=()=>{if(working||testing)return;mode=button.dataset.chatMode;if(mode==='api'&&!keys.has(provider))$('#api-settings').open=true;updateMode();});
  $('#api-enable').onclick=()=>{try{requireReady();savePreferences();mode='api';$('#api-settings').open=false;updateMode();status('API 已启用，发送时将调用所选模型。');notify('已启用 '+definition().name+'，可开始对话');}catch(error){notify(error.message);}};
  $('#api-test').onclick=async()=>{
    if(testing||working)return;let config;try{config=requireReady();}catch(error){notify(error.message);return;}
    const current=revision;testing=true;setBusy(true);status('正在向 '+definition().name+' 发送连接测试…','pending');$('#api-test').textContent='测试中…';
    try{await request({mode:'test'});if(current===revision){status('连接成功 · '+config.model,'success');notify('模型连接测试通过');}}
    catch(error){if(current===revision)status(error.message,'error');}
    finally{testing=false;setBusy(false);$('#api-test').textContent='测试连接';}
  };
  function setBusy(value){working=value;for(const selector of ['#api-provider','#api-model','#api-base-url','#api-protocol','#api-key','#api-enable','#api-test','#api-clear-key','#api-include-history'])$(selector).disabled=value;$$('[data-chat-mode]').forEach(b=>b.disabled=value);}
  loadFields();
  return {get mode(){return mode;},get name(){return definition().name;},get includeHistory(){return $('#api-include-history').checked;},get isTesting(){return testing;},request,setBusy,showError(message){status(message,'error');},ready:requireReady};
}
