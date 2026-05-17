import { NextRequest, NextResponse } from 'next/server';

// 硬件需求理解API
async function callQwenTextAPI(userInput: string) {
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
            content: `你是一个智能硬件助手，帮助用户理解硬件需求并生成控制方案。

请根据用户输入，分析并返回JSON格式结果：
{
  "hardware": {
    "type": "硬件类型",
    "name": "项目名称",
    "description": "功能描述"
  },
  "controls": [
    {
      "type": "control_type",
      "label": "控制名称",
      "mqtt_topic": "MQTT主题",
      "actions": ["action1", "action2"]
    }
  ],
  "sensors": [
    {
      "type": "sensor_type", 
      "label": "传感器名称",
      "mqtt_topic": "MQTT主题"
    }
  ],
  "requirements": "技术需求总结"
}

硬件类型示例：风扇、LED灯、电机、扬声器、水晶球、智能开关等
控制类型示例：toggle（开关）、slider（滑块）、button（按钮）、status（状态显示）
传感器类型示例：gesture（手势识别）、temperature（温度）、light（光照）、voice（语音）

注意：返回纯JSON，不要加任何解释文字。`
          },
          {
            role: 'user',
            content: userInput
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 尝试解析JSON响应
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
    }

    // 默认响应
    return {
      hardware: {
        type: "通用设备",
        name: "智能项目",
        description: "用户自定义智能硬件项目"
      },
      controls: [
        {
          type: "toggle",
          label: "电源控制",
          mqtt_topic: "device/power/cmd",
          actions: ["on", "off"]
        }
      ],
      sensors: [],
      requirements: "基础智能控制功能"
    };

  } catch (error) {
    console.error('AI API error:', error);
    return {
      hardware: {
        type: "通用设备",
        name: "智能项目", 
        description: "智能硬件项目"
      },
      controls: [
        {
          type: "toggle",
          label: "电源控制",
          mqtt_topic: "device/power/cmd",
          actions: ["on", "off"]
        }
      ],
      sensors: [],
      requirements: "基础控制功能"
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

    console.log(`[AI CHAT] Processing message: ${message}`);

    // 调用AI分析用户需求
    const aiResult = await callQwenTextAPI(message);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      user_message: message,
      ai_analysis: aiResult,
      response: `我理解了您的需求：${aiResult.hardware.description}

硬件类型：${aiResult.hardware.type}
控制组件：${aiResult.controls.length}个
${aiResult.sensors.length > 0 ? `传感器：${aiResult.sensors.length}个` : ''}

已为您生成控制台界面，可以开始测试了！`
    };

    console.log(`[AI CHAT] Analysis completed:`, {
      hardware: aiResult.hardware.type,
      controls: aiResult.controls.length,
      sensors: aiResult.sensors.length
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[AI CHAT] Error:', error);
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
    status: 'AI Chat API',
    description: '智能硬件需求理解和方案生成',
    endpoints: {
      POST: {
        description: '发送硬件需求描述，获取AI分析和控制方案',
        parameters: {
          message: '用户需求描述 (required)',
          context: '对话上下文 (optional)'
        },
        response: {
          success: 'boolean',
          ai_analysis: {
            hardware: '硬件信息',
            controls: '控制组件列表',
            sensors: '传感器列表',
            requirements: '技术需求'
          }
        }
      }
    },
    examples: [
      "我要制作一个智能水晶球，水晶球在识别到手势以后可以给我语音播放占卜的结果",
      "制作一个智能台灯，通过手势控制开关和亮度调节",
      "想要一个智能风扇，根据温度自动调节风速"
    ]
  });
}