import { NODE_TYPES, createGraph, makeNode, connectNodes, evaluateGraph, renderNodeTexture } from './node-graph.js';
const copy=v=>JSON.parse(JSON.stringify(v));
const SHAPES=[['leaf','叶片'],['circle','圆形'],['triangle','三角'],['wave','曲线'],['star','星形']];
const LAYOUTS=[['grid','规则网格'],['diagonal','错位排列'],['scatter','自由散布']];
export function initNodeEditor({onApply,notify,getDesign}){
  const root=document.querySelector('#node-editor'),stage=root.querySelector('.node-stage'),svg=root.querySelector('.node-edges'),cards=root.querySelector('.node-cards'),status=root.querySelector('#node-status'),preview=root.querySelector('#node-preview'),apply=root.querySelector('#node-apply');
  let graph=createGraph(),pending=null,lastApplied='',drag=null,nextId=Date.now();
  try{const saved=JSON.parse(localStorage.getItem('coshape-node-draft-v1'));if(saved){evaluateGraph(saved);graph=saved;}}catch{}
  function save(){try{localStorage.setItem('coshape-node-draft-v1',JSON.stringify(graph));}catch{}}
  function message(text,error=false){status.textContent=text;status.dataset.error=error?'true':'false';}
  function updatePreview(){
    const ctx=preview.getContext('2d');ctx.clearRect(0,0,preview.width,preview.height);
    try{const result=renderNodeTexture(ctx,graph,preview.width);apply.disabled=false;message(result.connected+' / '+result.total+' 个节点参与输出 · '+result.layers.length+' 个图层');}
    catch(error){apply.disabled=true;ctx.fillStyle='#f1ece5';ctx.fillRect(0,0,preview.width,preview.height);message(error.message,true);}save();
  }
  function redrawEdges(){
    svg.replaceChildren();
    for(const e of graph.edges){const from=cards.querySelector('[data-node-id="'+e.from+'"]'),to=cards.querySelector('[data-node-id="'+e.to+'"]');if(!from||!to)continue;const a=from.querySelector('.node-port.out'),b=to.querySelector('[data-input="'+e.input+'"]');if(!a||!b)continue;
      const x1=from.offsetLeft+a.offsetLeft+a.offsetWidth/2,y1=from.offsetTop+a.offsetTop+a.offsetHeight/2,x2=to.offsetLeft+b.offsetLeft+b.offsetWidth/2,y2=to.offsetTop+b.offsetTop+b.offsetHeight/2;
      const p=document.createElementNS('http://www.w3.org/2000/svg','path');const bend=Math.max(50,Math.abs(x2-x1)*.45);p.setAttribute('d',`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`);p.setAttribute('class','node-wire');p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label','移除 '+NODE_TYPES[graph.nodes.find(n=>n.id===e.from).type].name+' 到 '+NODE_TYPES[graph.nodes.find(n=>n.id===e.to).type].name+' 的连线');
      const remove=()=>{graph.edges=graph.edges.filter(link=>link!==e);render();};p.onclick=remove;p.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();remove();}};svg.append(p);
    }
    cards.querySelectorAll('.node-port').forEach(p=>{const id=p.closest('.texture-node').dataset.nodeId;const connected=p.classList.contains('out')?graph.edges.some(e=>e.from===id):graph.edges.some(e=>e.to===id&&e.input===+p.dataset.input);p.classList.toggle('connected',connected);p.classList.toggle('pending',pending===id&&p.classList.contains('out'));});
  }
  function connect(from,to,input){try{graph=connectNodes(graph,from,to,input);pending=null;render();notify('节点已连接，图案已重新计算');}catch(error){message(error.message,true);}}
  function port(n,kind,input=0){const b=document.createElement('button');b.type='button';b.className='node-port '+kind;b.setAttribute('aria-label',NODE_TYPES[n.type].name+'节点'+(kind==='out'?'输出端口':'输入端口 '+(input+1)));if(kind==='in'){b.dataset.input=input;b.style.top=(50+input*27)+'px';}b.onclick=()=>{if(kind==='out'){pending=pending===n.id?null:n.id;redrawEdges();message(pending?'已选择输出，请点击另一个节点的输入圆点':'已取消连线');}else if(pending)connect(pending,n.id,input);else message('先点击一个节点右侧的输出圆点，再点击这里连接');};return b;}
  function field(n,label,key,type,options){
    const wrap=document.createElement('label'),title=document.createElement('span');title.textContent=label;wrap.append(title);let input;
    if(type==='select'){input=document.createElement('select');for(const [value,text]of options){const o=document.createElement('option');o.value=value;o.textContent=text;input.append(o);}}
    else{input=document.createElement('input');input.type=type;if(type==='range'){input.min=options[0];input.max=options[1];input.step=options[2]||1;}}
    input.value=n.data[key];input.setAttribute('aria-label',NODE_TYPES[n.type].name+' · '+label);wrap.append(input);let output;if(type==='range'){output=document.createElement('output');output.textContent=input.value;wrap.append(output);}
    input.addEventListener('input',()=>{n.data[key]=type==='range'?+input.value:input.value;if(output)output.textContent=input.value;updatePreview();});return wrap;
  }
  function render(){
    cards.replaceChildren();let width=500,height=660;
    for(const n of graph.nodes){n.data||={};n.x=Math.max(16,Math.min(2200,+n.x||16));n.y=Math.max(16,Math.min(1600,+n.y||16));width=Math.max(width,n.x+220);height=Math.max(height,n.y+190);const card=document.createElement('article');card.className='texture-node type-'+n.type;card.dataset.nodeId=n.id;card.style.left=n.x+'px';card.style.top=n.y+'px';
      const header=document.createElement('div');header.className='node-drag';header.tabIndex=0;header.setAttribute('aria-label','移动'+NODE_TYPES[n.type].name+'节点，使用方向键');const tag=document.createElement('small');tag.textContent=NODE_TYPES[n.type].tag;const name=document.createElement('strong');name.textContent=NODE_TYPES[n.type].name;header.append(tag,name);
      if(n.type!=='output'){const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','删除'+NODE_TYPES[n.type].name+'节点');remove.onclick=()=>{graph.nodes=graph.nodes.filter(x=>x.id!==n.id);graph.edges=graph.edges.filter(e=>e.from!==n.id&&e.to!==n.id);pending=null;render();};header.append(remove);}
      header.onpointerdown=e=>{if(e.target.closest('button'))return;drag={id:n.id,x:e.clientX,y:e.clientY,left:n.x,top:n.y};header.setPointerCapture(e.pointerId);};
      header.onpointermove=e=>{if(drag?.id!==n.id)return;n.x=Math.max(16,Math.min(2200,drag.left+e.clientX-drag.x));n.y=Math.max(16,Math.min(1600,drag.top+e.clientY-drag.y));card.style.left=n.x+'px';card.style.top=n.y+'px';stage.style.width=Math.max(width,n.x+220)+'px';stage.style.height=Math.max(height,n.y+190)+'px';redrawEdges();};
      const end=()=>{if(drag){drag=null;save();}};header.onpointerup=end;header.onpointercancel=end;header.onkeydown=e=>{const delta={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]}[e.key];if(!delta||e.target!==header)return;e.preventDefault();n.x=Math.max(16,n.x+delta[0]);n.y=Math.max(16,n.y+delta[1]);card.style.left=n.x+'px';card.style.top=n.y+'px';redrawEdges();save();};card.append(header);
      for(let i=0;i<NODE_TYPES[n.type].inputs;i++)card.append(port(n,'in',i));if(n.type!=='output')card.append(port(n,'out'));
      const body=document.createElement('div');body.className='node-body';
      if(n.type==='motif')body.append(field(n,'基础图形','shape','select',SHAPES),field(n,'图形大小','size','range',[8,70]));
      if(n.type==='repeat')body.append(field(n,'排列方式','layout','select',LAYOUTS),field(n,'排列数量','count','range',[2,14]),field(n,'随机种子','seed','range',[1,99]));
      if(n.type==='transform')body.append(field(n,'旋转角度','angle','range',[-180,180]),field(n,'整体缩放','scale','range',[40,180]));
      if(n.type==='palette')body.append(field(n,'图案颜色','primary','color'),field(n,'背景颜色','base','color'));
      if(n.type==='mix')body.append(field(n,'第二层透明度','opacity','range',[5,100]));
      if(n.type==='output'){const p=document.createElement('p');p.textContent='连接的图案将在下方实时预览。确认后应用到当前义肢选区。';body.append(p);}card.append(body);cards.append(card);
    }
    stage.style.width=width+'px';stage.style.height=height+'px';redrawEdges();updatePreview();
  }
  root.querySelector('#node-add').onclick=()=>{if(graph.nodes.length>=24){notify('最多可添加 24 个节点');return;}const type=root.querySelector('#node-type').value;const n=makeNode(type,'n'+(++nextId),40+(graph.nodes.length%3)*210,180+Math.floor(graph.nodes.length/3)*180);graph.nodes.push(n);render();root.querySelector('.node-scroll').scrollTo({left:n.x-30,top:n.y-20,behavior:'smooth'});message('已添加'+NODE_TYPES[type].name+'节点，请连接端口使其参与输出');};
  root.querySelector('#node-preset').onchange=e=>{graph=createGraph(e.target.value);pending=null;render();root.querySelector('.node-scroll').scrollTo(0,0);};
  root.querySelector('#node-cancel').onclick=()=>{pending=null;redrawEdges();updatePreview();};
  apply.onclick=()=>{try{evaluateGraph(graph);lastApplied=JSON.stringify(graph);onApply(copy(graph));}catch(error){message(error.message,true);}};
  document.querySelectorAll('.studio-view-tabs [data-studio-view]').forEach(button=>button.onclick=()=>{const panel=document.querySelector('.canvas-panel');panel.dataset.studioView=button.dataset.studioView;document.querySelectorAll('.studio-view-tabs [data-studio-view]').forEach(b=>{b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1;});root.hidden=button.dataset.studioView!=='nodes';if(!root.hidden){const d=getDesign();root.querySelector('#node-zone').textContent=d.zone==='upper'?'上半部':d.zone==='lower'?'下半部':'全部区域';redrawEdges();}});
  document.querySelectorAll('.studio-view-tabs [data-studio-view]').forEach(button=>button.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const next=[...document.querySelectorAll('.studio-view-tabs [data-studio-view]')].find(b=>b!==button);next.click();next.focus();}});
  render();
  return {sync(d){const g=d.zone!=='all'&&d.regions?.[d.zone]?.nodeGraph?d.regions[d.zone].nodeGraph:d.nodeGraph;root.querySelector('#node-zone').textContent=d.zone==='upper'?'上半部':d.zone==='lower'?'下半部':'全部区域';if(g&&JSON.stringify(g)!==lastApplied){try{evaluateGraph(g);graph=copy(g);lastApplied=JSON.stringify(g);render();}catch{}}}};
}
