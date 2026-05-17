import { NextRequest, NextResponse } from 'next/server';

// 硬件专家角色设定
const HARDWARE_ENGINEER_PROMPT = `你是一位资深硬件工程师，专精于物联网硬件设计和产品化。你的任务是：

1. 理解用户的硬件想法和需求
2. 设计完整的技术实现方案
3. 生成标准的BOM清单
4. 提供可直接部署的配置指令

请严格按照以下JSON格式返回结果，不要添加任何额外说明：

{
  "scenario": "详细的硬件交互逻辑说明，描述传感器输入与输出动作的映射关系",
  "bom_list": [
    {
      "category": "主控模块",
      "model": "具体型号",
      "quantity": 数量,
      "unit_price": 预估单价,
      "total_price": 小计,
      "description": "功能说明"
    }
  ],
  "config_payload": {
    "device_id": "设备唯一标识",
    "gesture_mapping": {
      "手势名称": {
        "trigger": "触发条件",
        "action": "执行动作",
        "parameters": {}
      }
    },
    "hardware_config": {
      "camera": {},
      "sensors": [],
      "actuators": []
    }
  }
}

参考硬件选型：
- 主控: 树莓派 4B (4GB) - ¥350
- 摄像头: Raspberry Pi Camera v2 - ¥150  
- 风扇: 5V USB小风扇 - ¥25
- 继电器: 5V单路继电器模块 - ¥12
- 传感器: 根据需求选择
- 杜邦线: 公对母杜邦线 - ¥5`;

// 调用通义千问API
async function callQwenAPI(userInput: string): Promise<any> {
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
            content: HARDWARE_ENGINEER_PROMPT
          },
          {
            role: 'user', 
            content: userInput
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';
    
    // 尝试解析JSON
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
    }
    
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('Qwen API error:', error);
    throw error;
  }
}

// 默认硬件配置模板
function getDefaultHardwareConfig(userInput: string) {
  const normalizedInput = userInput.toLowerCase();
  
  // 根据输入内容选择合适的默认配置
  if (normalizedInput.includes('风扇') || normalizedInput.includes('fan')) {
    return {
      scenario: "基于手势识别的风扇控制系统：用户通过摄像头手势来控制风扇的开关。👍点赞手势开启风扇，✋张开手掌关闭风扇，✌️胜利手势调节风速。",
      bom_list: [
        {
          category: "主控模块",
          model: "树莓派 4B (4GB)",
          quantity: 1,
          unit_price: 350,
          total_price: 350,
          description: "负责图像处理、手势识别和设备控制"
        },
        {
          category: "摄像头模块", 
          model: "Raspberry Pi Camera v2",
          quantity: 1,
          unit_price: 150,
          total_price: 150,
          description: "采集手势图像，支持1080p@30fps"
        },
        {
          category: "执行器",
          model: "5V USB小风扇",
          quantity: 1, 
          unit_price: 25,
          total_price: 25,
          description: "被控设备，USB供电"
        },
        {
          category: "继电器模块",
          model: "5V单路继电器模块",
          quantity: 1,
          unit_price: 12,
          total_price: 12,
          description: "控制风扇通断，支持树莓派GPIO"
        },
        {
          category: "连接线材",
          model: "公对母杜邦线",
          quantity: 1,
          unit_price: 5,
          total_price: 5,
          description: "连接树莓派与继电器模块"
        }
      ],
      config_payload: {
        device_id: "gesture_fan_controller_001",
        gesture_mapping: {
          "thumbs_up": {
            trigger: "检测到点赞手势，置信度>0.8",
            action: "turn_on",
            parameters: { "duration": 0 }
          },
          "open_palm": {
            trigger: "检测到张开手掌，置信度>0.8", 
            action: "turn_off",
            parameters: { "duration": 0 }
          },
          "peace_sign": {
            trigger: "检测到胜利手势，置信度>0.8",
            action: "toggle_speed",
            parameters: { "speed_levels": [0, 1, 2, 3] }
          }
        },
        hardware_config: {
          camera: {
            resolution: "640x480",
            fps: 30,
            "ai_service": "alibabacloud_vision"
          },
          sensors: [],
          actuators: [
            {
              type: "fan",
              pin: 18,
              "control_mode": "relay"
            }
          ]
        }
      }
    };
  }
  
  // 默认通用配置
  return {
    scenario: "通用手势控制设备：通过摄像头识别用户手势并执行相应的控制动作。支持点赞开启、张开手掌关闭、胜利手势切换状态。",
    bom_list: [
      {
        category: "主控模块",
        model: "树莓派 4B (4GB)",
        quantity: 1,
        unit_price: 350,
        total_price: 350,
        description: "核心控制单元"
      },
      {
        category: "摄像头模块",
        model: "Raspberry Pi Camera v2", 
        quantity: 1,
        unit_price: 150,
        total_price: 150,
        description: "手势识别输入设备"
      },
      {
        category: "继电器模块",
        model: "5V单路继电器模块",
        quantity: 1,
        unit_price: 12,
        total_price: 12,
        description: "设备开关控制"
      },
      {
        category: "连接线材",
        model: "公对母杜邦线",
        quantity: 1,
        unit_price: 5,
        total_price: 5,
        description: "硬件连接"
      }
    ],
    config_payload: {
      device_id: "gesture_controller_default",
      gesture_mapping: {
        "thumbs_up": {
          trigger: "点赞手势",
          action: "turn_on",
          parameters: {}
        },
        "open_palm": {
          trigger: "张开手掌", 
          action: "turn_off",
          parameters: {}
        }
      },
      hardware_config: {
        camera: {
          resolution: "640x480",
          fps: 30
        },
        sensors: [],
        actuators: []
      }
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idea } = body;
    
    if (!idea) {
      return NextResponse.json(
        { error: 'Missing required parameter: idea' },
        { status: 400 }
      );
    }

    console.log('Processing hardware idea:', idea);

    let result;
    
    try {
      // 尝试调用通义千问API
      result = await callQwenAPI(idea);
      console.log('AI generated hardware config');
    } catch (aiError) {
      console.log('AI API failed, using default config:', aiError);
      // 如果AI调用失败，使用默认配置
      result = getDefaultHardwareConfig(idea);
    }

    // 计算总成本
    const totalCost = result.bom_list.reduce((sum: number, item: any) => sum + item.total_price, 0);
    
    // 添加统计信息
    const enhancedResult = {
      ...result,
      metadata: {
        generated_at: new Date().toISOString(),
        input_idea: idea,
        total_cost: totalCost,
        item_count: result.bom_list.length,
        api_source: result.scenario.includes('通用') ? 'default_template' : 'qwen_ai'
      }
    };

    return NextResponse.json({
      success: true,
      data: enhancedResult
    });

  } catch (error) {
    console.error('Refine API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Hardware Refine API',
    description: '将用户想法转化为硬件设计方案',
    usage: {
      method: 'POST',
      endpoint: '/api/refine',
      body: {
        idea: "用户输入的硬件想法，例如：点赞开风扇"
      },
      response: {
        scenario: "硬件交互逻辑说明",
        bom_list: "BOM物料清单",
        config_payload: "MQTT配置指令"
      }
    }
  });
}