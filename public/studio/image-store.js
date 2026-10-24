const loaded=new Map();
let dbPromise;
function db(){return dbPromise||=(new Promise((resolve,reject)=>{const req=indexedDB.open('coshape-media-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('textures');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}));}
async function put(id,dataUrl){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('textures','readwrite');tx.objectStore('textures').put(dataUrl,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function get(id){const database=await db();return new Promise((resolve,reject)=>{const req=database.transaction('textures').objectStore('textures').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function load(id,url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{loaded.set(id,image);resolve(image);};image.onerror=()=>reject(new Error('图案加载失败'));image.src=url;});}
export function textureImage(id){return loaded.get(id);}
export async function saveImageAsset(dataUrl,description){
  if(!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl))throw new Error('图片格式不受支持');
  const id='img-'+crypto.randomUUID();await load(id,dataUrl);let persisted=true;try{await put(id,dataUrl);}catch{persisted=false;}
  return {id,description:String(description||'').slice(0,2000),created:Date.now(),persisted};
}
export async function restoreImageAssets(designs){
  const ids=new Set();for(const d of designs){if(d?.imageTexture?.id)ids.add(d.imageTexture.id);for(const region of Object.values(d?.regions||{}))if(region?.imageTexture?.id)ids.add(region.imageTexture.id);}
  let missing=0;await Promise.all([...ids].map(async id=>{if(loaded.has(id))return;try{const url=await get(id);if(url)await load(id,url);else missing++;}catch{missing++;}}));return missing;
}
