// A small, serializable texture graph. Only connected nodes affect the output.
export const NODE_TYPES = {
  motif:{name:'图形',tag:'01 / SHAPE',inputs:0},
  repeat:{name:'排列',tag:'02 / REPEAT',inputs:1},
  transform:{name:'变换',tag:'03 / TRANSFORM',inputs:1},
  palette:{name:'配色',tag:'04 / COLOR',inputs:1},
  mix:{name:'叠加',tag:'＋ / LAYERS',inputs:2},
  output:{name:'义肢贴图',tag:'05 / OUTPUT',inputs:1},
};
const copy=v=>JSON.parse(JSON.stringify(v));
const number=(v,min,max,fallback)=>Number.isFinite(+v)?Math.min(max,Math.max(min,+v)):fallback;
const color=(v,fallback)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:fallback;
export function makeNode(type,id,x=30,y=30){
  if(!NODE_TYPES[type])throw new Error('不支持的节点');
  const data={motif:{shape:'leaf',size:32},repeat:{layout:'grid',count:6,seed:2},transform:{angle:0,scale:100},palette:{primary:'#c8102e',base:'#f5f1e8'},mix:{opacity:65},output:{}}[type];
  return {id,type,x,y,data:copy(data)};
}
export function createGraph(preset='leaf'){
  const nodes=[makeNode('motif','shape',24,24),makeNode('repeat','repeat',274,24),makeNode('transform','transform',274,244),makeNode('palette','palette',24,244),makeNode('output','output',274,464)];
  nodes[0].data.shape=preset==='geo'?'circle':preset==='stars'?'star':'leaf';
  if(preset==='stars'){nodes[1].data.layout='scatter';nodes[1].data.count=9;nodes[3].data.primary='#315f87';}
  return {version:1,nodes,edges:[{from:'shape',to:'repeat',input:0},{from:'repeat',to:'transform',input:0},{from:'transform',to:'palette',input:0},{from:'palette',to:'output',input:0}]};
}
export function evaluateGraph(graph){
  if(!graph||graph.version!==1||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges)||graph.nodes.length>24||graph.edges.length>48)throw new Error('节点图格式无效或超过 24 个节点');
  const nodes=new Map();
  for(const n of graph.nodes){if(!n||!NODE_TYPES[n.type]||typeof n.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(n.id)||nodes.has(n.id))throw new Error('节点标识无效');nodes.set(n.id,n);}
  const outputs=graph.nodes.filter(n=>n.type==='output');if(outputs.length!==1)throw new Error('请保留一个义肢贴图输出节点');
  for(const e of graph.edges){if(!nodes.has(e.from)||!nodes.has(e.to)||nodes.get(e.from).type==='output'||!Number.isInteger(e.input)||e.input<0||e.input>=NODE_TYPES[nodes.get(e.to).type].inputs)throw new Error('连线端口无效');}
  const active=new Set(),cache=new Map();
  function visit(id){
    if(active.has(id))throw new Error('连线形成了循环，请移除一条连线');if(cache.has(id))return copy(cache.get(id));
    const n=nodes.get(id),d=n.data||{},inputs=[];active.add(id);
    for(let i=0;i<NODE_TYPES[n.type].inputs;i++){const links=graph.edges.filter(e=>e.to===id&&e.input===i);if(links.length!==1)throw new Error('请连接「'+NODE_TYPES[n.type].name+'」的输入 '+(i+1));inputs.push(visit(links[0].from));}
    let layers;
    if(n.type==='motif')layers=[{shape:['circle','triangle','leaf','wave','star'].includes(d.shape)?d.shape:'leaf',size:number(d.size,8,70,32),count:1,layout:'single',seed:2,angle:0,scale:100,primary:'#c8102e',base:'#f5f1e8',opacity:1}];
    else if(n.type==='mix'){layers=[...inputs[0],...inputs[1].map(l=>({...l,opacity:l.opacity*number(d.opacity,5,100,65)/100}))];}
    else{layers=inputs[0];for(const l of layers){if(n.type==='repeat'){l.layout=['grid','scatter','diagonal'].includes(d.layout)?d.layout:'grid';l.count=number(d.count,2,14,6);l.seed=number(d.seed,1,999,2);}if(n.type==='transform'){l.angle=number(d.angle,-180,180,0);l.scale=number(d.scale,40,180,100);}if(n.type==='palette'){l.primary=color(d.primary,'#c8102e');l.base=color(d.base,'#f5f1e8');}}}
    if(layers.length>12)throw new Error('叠加图层过多，请减少分支');active.delete(id);cache.set(id,layers);return copy(layers);
  }
  const layers=visit(outputs[0].id);return {layers,connected:cache.size,total:nodes.size};
}
export function connectNodes(graph,from,to,input=0){
  const result=copy(graph),a=result.nodes.find(n=>n.id===from),b=result.nodes.find(n=>n.id===to);
  if(!a||!b||from===to||a.type==='output'||input<0||input>=NODE_TYPES[b.type].inputs)throw new Error('请选择有效的输出和输入端口');
  // Reject cycles even in branches not yet connected to the output.
  const reaches=(id,seen=new Set())=>{if(id===from)return true;if(seen.has(id))return false;seen.add(id);return result.edges.filter(e=>e.from===id).some(e=>reaches(e.to,seen));};
  if(reaches(to))throw new Error('这条连线会形成循环，请选择其他节点');
  result.edges=result.edges.filter(e=>!(e.to===to&&e.input===input));result.edges.push({from,to,input});return result;
}
export function editGraphAppearance(graph,changes){
  if(!graph)return undefined;if(changes.pattern)return undefined;
  const result=copy(graph);
  for(const n of result.nodes){
    if(n.type==='palette'){if(changes.primary)n.data.primary=changes.primary;if(changes.base)n.data.base=changes.base;}
    if(n.type==='repeat'&&changes.density!==undefined)n.data.count=Math.max(2,Math.min(14,Math.round(changes.density/6)));
    if(n.type==='transform'){if(changes.rotation!==undefined)n.data.angle=changes.rotation;if(changes.scale!==undefined)n.data.scale=changes.scale;}
  }return result;
}
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function renderNodeTexture(ctx,graph,size){
  const result=evaluateGraph(graph);ctx.save();ctx.fillStyle=result.layers.at(-1)?.base||'#f5f1e8';ctx.fillRect(0,0,size,size);
  for(const l of result.layers){
    const random=rng(l.seed),count=Math.round(l.count),step=size/(count||1),r=size*l.size/100*(l.layout==='single'?.6:1/(count*.85));
    ctx.save();ctx.translate(size/2,size/2);ctx.rotate(l.angle*Math.PI/180);ctx.scale(l.scale/100,l.scale/100);ctx.translate(-size/2,-size/2);ctx.fillStyle=l.primary;ctx.strokeStyle=l.primary;ctx.globalAlpha=l.opacity;
    const points=l.layout==='single'?[[size/2,size/2]]:[];
    if(l.layout==='scatter'){for(let i=0;i<count*count;i++)points.push([random()*size,random()*size]);}
    else if(l.layout!=='single'){for(let y=-count;y<count*2;y++)for(let x=-count;x<count*2;x++)points.push([(x+.5+(l.layout==='diagonal'?(y%2)*.5:0))*step,(y+.5)*step]);}
    for(const [x,y]of points){ctx.save();ctx.translate(x,y);if(l.layout==='scatter')ctx.rotate(random()*Math.PI);ctx.beginPath();
      if(l.shape==='circle')ctx.arc(0,0,r,0,Math.PI*2);
      else if(l.shape==='triangle'){ctx.moveTo(0,-r);ctx.lineTo(r,r);ctx.lineTo(-r,r);ctx.closePath();}
      else if(l.shape==='leaf'){ctx.moveTo(-r,r);ctx.bezierCurveTo(-r,-r,r,-r,r,-r);ctx.bezierCurveTo(r,r,-r,r,-r,r);}
      else if(l.shape==='star'){for(let j=0;j<10;j++){const a=-Math.PI/2+j*Math.PI/5,rr=j%2?r*.4:r;j?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();}
      else{ctx.moveTo(-r,-r*.5);ctx.bezierCurveTo(-r*.3,-r*1.4,r*.3,r*1.4,r,r*.5);ctx.lineWidth=Math.max(size*.003,r*.3);ctx.stroke();}
      if(l.shape!=='wave')ctx.fill();ctx.restore();
    }ctx.restore();
  }ctx.restore();return result;
}
