import { handleChatRequest } from '../../../lib/design-api.mjs';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handleChatRequest(request); }
