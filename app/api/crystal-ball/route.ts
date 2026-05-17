import { NextRequest, NextResponse } from 'next/server';

// 全局状态变量 - 水晶球占卜状态
let crystalBallState = {
  lastFortune: null as string | null,
  totalDivinations: 0,
  voiceEnabled: true,
  ledOn: false,
  lastTouchAt: null as string | null,
  fortuneHistory: [] as string[],
  lastProcessedAt: null as string | null
};

// 预定义的占卜结果库
const fortuneMessages = [
  "今日运势极佳，适合开始新的计划！",
  "星象显示，你将遇到意想不到的机遇。",
  "水晶球闪烁着智慧的光芒，相信你的直觉。",
  "神秘的符号暗示，改变就在眼前。",
  "命运的齿轮开始转动，好运即将降临。",
  "宇宙能量正向你聚集，保持积极心态。",
  "古老的预言将要应验，准备迎接惊喜。",
  "星辰指引着前路，勇敢向前迈进。",
  "魔法的大门即将开启，抓住每个机会。",
  "时间的流转带来转机，耐心等待结果。"
];

// MQTT命令发布 - 发布到 device/crystal-ball/cmd
async function publishCrystalBallCommand(command: string, data?: any) {
  try {
    const topic = 'device/crystal-ball/cmd';
    const payload = {
      command: command,
      device: 'crystal-ball-001',
      timestamp: new Date().toISOString(),
      ...data
    };

    console.log(`[CRYSTAL BALL] Publishing to MQTT Topic: ${topic}, Payload:`, payload);
    
    // 模拟MQTT发布成功
    console.log(`[MQTT SIMULATION] Published to ${topic}: ${command}`);
    
    return { 
      success: true, 
      message: 'Command published successfully',
      topic: topic,
      payload: payload
    };
    
  } catch (error) {
    console.error('MQTT publish error:', error);
    return { success: false, error: error.message };
  }
}

// 生成占卜结果
function generateFortune(): string {
  const randomIndex = Math.floor(Math.random() * fortuneMessages.length);
  return fortuneMessages[randomIndex];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, device_id } = body;
    
    if (!action) {
      return NextResponse.json(
        { error: 'No action provided' },
        { status: 400 }
      );
    }

    console.log(`[CRYSTAL BALL] Processing action: ${action} from device: ${device_id}`);

    let result = null;

    switch (action) {
      case 'start_divination':
        // 开始占卜流程
        const fortune = generateFortune();
        
        // 更新状态
        crystalBallState.lastFortune = fortune;
        crystalBallState.totalDivinations++;
        crystalBallState.lastTouchAt = new Date().toISOString();
        crystalBallState.lastProcessedAt = new Date().toISOString();
        
        // 添加到历史记录
        crystalBallState.fortuneHistory.unshift({
          fortune: fortune,
          timestamp: new Date().toISOString()
        });
        
        // 只保留最近10条记录
        if (crystalBallState.fortuneHistory.length > 10) {
          crystalBallState.fortuneHistory = crystalBallState.fortuneHistory.slice(0, 10);
        }
        
        // 如果启用了语音，发送语音播报命令
        let voiceResult = null;
        if (crystalBallState.voiceEnabled) {
          voiceResult = await publishCrystalBallCommand('play_voice', {
            text: fortune,
            language: 'zh-CN'
          });
        }
        
        // 控制LED效果
        await publishCrystalBallCommand('set_led', { state: true });
        
        result = {
          success: true,
          action: 'divination_completed',
          fortune: fortune,
          voice_enabled: crystalBallState.voiceEnabled,
          voice_result: voiceResult,
          total_divinations: crystalBallState.totalDivinations,
          timestamp: new Date().toISOString()
        };
        
        break;

      case 'toggle_voice':
        // 切换语音播报状态
        crystalBallState.voiceEnabled = !crystalBallState.voiceEnabled;
        
        const voiceState = crystalBallState.voiceEnabled ? 'enabled' : 'disabled';
        await publishCrystalBallCommand('toggle_voice', { state: voiceState });
        
        result = {
          success: true,
          action: 'voice_toggled',
          voice_enabled: crystalBallState.voiceEnabled,
          message: `Voice ${voiceState}`,
          timestamp: new Date().toISOString()
        };
        
        break;

      case 'set_led':
        // 控制LED灯
        const ledState = body.state !== undefined ? body.state : true;
        crystalBallState.ledOn = ledState;
        
        await publishCrystalBallCommand('set_led', { state: ledState });
        
        result = {
          success: true,
          action: 'led_set',
          led_state: ledState,
          message: `LED turned ${ledState ? 'on' : 'off'}`,
          timestamp: new Date().toISOString()
        };
        
        break;

      case 'get_status':
        // 获取当前状态
        result = {
          success: true,
          action: 'status_returned',
          status: {
            last_fortune: crystalBallState.lastFortune,
            total_divinations: crystalBallState.totalDivinations,
            voice_enabled: crystalBallState.voiceEnabled,
            led_on: crystalBallState.ledOn,
            last_touch_at: crystalBallState.lastTouchAt,
            last_processed_at: crystalBallState.lastProcessedAt
          },
          timestamp: new Date().toISOString()
        };
        
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown action', supported_actions: ['start_divination', 'toggle_voice', 'set_led', 'get_status'] },
          { status: 400 }
        );
    }

    console.log(`[CRYSTAL BALL] Action processed successfully:`, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[CRYSTAL BALL] Error:', error);
    return NextResponse.json(
      { 
        error: 'Crystal ball operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Crystal Ball API',
    description: '水晶球占卜控制接口',
    current_state: crystalBallState,
    endpoints: {
      POST: {
        description: '控制水晶球操作',
        parameters: {
          action: '操作类型 (start_divination|toggle_voice|set_led|get_status)',
          device_id: '设备ID (optional)',
          state: 'LED状态 (仅set_led操作需要)'
        },
        responses: {
          start_divination: {
            fortune: '占卜结果',
            voice_enabled: '语音播报是否启用',
            total_divinations: '总占卜次数'
          },
          toggle_voice: {
            voice_enabled: '语音播报状态'
          },
          set_led: {
            led_state: 'LED状态'
          }
        }
      }
    },
    mqtt_topics: {
      commands: 'device/crystal-ball/cmd',
      status: 'device/crystal-ball/status'
    },
    fortune_count: fortuneMessages.length,
    supported_actions: ['start_divination', 'toggle_voice', 'set_led', 'get_status']
  });
}