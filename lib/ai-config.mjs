export function managedChatConfig(env){
  if(!env?.COSHAPE_GATEWAY_API_KEY)throw new Error('AI 服务尚未配置，请稍后再试。');
  return {provider:'custom',protocol:'chat',baseUrl:env.COSHAPE_API_BASE_URL||'https://api.openai-next.com/v1',model:env.COSHAPE_CHAT_MODEL||'gpt-6.1-sol',apiKey:env.COSHAPE_GATEWAY_API_KEY};
}
export function managedImageConfig(env){
  const apiKey=env?.COSHAPE_IMAGE_API_KEY||env?.COSHAPE_GATEWAY_API_KEY;
  if(!apiKey)throw new Error('图案生成服务尚未配置，请稍后再试。');
  return {provider:'custom',protocol:'chat',baseUrl:env.COSHAPE_API_BASE_URL||'https://api.openai-next.com/v1',model:env.COSHAPE_IMAGE_MODEL||'gpt-image-2.5',apiKey};
}
