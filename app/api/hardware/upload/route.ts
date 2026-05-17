import { NextRequest, NextResponse } from 'next/server';
import DashScope from 'alibabacloud-dashscope';

// MQTT Client (需要在实际使用时初始化)
let mqttClient: any = null;

// 初始化 MQTT 客户端
function initMQTTClient() {
  if (!mqttClient) {
    const mqtt = require('mqtt');
    mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL);
    
    mqttClient.on('connect', () => {
      console.log('Connected to MQTT broker');
    });
    
    mqttClient.on('error', (error: Error) => {
      console.error('MQTT connection error:', error);
    });
  }
  return mqttClient;
}

// 分析图像并识别手势
async function analyzeImage(imageData: Buffer): Promise<{ gesture: string; confidence: number; action: string }> {
  try {
    const dashscope = new DashScope({
      apiKey: process.env.DASHSCOPE_API_KEY,
    });

    // 这里使用模拟的手势识别结果
    // 实际应用中需要调用阿里云 Vision API
    const gestures = [
      { name: 'thumbs_up', confidence: 0.95, action: 'turn_on', description: '👍 点赞' },
      { name: 'open_palm', confidence: 0.88, action: 'turn_off', description: '✋ 张开手掌' },
      { name: 'fist', confidence: 0.82, action: 'turn_off', description: '✊ 拳头' },
      { name: 'peace_sign', confidence: 0.91, action: 'toggle', description: '✌️ 胜利手势' }
    ];
    
    // 模拟AI识别过程
    await new Promise(resolve => setTimeout(resolve, 500));
    const result = gestures[Math.floor(Math.random() * gestures.length)];
    
    return {
      gesture: result.description,
      confidence: result.confidence,
      action: result.action
    };
  } catch (error) {
    console.error('Image analysis error:', error);
    throw new Error('Failed to analyze image');
  }
}

// 发布 MQTT 指令
async function publishCommand(deviceId: string, action: string) {
  try {
    const client = initMQTTClient();
    const topic = `${process.env.MQTT_TOPIC_COMMANDS}/${deviceId}`;
    const message = JSON.stringify({
      action: action,
      timestamp: new Date().toISOString(),
      deviceId: deviceId
    });
    
    await new Promise((resolve, reject) => {
      client.publish(topic, message, (err: Error) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
    
    console.log(`Published command to ${topic}: ${message}`);
  } catch (error) {
    console.error('MQTT publish error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const deviceId = (formData.get('deviceId') as string) || 'default-device';
    
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // 转换图像为 Buffer
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    
    // 分析图像
    const analysis = await analyzeImage(imageBuffer);
    
    // 发布控制指令
    await publishCommand(deviceId, analysis.action);
    
    return NextResponse.json({
      success: true,
      analysis: analysis,
      deviceId: deviceId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Upload processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Hardware API is running',
    endpoints: {
      upload: 'POST /api/hardware/upload - Upload image for gesture recognition',
      status: 'GET /api/hardware/status - Get hardware status'
    }
  });
}