import * as THREE from './assets/three.module.js';
import { initApiPanel } from './api-connection.js';
import { applyDesignChanges, sanitizeChanges } from './api-contract.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clone = value => JSON.parse(JSON.stringify(value));
const STORAGE = 'coshape-studio-v1';
const patternNames = {flow:'流动线条',botanical:'自然植物',geometric:'几何构成',stars:'星点涂鸦'};
const palettes = {red:['#c8102e','#f5f1e8'],forest:['#345e4c','#f0ede3'],blue:['#315f87','#e8edf1'],ink:['#35363a','#eee9df'],orange:['#cb784d','#f6eddf']};
const defaults = {primary:'#c8102e',base:'#f5f1e8',pattern:'flow',density:40,scale:100,rotation:0,finish:'satin',zone:'all',type:'leg',side:'left',seed:2,regions:{upper:null,lower:null}};
let design=clone(defaults), versions=[],history=[],historyIndex=0,activeId='v1',projectName='流动的红',messages=[],busy=false;
let compare=false,autoRotate=false,wireframe=false,modelAngle=.60,tilt=0,zoom=1;
let scene,camera,renderer,model,compareModel,resizeObserver,renderTime=0,storageAvailable=true;
let lastFocused=null,toastTimer,changeTimer;
let apiConnection,apiAbort=null;

