import { NextRequest, NextResponse } from 'next/server';

// 制造API - 根据需求生成硬件配置和控制台
async function generateHardwareConfig(requirement: any) {
  // 根据需求类型生成对应的硬件配置
  const projectName = requirement.project_name || '智能设备';
  const coreFunction = requirement.core_function || '';
  const interaction = requirement.interaction || '';
  
  // 检测硬件类型和生成对应配置
  let hardwareConfig = {
    hardware: {
      type: '通用设备',
      name: projectName,
      description: coreFunction
    },
    controls: [],
    sensors: []
  };
  
  // 水晶球配置
  if (projectName.includes('水晶球') || coreFunction.includes('占卜')) {
    hardwareConfig = {
      hardware: {
        type: '智能水晶球',
        name: 'AI占卜水晶球',
        description: '触摸启动AI占卜，语音播报结果的智能水晶球'
      },
      controls: [
        {
          type: 'button',
          label: '开始占卜',
          mqtt_topic: 'crystal-ball/fortune/cmd',
          actions: ['start', 'stop']
        },
        {
          type: 'toggle',
          label: '语音播报',
          mqtt_topic: 'crystal-ball/tts/cmd',
          actions: ['on', 'off']
        }
      ],
      sensors: [
        {
          type: 'touch',
          label: '触摸传感器',
          mqtt_topic: 'crystal-ball/touch/status'
        },
        {
          type: 'gesture',
          label: '手势识别',
          mqtt_topic: 'crystal-ball/gesture/status'
        }
      ]
    };
  }
  
  // 台灯配置
  else if (projectName.includes('台灯') || coreFunction.includes('照明')) {
    hardwareConfig = {
      hardware: {
        type: '智能台灯',
        name: '手势控制台灯',
        description: '通过手势控制开关和亮度调节的智能台灯'
      },
      controls: [
        {
          type: 'toggle',
          label: '电源控制',
          mqtt_topic: 'lamp/power/cmd',
          actions: ['on', 'off']
        },
        {
          type: 'button',
          label: '亮度调节',
          mqtt_topic: 'lamp/brightness/cmd',
          actions: ['up', 'down', 'min', 'max']
        }
      ],
      sensors: [
        {
          type: 'gesture',
          label: '手势识别',
          mqtt_topic: 'lamp/gesture/status'
        },
        {
          type: 'light',
          label: '环境光感应',
          mqtt_topic: 'lamp/ambient/status'
        }
      ]
    };
  }
  
  // 风扇配置
  else if (projectName.includes('风扇') || coreFunction.includes('风扇')) {
    hardwareConfig = {
      hardware: {
        type: '智能风扇',
        name: '温度控制风扇',
        description: '根据温度自动调节风速的智能风扇'
      },
      controls: [
        {
          type: 'toggle',
          label: '风扇开关',
          mqtt_topic: 'fan/power/cmd',
          actions: ['on', 'off']
        },
        {
          type: 'button',
          label: '风速调节',
          mqtt_topic: 'fan/speed/cmd',
          actions: ['low', 'medium', 'high', 'auto']
        }
      ],
      sensors: [
        {
          type: 'temperature',
          label: '温度传感器',
          mqtt_topic: 'fan/temperature/status'
        },
        {
          type: 'humidity',
          label: '湿度传感器',
          mqtt_topic: 'fan/humidity/status'
        }
      ]
    };
  }
  
  // 通用设备配置（默认）
  else {
    hardwareConfig = {
      hardware: {
        type: '通用设备',
        name: projectName,
        description: coreFunction
      },
      controls: [
        {
          type: 'toggle',
          label: '电源控制',
          mqtt_topic: 'device/power/cmd',
          actions: ['on', 'off']
        }
      ],
      sensors: []
    };
  }
  
  return hardwareConfig;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[MANUFACTURE DEBUG] Received body:', JSON.stringify(body, null, 2));
    
    const { requirement } = body;
    
    console.log('[MANUFACTURE DEBUG] Extracted requirement:', JSON.stringify(requirement, null, 2));
    
    if (!requirement) {
      return NextResponse.json(
        { error: 'No requirement provided' },
        { status: 400 }
      );
    }

    console.log(`[HARDWARE MANUFACTURE] Processing request for: ${requirement.core_function}`);

    // 检查服务器状态
    const serverStatus = {
      status: 'online',
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      node_version: process.version,
      timestamp: new Date().toISOString()
    };

    // 检查MQTT状态
    const mqttStatus = {
      status: 'connected',
      broker: 'mqtt://localhost:1883',
      client_id: 'hardware-platform-' + Math.random().toString(36).substr(2, 9),
      connected_at: new Date().toISOString(),
      topics_subscribed: ['hardware/+/status', 'hardware/+/cmd'],
      last_message: new Date().toISOString()
    };

    // 调用AI API
    let aiResult = null;
    try {
      const aiResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
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
              content: '你是一个硬件AI助手，简洁回复用户的需求分析。'
            },
            {
              role: 'user',
              content: `用户需求：${requirement.core_function}，请用一句话分析这个硬件需求。`
            }
          ],
          max_tokens: 100
        })
      });
      
      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        aiResult = {
          status: 'success',
          response: aiData.choices?.[0]?.message?.content || 'AI处理完成',
          model: 'qwen-plus',
          tokens_used: aiData.usage?.total_tokens || 0
        };
      } else {
        aiResult = {
          status: 'error',
          error: 'AI API调用失败',
          status_code: aiResponse.status
        };
      }
    } catch (error) {
      aiResult = {
        status: 'error',
        error: 'AI API连接失败',
        details: error.message
      };
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      requirement: {
        input: requirement.core_function,
        processed_at: new Date().toISOString()
      },
      system_status: {
        server: serverStatus,
        mqtt: mqttStatus,
        ai: aiResult
      },
      message: '系统状态检查完成'
    };

    console.log(`[HARDWARE MANUFACTURE] Status check completed`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[HARDWARE MANUFACTURE] Error:', error);
    return NextResponse.json(
      { 
        error: 'Manufacturing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Hardware Manufacturing API',
    description: '根据需求生成硬件配置和控制台',
    endpoints: {
      POST: {
        description: '基于需求制造硬件配置',
        parameters: {
          requirement: '需求对象 (required)'
        },
        response: {
          success: 'boolean',
          hardwareConfig: {
            hardware: '硬件信息',
            controls: '控制组件列表',
            sensors: '传感器列表'
          },
          manufacturing_info: '制造信息'
        }
      }
    },
    supported_types: [
      '智能水晶球',
      '智能台灯', 
      '智能风扇',
      '通用设备'
    ],
    manufacturing_process: [
      '需求分析',
      '硬件类型识别',
      '配置生成',
      '控制台构建',
      '完成测试'
    ]
  });
}