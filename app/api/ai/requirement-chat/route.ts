import { NextRequest, NextResponse } from 'next/server';

// AI需求理解和引导API
async function callQwenRequirementAPI(userInput: string, context: string) {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: `你是一位资深硬件产品经理，擅长通过对话引导用户完善硬件需求。

你的任务是：
1. 理解用户当前的硬件需求描述
2. 判断需求是否完整（包含核心功能、外观形态、交互方式、特殊需求）
3. 如果不完整，继续询问缺失的信息
4. 如果完整，确认需求并输出完整的需求JSON

需求完整判断标准：
- 核心功能：明确知道这个产品要实现什么功能
- 外观形态：知道产品的外观和形状特征
- 交互方式：了解用户如何与产品互动
- 特殊需求：了解额外的技术或功能要求

对话策略：
- 保持友好专业的语气
- 一次只询问1-2个关键问题
- 适时给出参考案例帮助用户理解
- 当需求基本完整时，主动总结确认

输出格式：
如果需求不完整，直接返回对话回复
如果需求完整，返回：
COMPLETE: 需求已完整理解

{
  "status": "completed",
  "project_name": "项目名称",
  "core_function": "核心功能描述",
  "form_spec": "外观形态描述", 
  "interaction": "交互方式描述",
  "additional": "特殊需求描述",
  "difficulty": "实现难度评估",
  "estimated_time": "预估实现时间"
}`
          },
          {
            role: 'user',
            content: `对话历史：\n${context}\n\n当前输入：${userInput}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`[AI REQUIREMENT] Response: ${content}`);
    
    // 检查是否包含COMPLETE标记
    if (content.includes('COMPLETE:')) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const requirementData = JSON.parse(jsonMatch[0]);
          return {
            isComplete: true,
            response: content.split('\n')[0], // 取第一行作为回复
            requirement: requirementData
          };
        }
      } catch (parseError) {
        console.error('Failed to parse requirement JSON:', parseError);
      }
    }
    
    // 普通对话回复
    return {
      isComplete: false,
      response: content,
      requirement: null
    };

  } catch (error) {
    console.error('AI requirement API error:', error);
    return {
      isComplete: false,
      response: '抱歉，我现在有点困惑。你能再详细描述一下吗？',
      requirement: null
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: 'No message provided' },
        { status: 400 }
      );
    }

    console.log(`[AI REQUIREMENT] Processing message: ${message}`);

    // 调用AI分析用户需求
    const aiResult = await callQwenRequirementAPI(message, context);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      user_message: message,
      isComplete: aiResult.isComplete,
      response: aiResult.response,
      requirement: aiResult.requirement
    };

    console.log(`[AI REQUIREMENT] Analysis completed:`, {
      isComplete: aiResult.isComplete,
      hasRequirement: !!aiResult.requirement
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[AI REQUIREMENT] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'AI Requirement Chat API',
    description: '智能硬件需求理解和引导对话',
    endpoints: {
      POST: {
        description: '与AI对话，逐步完善硬件需求',
        parameters: {
          message: '用户输入 (required)',
          context: '对话历史上下文 (optional)'
        },
        response: {
          success: 'boolean',
          isComplete: 'boolean',
          response: 'AI回复',
          requirement: '需求对象（完成时）'
        }
      }
    },
    features: [
      '智能需求理解',
      '对话式引导',
      '完整性判断',
      '需求结构化输出'
    ],
    examples: [
      '我想做一个水晶球，可以实现触摸开始AI占卜，占卜完以后可以把结果语音播报出来',
      '制作一个智能台灯，通过手势控制开关和亮度调节',
      '想要一个智能风扇，根据温度自动调节风速'
    ]
  });
}