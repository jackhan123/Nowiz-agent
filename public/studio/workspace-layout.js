const KEY='coshape-layout-v1';
export function initWorkspaceLayout({onResize=()=>{}}={}){
  const workspace=document.querySelector('.workspace'),panel=document.querySelector('.canvas-panel'),preview=document.querySelector('#node-result-content'),previewToggle=document.querySelector('#node-preview-toggle'),versions=document.querySelector('#version-list'),versionsToggle=document.querySelector('#versions-toggle');
  let state={left:0,right:0,version:153,texture:124,previewHidden:false,versionsHidden:false};
  try{const value=JSON.parse(localStorage.getItem(KEY));if(value)for(const key of Object.keys(state))if(typeof value[key]===typeof state[key])state[key]=value[key];}catch{}
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}}
  function apply(){
    const total=workspace.clientWidth;
    if(total>900){const left=clamp(state.left|| (total>1150?300:260),190,Math.max(190,total-510)),right=clamp(state.right||(total>1150?286:255),210,Math.max(210,total-left-300));workspace.style.setProperty('--chat-width',left+'px');workspace.style.setProperty('--settings-width',right+'px');}
    else if(total>640)workspace.style.setProperty('--settings-width',clamp(state.right||280,210,total-320)+'px');
    const maxHeight=Math.max(100,panel.clientHeight*.5);panel.style.setProperty('--version-height',(state.versionsHidden?58:clamp(state.version,105,maxHeight))+'px');panel.style.setProperty('--texture-height',clamp(state.texture,96,250)+'px');
    preview.hidden=state.previewHidden;previewToggle.setAttribute('aria-expanded',String(!state.previewHidden));previewToggle.innerHTML=state.previewHidden?'展开实时图案 <span>⌃</span>':'收起实时图案 <span>⌄</span>';
    versions.hidden=state.versionsHidden;versionsToggle.setAttribute('aria-expanded',String(!state.versionsHidden));versionsToggle.textContent=state.versionsHidden?'⌃':'⌄';versionsToggle.title=state.versionsHidden?'展开版本区':'收起版本区';panel.classList.toggle('versions-collapsed',state.versionsHidden);
    const widths={left:parseFloat(workspace.style.getPropertyValue('--chat-width'))||260,right:parseFloat(workspace.style.getPropertyValue('--settings-width'))||280};
    for(const [selector,value]of [['.chat-resizer',widths.left],['.settings-resizer',widths.right],['.version-resizer',state.version],['.texture-resizer',state.texture]]){const handle=document.querySelector(selector);if(handle){handle.setAttribute('aria-valuenow',Math.round(value));handle.setAttribute('aria-valuemin',selector.includes('resizer')&&selector.includes('chat')?'190':'58');handle.setAttribute('aria-valuemax',Math.round(total));}}
    onResize();
  }
  function adjust(kind,delta,initial){
    if(kind==='left'){state.left=clamp(initial+delta,190,Math.max(190,workspace.clientWidth-(state.right||255)-300));}
    if(kind==='right'){state.right=clamp(initial-delta,210,Math.max(210,workspace.clientWidth-(workspace.clientWidth>900?(state.left||260):0)-320));}
    if(kind==='version'){state.versionsHidden=false;state.version=clamp(initial-delta,105,Math.max(110,panel.clientHeight*.5));}
    if(kind==='texture'){state.previewHidden=false;state.texture=clamp(initial-delta,96,250);}
    apply();
  }
  for(const [selector,kind]of [['.chat-resizer','left'],['.settings-resizer','right'],['.version-resizer','version'],['.texture-resizer','texture']]){
    const handle=document.querySelector(selector);if(!handle)continue;let drag;
    const current=()=>kind==='left'?parseFloat(workspace.style.getPropertyValue('--chat-width')):kind==='right'?parseFloat(workspace.style.getPropertyValue('--settings-width')):state[kind];
    handle.onpointerdown=e=>{e.preventDefault();drag={start:kind==='left'||kind==='right'?e.clientX:e.clientY,initial:current()};handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing-layout');};
    handle.onpointermove=e=>{if(!drag)return;adjust(kind,(kind==='left'||kind==='right'?e.clientX:e.clientY)-drag.start,drag.initial);};
    const done=()=>{drag=null;document.body.classList.remove('resizing-layout');save();};handle.onpointerup=done;handle.onpointercancel=done;
    handle.onkeydown=e=>{const delta={ArrowLeft:-16,ArrowRight:16,ArrowUp:-16,ArrowDown:16}[e.key];if(!delta)return;e.preventDefault();adjust(kind,delta,current());save();};
    handle.ondblclick=()=>{state[kind]=kind==='left'||kind==='right'?0:kind==='version'?153:124;apply();save();};
  }
  previewToggle.onclick=()=>{state.previewHidden=!state.previewHidden;apply();save();};versionsToggle.onclick=()=>{state.versionsHidden=!state.versionsHidden;apply();save();};
  document.querySelector('#reset-layout').onclick=()=>{state={left:0,right:0,version:153,texture:124,previewHidden:false,versionsHidden:false};apply();save();};
  window.addEventListener('resize',apply);apply();
}
