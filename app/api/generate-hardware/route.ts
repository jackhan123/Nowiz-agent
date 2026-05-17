import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `你是一位资深硬件工程师，擅长嵌入式系统设计和硬件选型。

任务：基于用户输入"我想做一个[物品]"，生成详细硬件方案和 BOM 清单。

要求：
1. 推荐具体型号，不要泛泛而谈（例如："WS2812B-2020 幻彩灯珠"而非"LED"）
2. 考虑成本（面向创客/学生，单个项目总成本控制在 100-300 元）
3. 优先选择易采购、有中文资料、生态成熟的元件
4. 考虑可行性和实用性
5. BOM 要包含所有必需元件（连接线、螺丝、辅料等）
6. 价格基于 2024-2025 年淘宝/立创商城市场行情

输出格式（严格 JSON，不要有其他文字）：
{
  "solution": {
    "project_name": "项目名称",
    "overview": "方案概述（2-3句话，说明项目功能和特点）",
    "mcu": {
      "model": "具体型号（如 ESP32-S3-WROOM-1）",
      "reason": "选择理由（性能、功耗、成本、WiFi/蓝牙支持、生态等）"
    },
    "sensors": [
      {
        "name": "传感器名称",
        "model": "具体型号（如 DHT22）",
        "purpose": "用途说明"
      }
    ],
    "peripherals": [
      {
        "name": "外设名称",
        "model": "具体型号（如 0.96寸 OLED SSD1306）",
        "interface": "接口类型（I2C/SPI/UART/GPIO）"
      }
    ],
    "power": {
      "input": "输入方式（如 USB Type-C 5V）",
      "battery": "电池方案（如 18650锂电池 3.7V 2600mAh，或不需要电池）",
      "management": "电源管理芯片（如 TP4056 充电模块）"
    },
    "industrial_design": {
      "enclosure": "外壳材料和制作方式（如 3D打印PLA/激光切割亚克力）",
      "dimensions": "大概尺寸（mm）",
      "features": ["设计特点1", "设计特点2"]
    }
  },
  "bom_items": [
    {
      "category": "分类（主控芯片/传感器/显示模块/电源模块/结构件/辅料）",
      "part_name": "零件名称（具体型号）",
      "model": "完整型号",
      "spec": "关键规格参数",
      "function": "功能描述（在项目中的作用）",
      "quantity": 数量（整数）,
      "unit_price": 单价（浮点数，单位元）,
      "supplier": "推荐供应商（立创商城/淘宝/嘉立创）"
    }
  ],
  "total_cost": 总成本（浮点数），
  "difficulty": "制作难度（初级/中级/高级）",
  "assembly_time": "预计组装时间（如 2-4小时）"
}

示例（智能台灯）：
- 主控：ESP32-S3（支持 WiFi 调光）
- 传感器：BH1750 光照传感器
- 显示：0.96寸 OLED SSD1306
- 灯珠：WS2812B-2020 幻彩灯珠×10
- 电源：USB Type-C 5V 输入
- 外壳：3D 打印 PLA
- BOM 包含：杜邦线、M3螺丝、热缩管等辅料`;

// 设置路由最大执行时间为60秒（Next.js默认是10秒）
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: '请输入有效的项目描述' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const apiEndpoint = process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    const modelName = process.env.OPENAI_MODEL_NAME || 'gpt-4o';

    if (!apiKey) {
      return NextResponse.json(
        { error: '服务配置错误：未设置 API Key' },
        { status: 500 }
      );
    }

    // 创建带超时的AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55秒超时（略小于路由的60秒）

    try {
      // 调用 OpenAI API
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `我想做一个${prompt}` },
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenAI API 错误:', errorData);
        throw new Error(`AI 服务错误: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('AI 返回内容为空');
      }

      // 解析 JSON
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON 解析失败:', content);
        throw new Error('AI 返回格式错误');
      }

      // 验证必需字段
      if (!result.solution || !result.bom_items) {
        throw new Error('AI 返回数据不完整');
      }

      return NextResponse.json(result);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('请求超时，AI服务响应时间过长，请稍后重试');
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('生成硬件方案错误:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '生成失败，请重试',
      },
      { status: 500 }
    );
  }
}
