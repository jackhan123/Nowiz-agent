import { handleImageRequest } from '../../../lib/image-api.mjs';
import { getAiRuntime } from '../../../lib/ai-runtime-context';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handleImageRequest(request,{environment:getAiRuntime()}); }
