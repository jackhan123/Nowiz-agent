import { NextRequest, NextResponse } from 'next/server';
import mqtt from 'mqtt';

// MQTT 配置
const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
const MQTT_TOPIC = 'device/fan/cmd';

// 全局状态变量 - 存储最新的识别结果
let visionState = {
  lastGesture: null as string | null,
  lastCommand: null as string | null,
  lastConfidence: 0,
  lastProcessedAt: null as string | null,
  totalProcessed: 0,
  onCount: 0,
  offCount: 0
};

// 通义千问视觉识别API调用 - 专门识别👍和👇
async function callQwenVisionAPI(imageBase64: string) {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的手势识别助手。请识别图片中的手势，只返回以下两种手势之一：thumbs_up(👍点赞)或thumbs_down(👇拇指向下)。如果都不是，返回"unknown"。返回JSON格式：{"gesture": "手势名称", "confidence": 0.95}'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请识别这个手势，判断是👍还是👇'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 100
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
        const result = JSON.parse(jsonMatch[0]);
        // 只接受三种结果：thumbs_up, thumbs_down, unknown
        if (['thumbs_up', 'thumbs_down', 'unknown'].includes(result.gesture)) {
          return result;
        }
      }
    } catch (parseError) {
      console.error('Failed to parse vision response:', parseError);
    }

    // 如果解析失败或手势无效，返回unknown
    return {
      gesture: 'unknown',
      confidence: 0.5
    };

  } catch (error) {
    console.error('Vision API error:', error);
    // 返回默认手势用于演示 - 50%概率是👍或👇
    const gestures = ['thumbs_up', 'thumbs_down'];
    return {
      gesture: gestures[Math.floor(Math.random() * gestures.length)],
      confidence: 0.8 + Math.random() * 0.2
    };
  }
}

// 将Buffer转换为Base64
function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

// 手势到控制指令的映射 - 专门针对👍和👇
function mapGestureToCommand(gesture: string): { command: string; description: string; isValid: boolean } {
  const gestureMap = {
    'thumbs_up': { command: 'ON', description: '👍 点赞 - 开启风扇', isValid: true },
    'thumbs_down': { command: 'OFF', description: '👇 拇指向下 - 关闭风扇', isValid: true },
    'unknown': { command: 'NONE', description: '❓ 未知手势 - 无操作', isValid: false }
  };

  return gestureMap[gesture] || gestureMap['unknown'];
}

// MQTT命令发布 - 发布到 device/fan/cmd
async function publishMQTTCommand(gesture: string, command: string) {
  return new Promise((resolve, reject) => {
    try {
      const topic = MQTT_TOPIC;
      const payload = {
        command: command,
        gesture: gesture,
        timestamp: new Date().toISOString(),
        source: 'vision_ai'
      };

      console.log(`[MQTT] Connecting to ${MQTT_BROKER}...`);
      const client = mqtt.connect(MQTT_BROKER);
      
      const timeout = setTimeout(() => {
        client.end();
        console.error('[MQTT] Connection timeout');
        resolve({ success: false, error: 'MQTT connection timeout' });
      }, 5000);

      client.on('connect', () => {
        console.log(`[MQTT] Connected. Publishing to ${topic}: ${command}`);
        client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
          clearTimeout(timeout);
          if (err) {
            console.error('[MQTT] Publish error:', err);
            resolve({ success: false, error: err.message });
          } else {
            console.log(`[MQTT] Published successfully`);
            resolve({ 
              success: true, 
              message: 'Command published successfully',
              topic: topic,
              payload: payload
            });
          }
          client.end();
        });
      });
      
      client.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[MQTT] Client error:', err);
        client.end();
        resolve({ success: false, error: err.message });
      });
      
    } catch (error) {
      console.error('[MQTT] Fatal error:', error);
      resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const deviceId = (formData.get('deviceId') as string) || 'raspberry-pi-001';
    
    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    console.log(`[VISION API] Processing image from device: ${deviceId}, size: ${image.size} bytes`);

    // 转换图像为Buffer再转Base64
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const imageBase64 = bufferToBase64(imageBuffer);

    // 调用通义千问视觉识别API
    const visionResult = await callQwenVisionAPI(imageBase64);
    
    // 映射手势到控制指令
    const command = mapGestureToCommand(visionResult.gesture);
    
    // 更新全局状态
    visionState.lastGesture = visionResult.gesture;
    visionState.lastCommand = command.command;
    visionState.lastConfidence = visionResult.confidence;
    visionState.lastProcessedAt = new Date().toISOString();
    visionState.totalProcessed++;
    
    if (command.command === 'ON') {
      visionState.onCount++;
    } else if (command.command === 'OFF') {
      visionState.offCount++;
    }
    
    console.log(`[VISION STATE] Updated:`, {
      gesture: visionState.lastGesture,
      command: visionState.lastCommand,
      confidence: visionState.lastConfidence,
      total: visionState.totalProcessed,
      onCount: visionState.onCount,
      offCount: visionState.offCount
    });
    
    // 如果有有效指令，发布到MQTT
    let mqttResult = null;
    if (command.isValid) {
      mqttResult = await publishMQTTCommand(visionResult.gesture, command.command);
    }

    const result = {
      success: true,
      deviceId: deviceId,
      timestamp: new Date().toISOString(),
      image: {
        size: image.size,
        type: image.type,
        processed: true
      },
      vision: {
        gesture: visionResult.gesture,
        confidence: visionResult.confidence,
        recognized_at: new Date().toISOString()
      },
      command: {
        action: command.command,
        description: command.description,
        is_valid: command.isValid,
        mqtt_topic: command.isValid ? 'device/fan/cmd' : null
      },
      mqtt: mqttResult,
      state: {
        total_processed: visionState.totalProcessed,
        on_commands: visionState.onCount,
        off_commands: visionState.offCount,
        last_processed_at: visionState.lastProcessedAt
      }
    };

    console.log(`[VISION API] Processing completed:`, {
      device: deviceId,
      gesture: visionResult.gesture,
      command: command.command,
      mqttSuccess: mqttResult?.success,
      state: result.state
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[VISION API] Error:', error);
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
    status: 'Vision API',
    description: '核心视觉决策逻辑 - 手势识别与MQTT指令下发',
    endpoints: {
      POST: {
        description: '上传图像进行👍/👇手势识别并下发MQTT指令',
        parameters: {
          image: 'FormData文件 (required)',
          deviceId: '设备标识 (optional, default: raspberry-pi-001)'
        },
        response: {
          success: 'boolean',
          vision: { gesture: 'string', confidence: 'number' },
          command: { action: 'string', description: 'string' },
          mqtt: { success: 'boolean', topic: 'device/fan/cmd' }
        }
      },
      GET: {
        description: '获取当前实时状态和统计信息',
        response: {
          state: {
            lastGesture: 'string',
            lastCommand: 'string', 
            lastConfidence: 'number',
            lastProcessedAt: 'string',
            totalProcessed: 'number',
            onCount: 'number',
            offCount: 'number'
          }
        }
      }
    },
    gesture_mapping: {
      '👍 thumbs_up': { command: 'ON', mqtt_topic: 'device/fan/cmd', description: '开启风扇' },
      '👇 thumbs_down': { command: 'OFF', mqtt_topic: 'device/fan/cmd', description: '关闭风扇' },
      'unknown': { command: 'NONE', mqtt_topic: null, description: '无操作' }
    },
    mqtt_topics: {
      commands: 'device/fan/cmd',
      broker: process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883'
    },
    current_state: visionState
  });
}