// Public provider metadata and the validated editing vocabulary shared by UI and server.
export const PROVIDERS = [
  {id:'deepseek',name:'DeepSeek',protocol:'chat',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',docs:'https://api-docs.deepseek.com/'},
  {id:'openai',name:'OpenAI',protocol:'responses',baseUrl:'https://api.openai.com/v1',model:'gpt-4.1-mini',docs:'https://developers.openai.com/api/docs/guides/structured-outputs'},
  {id:'qwen',name:'通义千问 · 阿里云',protocol:'chat',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen-plus',docs:'https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope'},
  {id:'anthropic',name:'Claude · Anthropic',protocol:'anthropic',baseUrl:'https://api.anthropic.com/v1',model:'claude-sonnet-5-5',docs:'https://platform.claude.com/docs/en/api/messages/create'},
  {id:'custom',name:'其他兼容服务',protocol:'chat',baseUrl:'',model:'',docs:''},
];
const nullable = schema => ({anyOf:[schema,{type:'null'}]});
export const CHANGE_SCHEMA = {
  type:'object',additionalProperties:false,
  properties:{
    primary:nullable({type:'string',description:'图案色，#RRGGBB'}),
    base:nullable({type:'string',description:'底色，#RRGGBB'}),
    pattern:nullable({type:'string',enum:['flow','botanical','geometric','stars']}),
    density:nullable({type:'number',description:'图案疏密，15 至 85'}),
    scale:nullable({type:'number',description:'元素大小，50 至 160'}),
    rotation:nullable({type:'number',description:'图案角度，-90 至 90'}),
    zone:nullable({type:'string',enum:['all','upper','lower']}),
    finish:nullable({type:'string',enum:['matte','satin','gloss']}),
    type:nullable({type:'string',enum:['leg','arm']}),
  },
  required:['primary','base','pattern','density','scale','rotation','zone','finish','type'],
};
export const DESIGN_SCHEMA = {
  type:'object',additionalProperties:false,
  properties:{
    reply:{type:'string'},action:{type:'string',enum:['none','update','candidates','undo','redo']},changes:CHANGE_SCHEMA,
    variants:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},changes:CHANGE_SCHEMA},required:['name','changes']}},
  },required:['reply','action','changes','variants'],
};
export function sanitizeChanges(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const result={};
  for(const key of ['primary','base'])if(typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))result[key]=value[key].toLowerCase();
  for(const [key,min,max]of [['density',15,85],['scale',50,160],['rotation',-90,90]])if(typeof value[key]==='number'&&Number.isFinite(value[key])&&value[key]>=min&&value[key]<=max)result[key]=Math.round(value[key]);
  const enums={pattern:['flow','botanical','geometric','stars'],zone:['all','upper','lower'],finish:['matte','satin','gloss'],type:['leg','arm']};
  for(const [key,values]of Object.entries(enums))if(values.includes(value[key]))result[key]=value[key];
  return result;
}

export function applyDesignChanges(original,value){
  const d=JSON.parse(JSON.stringify(original)),changes=sanitizeChanges(value);
  if(changes.zone)d.zone=changes.zone;if(changes.type)d.type=changes.type;if(changes.finish)d.finish=changes.finish;
  const update={};for(const key of ['primary','base','pattern','density','scale','rotation'])if(key in changes)update[key]=changes[key];
  if(Object.keys(update).length){
    if(d.zone==='all'){Object.assign(d,update);d.regions={upper:null,lower:null};}
    else{d.regions ||= {upper:null,lower:null};const base={};for(const key of ['primary','base','pattern','density','scale','rotation','seed'])base[key]=d[key];d.regions[d.zone]={...base,...(d.regions[d.zone]||{}),...update};}
  }
  return d;
}