function seedRandom(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function appearance(d){return {primary:d.primary,base:d.base,pattern:d.pattern,density:d.density,scale:d.scale,rotation:d.rotation,seed:d.seed};}
function drawPattern(ctx,p,size){
  const random=seedRandom(p.seed||2);ctx.fillStyle=p.base;ctx.fillRect(0,0,size,size);
  ctx.save();ctx.translate(size/2,size/2);ctx.rotate(p.rotation*Math.PI/180);ctx.scale(p.scale/100,p.scale/100);ctx.translate(-size/2,-size/2);ctx.fillStyle=p.primary;ctx.strokeStyle=p.primary;
  if(p.pattern==='flow'){
    const count=6,spacing=size/count,width=spacing*(p.density/100)*1.3;
    for(let i=-10;i<16;i++){
      const x=i*spacing;ctx.beginPath();
      for(let j=0;j<=100;j++){const y=-size+j*size*3/100,xx=x+Math.sin(y/size*Math.PI*2+.4)*size*.13+Math.sin(y/size*Math.PI*4)*size*.025;j?ctx.lineTo(xx,y):ctx.moveTo(xx,y);}
      for(let j=100;j>=0;j--){const y=-size+j*size*3/100,xx=x+Math.sin(y/size*Math.PI*2+.4)*size*.13+Math.sin(y/size*Math.PI*4)*size*.025+width*(.75+.25*Math.sin(y/size*Math.PI*3+i));ctx.lineTo(xx,y);}ctx.closePath();ctx.fill();
    }
  }else if(p.pattern==='botanical'){
    const spacing=size/(2+p.density/22);
    for(let row=-4;row<9;row++)for(let col=-4;col<9;col++){
      const x=col*spacing+(row%2)*spacing*.45,y=row*spacing;ctx.save();ctx.translate(x,y);ctx.rotate((random()-.5)*1.3);ctx.lineWidth=size*.006;
      ctx.beginPath();ctx.moveTo(0,spacing*.65);ctx.bezierCurveTo(-spacing*.1,spacing*.2,spacing*.12,-spacing*.2,0,-spacing*.6);ctx.stroke();
      for(let k=0;k<4;k++){const sy=spacing*(.28-k*.19),dir=k%2?1:-1;ctx.beginPath();ctx.moveTo(0,sy);ctx.bezierCurveTo(dir*spacing*.06,sy-spacing*.3,dir*spacing*.4,sy-spacing*.32,dir*spacing*.34,sy-spacing*.43);ctx.bezierCurveTo(dir*spacing*.42,sy-spacing*.05,dir*spacing*.12,sy,0,sy);ctx.fill();}ctx.restore();
    }
  }else if(p.pattern==='geometric'){
    const step=size/5,r=step*(.18+p.density/170);
    for(let row=-5;row<10;row++)for(let col=-5;col<10;col++){
      const x=col*step+((row%2)*step/2),y=row*step;
      ctx.globalAlpha=((row+col)%3===0)?.45:1;ctx.beginPath();
      if((row+col)%2===0){ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}else{ctx.moveTo(x-r,y+r);ctx.lineTo(x+r,y+r);ctx.lineTo(x+r,y-r);ctx.closePath();ctx.fill();}
    }ctx.globalAlpha=1;
  }else{
    const count=Math.round(p.density*1.9);
    for(let i=0;i<count;i++){const x=random()*size*2-size*.5,y=random()*size*2-size*.5,r=size*(.012+random()*.024);ctx.save();ctx.translate(x,y);ctx.rotate(random()*Math.PI);ctx.beginPath();for(let j=0;j<8;j++){const angle=j*Math.PI/4,rad=j%2?r*.28:r;j?ctx.lineTo(Math.cos(angle)*rad,Math.sin(angle)*rad):ctx.moveTo(rad,0);}ctx.closePath();ctx.fill();ctx.restore();}
  }
  ctx.restore();
}
function textureCanvas(d,size=1024){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');drawPattern(ctx,appearance(d),size);
  for(const zone of ['upper','lower'])if(d.regions?.[zone]){ctx.save();ctx.beginPath();ctx.rect(0,zone==='upper'?0:size/2,size,size/2);ctx.clip();drawPattern(ctx,d.regions[zone],size);ctx.restore();}
  return canvas;
}
function makeTexture(d){const texture=new THREE.CanvasTexture(textureCanvas(d));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer?Math.min(8,renderer.capabilities.getMaxAnisotropy()):1;return texture;}
function materialRoughness(d){return{matte:.9,satin:.57,gloss:.2}[d.finish]||.57;}
function shellGeometry(type){
  const rows=70,cols=96,positions=[],uvs=[],indices=[];
  for(let j=0;j<=rows;j++){const t=j/rows;let y,rx,rz,shift;
    if(type==='leg'){y=.0+t*2.25;rx=.225+.11*t+.09*Math.sin(t*Math.PI*.85);rz=.20+.115*t+.04*Math.sin(t*Math.PI);shift=.07*Math.sin(t*Math.PI);}
    else{y=.18+t*1.55;rx=.19+.14*t+.035*Math.sin(t*Math.PI);rz=.17+.09*t;shift=.03*Math.sin(t*Math.PI);}
    for(let i=0;i<=cols;i++){const u=i/cols,angle=u*Math.PI*2;const front=Math.cos(angle);const ridge=type==='leg'&&front>.55?.02*(front-.55)*Math.sin(t*Math.PI):0;positions.push(Math.sin(angle)*rx, y+Math.cos(angle)*.065*Math.pow(t,5),Math.cos(angle)*(rz+ridge)+shift);uvs.push(u,t);}
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,b,a+1,b+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function buildModel(d){
  const group=new THREE.Group();const coverGeometry=shellGeometry(d.type);
  const shellMaterial=new THREE.MeshStandardMaterial({map:makeTexture(d),roughness:materialRoughness(d),metalness:.035,side:THREE.FrontSide});
  const shell=new THREE.Mesh(coverGeometry,shellMaterial);shell.castShadow=true;shell.receiveShadow=true;group.add(shell);group.userData.shell=shell;
  const inner=new THREE.Mesh(coverGeometry,new THREE.MeshStandardMaterial({color:0x34332f,roughness:.9,side:THREE.BackSide}));inner.scale.set(.982,1,.982);group.add(inner);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(d.type==='leg'?.376:.33,.009,8,96),new THREE.MeshStandardMaterial({color:0xd2c9b8,roughness:.5}));rim.rotation.x=Math.PI/2;rim.scale.y=d.type==='leg'?.84:.79;rim.position.y=d.type==='leg'?2.25:1.73;rim.rotation.z=.16;group.add(rim);
  const silver=new THREE.MeshStandardMaterial({color:0xc5c7c8,metalness:.95,roughness:.22});const dark=new THREE.MeshStandardMaterial({color:0x303235,metalness:.7,roughness:.33});const carbon=new THREE.MeshStandardMaterial({color:0x333537,metalness:.35,roughness:.46});
  function cylinder(r1,r2,height,y,mat,segments=48){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,height,segments),mat);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
  if(d.type==='leg'){
    cylinder(.205,.18,.10,-.035,dark);cylinder(.17,.13,.08,-.125,silver);cylinder(.085,.085,.42,-.37,silver);cylinder(.12,.12,.07,-.59,silver);cylinder(.13,.11,.09,-.66,dark);cylinder(.105,.14,.21,-.8,dark);
    const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.28,40),silver);hinge.rotation.z=Math.PI/2;hinge.position.y=-.89;group.add(hinge);
    const shape=new THREE.Shape();shape.moveTo(-.24,0);shape.bezierCurveTo(-.3,.09,-.22,.27,-.04,.29);shape.bezierCurveTo(.07,.24,.02,.1,.25,.07);shape.bezierCurveTo(.48,.01,.70,.0,.82,.025);shape.bezierCurveTo(.91,.02,.94,-.06,.8,-.08);shape.bezierCurveTo(.40,-.12,.04,-.08,-.24,0);
    const footGeo=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,steps:1,curveSegments:28});
    const foot=new THREE.Mesh(footGeo,carbon);foot.rotation.y=-Math.PI/2;foot.position.set(.14,-1.1,.0);foot.castShadow=true;foot.receiveShadow=true;group.add(foot);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(footGeo,35),new THREE.LineBasicMaterial({color:0x8c8e8d,transparent:true,opacity:.26}));edges.rotation.copy(foot.rotation);edges.position.copy(foot.position);group.add(edges);
    const plate=new THREE.Mesh(new THREE.BoxGeometry(.21,.035,.24),silver);plate.position.set(0,-.98,.02);group.add(plate);
    for(let i=0;i<4;i++){const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.018,12),dark);bolt.position.set((i%2?1:-1)*.12,-.16,(i<2?1:-1)*.06);group.add(bolt);}
  }else{
    cylinder(.16,.14,.08,.14,dark);cylinder(.11,.09,.18,.01,silver);
    const palm=new THREE.Mesh(new THREE.BoxGeometry(.29,.32,.16,2,2,2),new THREE.MeshStandardMaterial({color:0xdad4c9,roughness:.6,metalness:.1}));palm.position.set(0,-.24,0);palm.castShadow=true;group.add(palm);
    for(let i=0;i<4;i++){const finger=new THREE.Mesh(new THREE.CapsuleGeometry(.034,.20-(Math.abs(i-1.5)*.025),5,12),silver);finger.position.set((i-1.5)*.075,-.54,.01);finger.rotation.x=-.14;finger.castShadow=true;group.add(finger);}
    const thumb=new THREE.Mesh(new THREE.CapsuleGeometry(.045,.15,5,12),silver);thumb.position.set(-.22,-.3,.05);thumb.rotation.z=-.6;group.add(thumb);
    group.scale.setScalar(1.25);
  }
  const meshWire=new THREE.Mesh(coverGeometry,new THREE.MeshBasicMaterial({color:0x4a4744,wireframe:true,transparent:true,opacity:.15,depthWrite:false}));meshWire.scale.set(1.003,1,1.003);meshWire.visible=wireframe;group.add(meshWire);group.userData.wire=meshWire;
  group.userData.type=d.type;group.position.y=d.type==='leg'?-.32:-.34;return group;
}
function disposeModel(group){if(!group)return;const geometries=new Set(),materials=new Set(),textures=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);}}});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());scene?.remove(group);}
function rebuildModel(){
  if(!scene)return;disposeModel(model);disposeModel(compareModel);compareModel=null;model=buildModel(design);scene.add(model);
  if(compare){const previous=previousVersion();compareModel=buildModel(previous.design);scene.add(compareModel);model.position.x=.88;compareModel.position.x=-.88;model.scale.multiplyScalar(.73);compareModel.scale.multiplyScalar(.73);$('#compare-labels span').textContent='参考：'+previous.name;}applyView();
}
function previousVersion(){if(historyIndex>0)return{name:'上一步设计',design:history[historyIndex-1]};const index=versions.findIndex(v=>v.id===activeId);return versions[index>0?index-1:versions.length>1?1:0]||{name:'初始设计',design:clone(defaults)};}
function updateTexture(){
  if(model){const shell=model.userData.shell;shell.material.map?.dispose();shell.material.map=makeTexture(design);shell.material.roughness=materialRoughness(design);shell.material.needsUpdate=true;}updateUI();persist();
}
function applyView(){if(!camera)return;const size=$('#viewport').getBoundingClientRect();camera.aspect=size.width/Math.max(1,size.height);camera.position.set(0,1.05,6.3/zoom);camera.lookAt(0,.55,0);camera.updateProjectionMatrix();if(model){model.rotation.y=modelAngle;model.rotation.x=tilt;model.scale.x=Math.abs(model.scale.x)*(design.side==='right'?-1:1);}if(compareModel){compareModel.rotation.y=modelAngle;compareModel.rotation.x=tilt;compareModel.scale.x=Math.abs(compareModel.scale.x)*(previousVersion().design.side==='right'?-1:1);}}
function init3D(){
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;$('#viewport').appendChild(renderer.domElement);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,100);
    const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;const envContext=envCanvas.getContext('2d');const envGradient=envContext.createLinearGradient(0,0,0,256);envGradient.addColorStop(0,'#f5f1e9');envGradient.addColorStop(.5,'#a19f9b');envGradient.addColorStop(1,'#77746d');envContext.fillStyle=envGradient;envContext.fillRect(0,0,512,256);envContext.fillStyle='#ffffff';envContext.fillRect(40,20,40,160);envContext.fillRect(290,35,90,120);const envTexture=new THREE.CanvasTexture(envCanvas);envTexture.mapping=THREE.EquirectangularReflectionMapping;envTexture.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(envTexture).texture;envTexture.dispose();pmrem.dispose();scene.environmentIntensity=.75;
    scene.add(new THREE.HemisphereLight(0xffffff,0xb8afa3,1.5));
    const main=new THREE.DirectionalLight(0xffffff,2.8);main.position.set(-3,5,4);main.castShadow=true;main.shadow.mapSize.set(2048,2048);main.shadow.camera.left=-4;main.shadow.camera.right=4;main.shadow.camera.top=5;main.shadow.camera.bottom=-4;main.shadow.normalBias=.025;main.shadow.bias=-.0001;scene.add(main);
    const fill=new THREE.DirectionalLight(0xfff4e2,1.0);fill.position.set(4,2,-2);scene.add(fill);
    const strip=new THREE.DirectionalLight(0xffffff,1.4);strip.position.set(-2,0,-3);scene.add(strip);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:0x5b5044,opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.57;floor.receiveShadow=true;scene.add(floor);
    const grid=new THREE.GridHelper(18,55,0xe1ded7,0xe7e4df);grid.position.y=-1.575;grid.material.transparent=true;grid.material.opacity=.36;scene.add(grid);
    rebuildModel();
    resizeObserver=new ResizeObserver(()=>{const r=$('#viewport').getBoundingClientRect();if(r.width&&r.height){renderer.setSize(r.width,r.height);applyView();}});resizeObserver.observe($('#viewport'));
    let drag=false,lastX=0,lastY=0;
    $('#viewport').addEventListener('pointerdown',e=>{if(e.target!==renderer.domElement)return;drag=true;lastX=e.clientX;lastY=e.clientY;$('#viewport').setPointerCapture(e.pointerId);autoRotate=false;$('#auto-rotate').classList.remove('active');$('#auto-rotate').setAttribute('aria-pressed','false');});
    $('#viewport').addEventListener('pointermove',e=>{if(!drag)return;modelAngle+=(e.clientX-lastX)*.009;tilt=THREE.MathUtils.clamp(tilt+(e.clientY-lastY)*.004,-.4,.4);lastX=e.clientX;lastY=e.clientY;applyView();});
    $('#viewport').addEventListener('pointerup',()=>drag=false);$('#viewport').addEventListener('pointercancel',()=>drag=false);
    $('#viewport').addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom-e.deltaY*.001, .65,1.65);applyView();},{passive:false});
    $('#viewport').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')modelAngle-=.13;if(e.key==='ArrowRight')modelAngle+=.13;if(e.key==='ArrowUp')tilt=Math.max(-.4,tilt-.07);if(e.key==='ArrowDown')tilt=Math.min(.4,tilt+.07);if(e.key==='+'||e.key==='=')zoom=Math.min(1.65,zoom+.1);if(e.key==='-')zoom=Math.max(.65,zoom-.1);applyView();}});
    $('#canvas-loader').remove();const animate=time=>{requestAnimationFrame(animate);if(time-renderTime<25)return;renderTime=time;if(autoRotate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){modelAngle+=.007;applyView();}renderer.render(scene,camera);};requestAnimationFrame(animate);
  }catch(error){console.error('3D unavailable',error);$('#canvas-loader')?.remove();$('#viewport-error').hidden=false;$('.canvas-status').textContent='3D 预览暂不可用';}
}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({design,versions,activeId,projectName,messages}));$('#save-status').textContent='已保存在此浏览器';}catch{storageAvailable=false;$('#save-status').textContent='当前会话暂存 · 可导出备份';}}
function startState(){
  try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(saved?.design&&Array.isArray(saved.versions)&&saved.versions.length){design={...clone(defaults),...saved.design};versions=saved.versions;activeId=saved.activeId;projectName=saved.projectName||'我的设计';messages=(saved.messages||[]).slice(-30);}}
  catch{storageAvailable=false;}
  if(!versions.length){versions=[{id:'v1',name:'流动的红',design:clone(defaults),time:'初始方案',created:Date.now()},{id:'v2',name:'留白之间',design:{...clone(defaults),density:23,scale:125,seed:3},time:'候选方案',created:Date.now()+1},{id:'v3',name:'几何节奏',design:{...clone(defaults),pattern:'geometric',density:40,scale:90,seed:4},time:'候选方案',created:Date.now()+2}];}
  history=[clone(design)];historyIndex=0;
}
function updateUI(){
  const p=currentAppearance();$('#primary-color').value=p.primary;$('#base-color').value=p.base;$('#primary-hex').textContent=p.primary.toUpperCase();$('#base-hex').textContent=p.base.toUpperCase();
  for(const key of ['density','scale','rotation']){$('#'+key).value=p[key];$('#'+key+'-value').textContent=p[key]+(key==='rotation'?'°':'%');}
  $$('.pattern-option').forEach(b=>b.classList.toggle('active',b.dataset.pattern===p.pattern));$$('[data-zone]').forEach(b=>b.classList.toggle('active',b.dataset.zone===design.zone));$$('[data-finish]').forEach(b=>b.classList.toggle('active',b.dataset.finish===design.finish));
  $$('.palette').forEach(b=>b.classList.toggle('active',palettes[b.dataset.palette][0]===p.primary&&palettes[b.dataset.palette][1]===p.base));
  $('#model-type').value=design.type;$('#model-side').value=design.side;$('#zone-hint').textContent=design.zone==='all'?'调整将应用于外观罩全部区域':`仅修改${design.zone==='upper'?'上':'下'}半部，其余图案保持不变`;
  $('#project-name').textContent=projectName;$('#design-count').textContent=versions.length;$('#version-total').textContent=versions.length+' 个版本';
  $('#undo').disabled=historyIndex<=0;$('#redo').disabled=historyIndex>=history.length-1;
  $('#brief-tags').replaceChildren(...[patternNames[p.pattern],p.density<35?'更多留白':'适中图案',design.zone==='all'?'整体设计':design.zone==='upper'?'上半部修改':'下半部修改'].map(t=>{const el=document.createElement('span');el.textContent=t;return el;}));
  $$('.version-card').forEach(b=>{b.classList.toggle('active',b.dataset.id===activeId);const dot=b.querySelector('.selected-dot');if(dot)dot.hidden=b.dataset.id!==activeId;});
}
function currentAppearance(){return design.zone==='all'?appearance(design):design.regions[design.zone]||appearance(design);}
function pushHistory(){const serialized=JSON.stringify(design);if(JSON.stringify(history[historyIndex])===serialized)return;history=history.slice(0,historyIndex+1);history.push(clone(design));if(history.length>60)history.shift();historyIndex=history.length-1;updateUI();persist();}
function setParameters(updates,record=true){
  if(design.zone==='all'){Object.assign(design,updates);design.regions={upper:null,lower:null};}
  else{design.regions[design.zone]={...currentAppearance(),...updates};}
  updateTexture();if(record)pushHistory();
}
function thumb(d){return textureCanvas(d,150).toDataURL('image/png');}
function renderVersions(){
  $('#version-list').replaceChildren();for(const v of versions){const button=document.createElement('button');button.className='version-card'+(v.id===activeId?' active':'');button.dataset.id=v.id;button.setAttribute('aria-label','应用版本：'+v.name);const img=document.createElement('img');img.className='version-thumb';img.src=thumb(v.design);img.alt='';const info=document.createElement('span');info.className='version-info';const b=document.createElement('b');b.textContent=v.name;const small=document.createElement('small');small.textContent=v.time;info.append(b,small);const dot=document.createElement('span');dot.className='selected-dot';if(v.id!==activeId)dot.hidden=true;button.append(img,info,dot);button.addEventListener('click',()=>applyVersion(v));$('#version-list').append(button);}updateUI();
}
function applyVersion(v){design=clone(v.design);activeId=v.id;projectName=v.name;pushHistory();rebuildModel();updateUI();renderVersions();persist();toast('已应用「'+v.name+'」');}
function saveVersion(name){const id='v'+Date.now();const v={id,name:name||'我的设计 '+(versions.length+1),design:clone(design),time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),created:Date.now()};versions.push(v);if(versions.length>25)versions.shift();activeId=id;renderVersions();persist();if(compare)rebuildModel();return v;}
function appendMessage(role,text,save=true,source=''){const message=document.createElement('div');message.className='message '+role;const label=document.createElement('div');label.className='message-label';label.textContent=role==='ai'?'✧  Coshape'+(source?' · '+source:''):'你';const body=document.createElement('div');body.className='message-body';body.textContent=text;message.append(label,body);$('#chat-messages').append(message);$('#chat-messages').scrollTop=$('#chat-messages').scrollHeight;if(save){messages.push({role,text,source});messages=messages.slice(-30);persist();}return message;}
function parsePrompt(text){
  if(/承重|接受腔|关节改造|改变结构|增大承重|控制机构|固定装置/.test(text))return {restricted:true};
  const result={updates:{},handled:false,description:[]};
  if(/上半|上面|上部/.test(text)){result.zone='upper';result.handled=true;result.description.push('修改上半部');}else if(/下半|下面|下部/.test(text)){result.zone='lower';result.handled=true;result.description.push('修改下半部');}else if(/全部|整体|整个/.test(text)){result.zone='all';result.handled=true;}
  const p=(result.zone&&result.zone!=='all'?design.regions[result.zone]:null)||currentAppearance();
  const colorWords=[[/红|red/i,'#c8102e','红色'],[/绿|植物色|forest/i,'#345e4c','绿色'],[/蓝|blue|海洋/,'#315f87','蓝色'],[/黑|墨色/,'#35363a','墨色'],[/橙|orange/i,'#cb784d','暖橙']];
  const hex=text.match(/#[0-9a-fA-F]{6}\b/);if(hex){result.updates.primary=hex[0];result.handled=true;result.description.push('替换图案色');}else for(const [test,color,label]of colorWords)if(test.test(text)){result.updates.primary=color;result.handled=true;result.description.push('使用'+label);break;}
  const patterns=[[/植物|叶子|花|自然/,'botanical'],[/几何|圆点|三角/,'geometric'],[/星|宇宙|涂鸦/,'stars'],[/流线|曲线|波浪|流动/,'flow']];for(const [test,value]of patterns)if(test.test(text)){result.updates.pattern=value;result.handled=true;result.description.push('采用'+patternNames[value]);break;}
  if(/白色多|白多|留白|简单|稀疏|少一点|简洁/.test(text)){result.updates.density=Math.max(15,p.density-15);result.handled=true;result.description.push('增加留白');}
  if(/丰富|密集|多一些图案|图案多|更密/.test(text)){result.updates.density=Math.min(85,p.density+15);result.handled=true;result.description.push('增加图案密度');}
  if(/细一点|小一点|缩小|变细/.test(text)){result.updates.scale=Math.max(50,p.scale-20);result.handled=true;result.description.push('缩小元素');}
  if(/大一点|放大|醒目/.test(text)){result.updates.scale=Math.min(160,p.scale+20);result.handled=true;result.description.push('放大元素');}
  const density=text.match(/(?:密度|疏密|覆盖率)[为到\s：:]*(\d+)/);if(density){result.updates.density=Math.min(85,Math.max(15,+density[1]));result.handled=true;result.description.push('调整图案疏密');}
  const rotate=text.match(/(?:旋转|倾斜)[为到\s：:]*(-?\d+)/);if(rotate){result.updates.rotation=Math.min(90,Math.max(-90,+rotate[1]));result.handled=true;result.description.push('旋转图案');}
  if(/哑光|亮光|缎面/.test(text)){result.finish=/哑光/.test(text)?'matte':/亮光/.test(text)?'gloss':'satin';result.handled=true;result.description.push('调整表面光泽');}
  if(/前臂|手臂/.test(text)){result.type='arm';result.handled=true;result.description.push('切换前臂模型');}else if(/小腿/.test(text)){result.type='leg';result.handled=true;}
  if(/三套|三种|不同方向|新方向/.test(text)){result.candidates=true;result.handled=true;}
  return result;
}
async function handleDemoPrompt(text){
  if(busy||!text.trim())return;text=text.trim().slice(0,600);appendMessage('user',text);$('#chat-input').value='';busy=true;$('#send-button').disabled=true;
  const pending=appendMessage('ai','正在解析修改意图…',false);await new Promise(r=>setTimeout(r,500));pending.remove();
  const parsed=parsePrompt(text);
  if(/撤销|上一版|恢复刚才/.test(text)){undo();appendMessage('ai','已恢复上一步设计。你可以在下方版本区继续比较或重新应用已保存方案。');}
  else if(parsed.restricted){appendMessage('ai','这项要求涉及结构或适配，需要义肢专业人员评估。当前工作台只编辑外观贴图，不改动承重部件、接受腔或关节。你可以继续描述想调整的颜色、图案或外观区域。');}
  else if(!parsed.handled){appendMessage('ai','当前是本地交互演示，还不能理解所有自由描述。可以试试「换成蓝色植物图案」「白色多一点」「只改上半部」或「生成三套不同方向」。右侧参数也能直接调整，结果会同步到模型。');}
  else{
    if(parsed.zone){design.zone=parsed.zone;updateUI();}if(parsed.finish)design.finish=parsed.finish;if(parsed.type)design.type=parsed.type;
    if(Object.keys(parsed.updates).length)setParameters(parsed.updates,false);
    pushHistory();if(parsed.type)rebuildModel();else updateTexture();
    if(parsed.candidates){const base=clone(design);const variants=[{name:'流线 · 自由',pattern:'flow',density:38},{name:'植物 · 生长',pattern:'botanical',density:45},{name:'几何 · 节奏',pattern:'geometric',density:30}];for(const v of variants){const candidate={...clone(base),pattern:v.pattern,density:v.density,zone:'all',regions:{upper:null,lower:null}};versions.push({id:'v'+Date.now()+v.pattern,name:v.name,design:candidate,time:'新候选',created:Date.now()});}renderVersions();persist();appendMessage('ai','已用当前配色准备三种程序化方向：流线、植物和几何。点击下方新版本即可应用到模型，再继续调整。');}
    else{saveVersion('共创修改 '+(versions.length+1));appendMessage('ai','已'+(parsed.description.length?parsed.description.join('，'):'更新设计范围')+'。'+(design.zone==='all'?'修改已显示在模型上。':'其余区域的图案保持不变。')+'\n已保存为新版本，可以随时比较或撤销。');}
  }
  busy=false;$('#send-button').disabled=false;persist();
}

function executeApiResult(result){
  if(result.action==='undo'){undo();return '已恢复上一步设计。';}
  if(result.action==='redo'){redo();return '已执行重做。';}
  if(result.action==='update'){
    const changes=sanitizeChanges(result.changes);if(!Object.keys(changes).length)return '没有可应用的参数，画布保持不变。';
    design=applyDesignChanges(design,changes);pushHistory();rebuildModel();updateUI();saveVersion('AI 共创 '+(versions.length+1));persist();return '已应用到画布，并保存为新版本。';
  }
  if(result.action==='candidates'){
    let count=0;for(const variant of (result.variants||[]).slice(0,3)){const changes=sanitizeChanges(variant.changes);if(!Object.keys(changes).length)continue;versions.push({id:'v'+Date.now()+'-'+count,name:String(variant.name||'AI 方案').slice(0,40),design:applyDesignChanges(design,changes),time:'AI 候选',created:Date.now()});count++;}
    if(versions.length>25)versions=versions.slice(-25);renderVersions();persist();return count?'已保存 '+count+' 套候选方案，点击下方版本即可预览。':'没有新增可用方案。';
  }
  return '';
}
async function handleApiPrompt(text){
  if(busy||apiConnection.isTesting||!text.trim())return;
  try{apiConnection.ready();}catch(error){toast(error.message);return;}
  text=text.trim().slice(0,2000);
  const previous=apiConnection.includeHistory?messages.slice(-10).map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text.slice(0,2000)})):[];
  while(previous.length&&new TextEncoder().encode(JSON.stringify(previous)).length>18000)previous.shift();
  while(previous.length&&previous[0].role!=='user')previous.shift();
  const snapshot=clone(design),snapshotText=JSON.stringify(snapshot),source=apiConnection.name;
  appendMessage('user',text);$('#chat-input').value='';busy=true;apiAbort=new AbortController();apiConnection.setBusy(true);$('#send-button').classList.add('is-stopping');$('#send-button').setAttribute('aria-label','停止生成');
  const pending=appendMessage('ai','正在等待模型回应…',false,source);
  try{
    const result=await apiConnection.request({mode:'chat',messages:[...previous,{role:'user',content:text}],design:snapshot},apiAbort.signal);
    pending.remove();const message=appendMessage('ai',result.reply||'模型已回应。',true,source);
    if(result.notice)appendMessage('ai',result.notice);
    if(result.action&&result.action!=='none'){
      if(JSON.stringify(design)!==snapshotText){const note=document.createElement('p');note.className='api-action-note';note.textContent='等待时你已调整画布，当前设计已保留。';const apply=document.createElement('button');apply.className='api-apply-button';apply.textContent='将 AI 建议应用到当前设计';apply.onclick=()=>{toast(executeApiResult(result));apply.disabled=true;apply.textContent='已应用';};message.append(note,apply);}
      else{const outcome=executeApiResult(result);if(outcome)appendMessage('ai',outcome);}
    }
  }catch(error){pending.remove();if(error.name==='AbortError')appendMessage('ai','已停止本次请求，当前画布保持不变。');else{apiConnection.showError(error.message);appendMessage('ai',error.message+'\n画布保持不变。你可以检查上方配置后重新发送。',true,source);$('#chat-input').value=text;}}
  finally{busy=false;apiAbort=null;apiConnection.setBusy(false);$('#send-button').classList.remove('is-stopping');$('#send-button').setAttribute('aria-label','发送设计想法');persist();}
}
function handlePrompt(text){if(busy){apiAbort?.abort();return;}if(apiConnection?.mode==='api')return handleApiPrompt(text);return handleDemoPrompt(text);}
function syncActiveVersion(){const matching=versions.findLast(v=>JSON.stringify(v.design)===JSON.stringify(design));activeId=matching?.id||'';}
function undo(){if(historyIndex<=0){toast('已经是最早的一步');return;}design=clone(history[--historyIndex]);syncActiveVersion();rebuildModel();updateUI();persist();toast('已撤销上一步修改');}
function redo(){if(historyIndex>=history.length-1)return;design=clone(history[++historyIndex]);syncActiveVersion();rebuildModel();updateUI();persist();toast('已重做');}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function showModal(html){lastFocused=document.activeElement;$('#modal-content').innerHTML=html;$('#modal-backdrop').hidden=false;$('#modal-close').focus();}
function closeModal(){$('#modal-backdrop').hidden=true;lastFocused?.focus();}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportTexture(){textureCanvas(design,2048).toBlob(blob=>{if(blob)downloadBlob(blob,'Coshape-texture-2048.png');},'image/png');toast('已导出 2048 × 2048 平面贴图');}
function exportPreview(){if(!renderer){toast('当前无法导出 3D 预览，可先导出平面贴图');return;}renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob)downloadBlob(blob,'Coshape-3D-preview.png');},'image/png');toast('已导出当前视角的 3D 预览图');}
function exportBrief(){const payload={product:'Coshape AI',project:projectName,exported_at:new Date().toISOString(),asset_kind:'exterior_design_concept',model:{type:design.type,side:design.side,source:'procedural_demo',dimensions_verified:false},design:clone(design),note:'外观贴图与数字预览概念。模型为程序化示意模型；不包含经验证的制造或临床适配数据。'};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),'Coshape-design-brief.json');toast('已导出设计参数与模型信息');}
function exportModal(){showModal(`<span class="eyebrow">TAKE YOUR IDEAS FURTHER</span><h2 id="modal-title">把你的设计带走</h2><p>保存创作成果，或交给专业设计人员继续沟通。</p><div class="export-options"><button class="export-option" id="download-texture"><svg><use href="#i-image"/></svg><span><b>平面图案贴图</b><small>PNG · 2048 × 2048 · 当前全部区域</small></span>↗</button><button class="export-option" id="download-preview"><svg><use href="#i-box"/></svg><span><b>3D 预览图片</b><small>PNG · 保留画布当前视角与对比状态</small></span>↗</button><button class="export-option" id="download-brief"><svg><use href="#i-download"/></svg><span><b>设计说明与参数</b><small>JSON · 配色、风格、区域和模型来源</small></span>↗</button></div><p class="modal-note">这些文件用于外观设计沟通。当前为示意模型，不是可直接制造或临床使用的适配文件。</p>`);$('#download-texture').onclick=exportTexture;$('#download-preview').onclick=exportPreview;$('#download-brief').onclick=exportBrief;}
function guideModal(){showModal(`<span class="eyebrow">A LITTLE GUIDE TO CO-CREATION</span><h2 id="modal-title">从想法，到你的设计</h2><p>无需建模经验。先试一试，再慢慢找到喜欢的样子。</p><div class="guide-step"><span>01</span><div><b>选择模型，表达想法</b><p>切换小腿或前臂示意模型。对话演示支持颜色、流线、植物、几何、星点、疏密、大小和上下区域等关键词。</p></div></div><div class="guide-step"><span>02</span><div><b>转一转，看见每一面</b><p>拖动旋转、滚轮缩放；键盘方向键也能旋转。使用右侧参数调整配色和图案，变化即时呈现。</p></div></div><div class="guide-step"><span>03</span><div><b>保留喜欢的版本</b><p>保存新版本，或点击候选方案。对比功能显示已保存的参考版本与当前设计，撤销可回到上一步。</p></div></div><div class="guide-step"><span>04</span><div><b>导出，继续共创</b><p>下载贴图、当前视角预览与设计说明。当前数据保存在浏览器中，可随时导出备份。</p></div></div><p class="modal-note">已支持多厂商文本模型 API。连接后可通过对话修改画布参数；图案仍由本地程序绘制，图片生成、上传、语音与专业协作暂未接入。</p>`);}
function designsModal(){showModal(`<span class="eyebrow">YOUR CREATIVE COLLECTION</span><h2 id="modal-title">我的设计</h2><p>保存在当前浏览器中的 ${versions.length} 个方案。选择一个，继续创作。</p><div class="saved-grid" id="saved-grid"></div>`);for(const v of versions){const b=document.createElement('button');b.className='saved-item';const img=document.createElement('img');img.src=thumb(v.design);img.alt='';const title=document.createElement('b');title.textContent=v.name;const small=document.createElement('small');small.textContent=(v.design.type==='leg'?'小腿义肢':'前臂义肢')+' · '+patternNames[v.design.pattern];b.append(img,title,small);b.onclick=()=>{applyVersion(v);closeModal();};$('#saved-grid').append(b);}}
function newProjectModal(){showModal(`<span class="eyebrow">A NEW POSSIBILITY</span><h2 id="modal-title">从哪里开始？</h2><p>选择一个外观模型。已有方案会继续保留在“我的设计”中。</p><div class="new-types"><button class="new-type" data-new-type="leg"><svg><use href="#i-box"/></svg><b>小腿义肢外观罩</b><p>自由探索流线、纹理与图案</p></button><button class="new-type" data-new-type="arm"><svg><use href="#i-spark"/></svg><b>前臂义肢外观罩</b><p>让你的日常表达延伸到指尖</p></button></div>`);$$('[data-new-type]').forEach(b=>b.onclick=()=>{design={...clone(defaults),type:b.dataset.newType};projectName=design.type==='leg'?'新的小腿设计':'新的前臂设计';compare=false;$('#compare-button').classList.remove('active');$('#compare-button').setAttribute('aria-pressed','false');$('#compare-labels').hidden=true;modelAngle=.24;tilt=0;zoom=1;pushHistory();saveVersion(projectName);rebuildModel();closeModal();toast('新画布已准备好');});}

