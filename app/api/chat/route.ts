import { handleChatRequest } from '../../../lib/design-api.mjs';
import { getAiRuntime } from '../../../lib/ai-runtime-context';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handleChatRequest(request, { environment: getAiRuntime() }); }
