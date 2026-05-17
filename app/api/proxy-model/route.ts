import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('URL is required', { status: 400 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.statusText}`);
    }

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    
    // Some responses might not have the correct content type for GLB
    if (url.includes('.glb')) {
      headers.set('Content-Type', 'model/gltf-binary');
    }

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
