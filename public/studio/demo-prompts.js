export const DEMO_PROMPTS = [
  {label:'01 梵高 · 星空',mode:'生图',text:'生成一张适合义肢外观罩环绕使用的平面贴图，借鉴梵高《星空》的视觉语言：钴蓝、群青和靛蓝构成层层旋涡状夜空，清晰可见的厚涂油画笔触沿曲线流动，暖金黄色星光带有环形光晕。画面需边到边连续、元素分布均衡，不要单一中央焦点。不要村庄、柏树、地景、人物、文字、义肢模型、产品效果图、摄影宇宙或科幻霓虹感。'},
  {label:'02 北斋 · 浪里',mode:'生图',text:'生成一张适合义肢外观罩环绕使用的平面贴图，借鉴葛饰北斋《神奈川冲浪里》的视觉语言：普鲁士蓝与靛蓝海浪形成有力弧线，米白色浪花呈细密爪状轮廓，保留日式木版画的平涂色块、清晰线条与纸张纹理。将浪形组织为可连续环绕的节奏，不放置中央富士山。不要人物、船只、文字、印章、义肢模型或产品效果图。'},
  {label:'03 莫奈 · 睡莲',mode:'生图',text:'生成一张适合义肢外观罩环绕使用的平面贴图，借鉴莫奈《睡莲》的视觉语言：蓝绿水面、淡紫与粉白睡莲、柔和倒影交织，使用松散细碎的印象派笔触和自然的色彩过渡。画面边到边铺展，留出适度安静水面，让曲面包裹后仍然轻盈。不要池岸、桥梁、人物、文字、义肢模型或产品效果图。'},
  {label:'04 蒙德里安 · 构图',mode:'生图',text:'生成一张适合义肢外观罩环绕使用的平面贴图，借鉴蒙德里安《红、蓝、黄构图》的视觉语言：粗细有变化的黑色横竖线分割暖白底色，点缀高纯度红、蓝、黄矩形色块。结构应清晰、比例不对称且平衡，并考虑跨越义肢曲面时的连续衔接。不要斜线、渐变、阴影、文字、义肢模型或产品效果图。'},
];
export function initDemoPrompts(){
  const tabs=[...document.querySelectorAll('[data-compose-tab]')];
  for(const tab of tabs)tab.addEventListener('click',()=>{for(const b of tabs){const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}document.querySelector('#quick-prompts').hidden=tab.dataset.composeTab!=='quick';document.querySelector('#demo-prompts').hidden=tab.dataset.composeTab!=='demo';});
  const list=document.querySelector('#demo-prompt-list');
  for(const prompt of DEMO_PROMPTS){const button=document.createElement('button');button.type='button';button.className='demo-prompt';button.textContent=prompt.label;const badge=document.createElement('small');badge.textContent=prompt.mode;button.append(badge);button.title=prompt.text;button.onclick=()=>{const input=document.querySelector('#chat-input');input.value=prompt.text;const mode=document.querySelector('#creation-mode');mode.value=prompt.mode==='生图'?'image':'chat';mode.dispatchEvent(new Event('change'));input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();document.querySelector('#demo-prompt-status').textContent='已填入「'+prompt.label.slice(3)+'」，检查后点击发送。';};list.append(button);}
  for(const tab of tabs)tab.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const next=tabs.find(b=>b!==tab);next.click();next.focus();});
}
