import { NextRequest, NextResponse } from 'next/server';

const MESHY_API_KEY = process.env.MESHY_API_KEY;
const MESHY_API_URL = 'https://api.meshy.ai/openapi/v2/text-to-3d';

export async function POST(req: NextRequest) {
  try {
    if (!MESHY_API_KEY) {
      return NextResponse.json({ error: 'MESHY_API_KEY is not configured' }, { status: 500 });
    }

    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 1. 发起任务 (使用 preview 模式，生成速度较快，且直接指定目标格式包含 stl)
    const response = await fetch(MESHY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'preview',
        prompt: prompt,
        ai_model: 'meshy-6', // Update to the supported version
        should_remesh: false, // For meshy-6, should_remesh should typically be false according to API docs
        topology: 'triangle',
        target_formats: ['stl', 'glb', 'obj'] // 要求返回 STL 等格式
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meshy API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // data.result 包含了 task_id
    return NextResponse.json({ taskId: data.result });

  } catch (error: any) {
    console.error('Meshy API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 通过查询参数 taskId 来轮询任务状态
export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const response = await fetch(`${MESHY_API_URL}/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meshy API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Meshy API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