function bindUI(){
  $('#chat-form').addEventListener('submit',e=>{e.preventDefault();handlePrompt($('#chat-input').value);});$('#chat-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();handlePrompt(e.target.value);}});$$('[data-prompt]').forEach(b=>b.onclick=()=>handlePrompt(b.dataset.prompt));
  $$('.pattern-option').forEach(b=>b.onclick=()=>setParameters({pattern:b.dataset.pattern}));
  for(const id of ['primary-color','base-color']){$('#'+id).addEventListener('input',e=>setParameters({[id==='primary-color'?'primary':'base']:e.target.value},false));$('#'+id).addEventListener('change',pushHistory);}
  $$('.palette').forEach(b=>b.onclick=()=>{const colors=palettes[b.dataset.palette];setParameters({primary:colors[0],base:colors[1]});});
  for(const key of ['density','scale','rotation']){$('#'+key).addEventListener('input',e=>{setParameters({[key]:+e.target.value},false);clearTimeout(changeTimer);changeTimer=setTimeout(pushHistory,350);});$('#'+key).addEventListener('change',pushHistory);}
  $$('[data-zone]').forEach(b=>b.onclick=()=>{design.zone=b.dataset.zone;updateUI();persist();toast(design.zone==='all'?'当前编辑整个外观罩':`当前只编辑${design.zone==='upper'?'上':'下'}半部`);});
  $$('[data-finish]').forEach(b=>b.onclick=()=>{design.finish=b.dataset.finish;updateTexture();pushHistory();});
  $('#model-type').onchange=e=>{design.type=e.target.value;pushHistory();rebuildModel();updateUI();persist();};$('#model-side').onchange=e=>{design.side=e.target.value;applyView();pushHistory();persist();};
  $$('.view-angle').forEach(b=>b.onclick=()=>{modelAngle={front:0,side:Math.PI/2,back:Math.PI}[b.dataset.angle];tilt=0;applyView();$$('.view-angle').forEach(el=>el.classList.toggle('active',el===b));});
  $('#auto-rotate').onclick=()=>{autoRotate=!autoRotate;$('#auto-rotate').classList.toggle('active',autoRotate);$('#auto-rotate').setAttribute('aria-pressed',autoRotate);};
  $('#wireframe').onclick=()=>{wireframe=!wireframe;if(model)model.userData.wire.visible=wireframe;if(compareModel)compareModel.userData.wire.visible=wireframe;$('#wireframe').classList.toggle('active',wireframe);$('#wireframe').setAttribute('aria-pressed',wireframe);};
  $('#zoom-in').onclick=()=>{zoom=Math.min(1.65,zoom+.13);applyView();};$('#zoom-out').onclick=()=>{zoom=Math.max(.65,zoom-.13);applyView();};$('#reset-view').onclick=()=>{modelAngle=.60;tilt=0;zoom=1;applyView();};
  $('#undo').onclick=undo;$('#redo').onclick=redo;$('#save-version').onclick=()=>{saveVersion();toast('已保存新版本，可在下方随时恢复');};
  $('#compare-button').onclick=()=>{compare=!compare;$('#compare-button').classList.toggle('active',compare);$('#compare-button').setAttribute('aria-pressed',compare);$('#compare-labels').hidden=!compare;rebuildModel();};
  $('#export-open').onclick=exportModal;$('#new-project').onclick=newProjectModal;$$('[data-nav]').forEach(b=>b.onclick=()=>{if(b.dataset.nav==='designs')designsModal();else if(b.dataset.nav==='guide')guideModal();else closeModal();});$('#parameter-help').onclick=guideModal;
  $('#profile-button').onclick=()=>{showModal(`<span class="eyebrow">YOUR DESIGN, YOUR CHOICE</span><h2 id="modal-title">你的本地创作空间</h2><p>项目、对话与版本保存在当前浏览器。开启 API 对话后，将经本站后端向你选择的厂商发送问题与当前外观参数；密钥只保留在页面内存中。换设备或清除浏览器数据后，设计不会自动同步。</p><p>你可以随时通过“导出设计”保存成果。站点访问权限由站点托管服务管理。</p><p class="modal-note">本原型不需要输入年龄、身体照片或测量数据，也不会根据年龄自动指定风格。</p>`);};
  $('#large-text').onclick=()=>{document.body.classList.toggle('large-text');$('#large-text').setAttribute('aria-pressed',document.body.classList.contains('large-text'));};
  $$('[data-panel]').forEach(b=>b.onclick=()=>{document.body.dataset.mobilePanel=b.dataset.panel;$$('[data-panel]').forEach(el=>{el.classList.toggle('active',el===b);el.setAttribute('aria-selected',el===b);});setTimeout(applyView,30);});
  $('#modal-close').onclick=closeModal;$('#modal-backdrop').onclick=e=>{if(e.target===$('#modal-backdrop'))closeModal();};
  document.addEventListener('keydown',e=>{if(!$('#modal-backdrop').hidden){if(e.key==='Escape')closeModal();if(e.key==='Tab'){const list=[...$('.modal').querySelectorAll('button,a,input,[tabindex="0"]')].filter(el=>!el.disabled),first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}});
}
startState();bindUI();apiConnection=initApiPanel({notify:toast});renderVersions();messages.forEach(m=>appendMessage(m.role,m.text,false,m.source));updateUI();init3D();persist();

