import { NextRequest, NextResponse } from 'next/server';

// 硬件模板定义
const hardwareTemplates = {
  'crystal_ball': {
    name: 'AI占卜水晶球',
    description: '触摸启动AI占卜，语音播报结果的水晶球',
    sensors: ['touch_sensor'],
    actuators: ['led_lights', 'voice_speaker'],
    pythonCode: `
#!/usr/bin/env python3
"""
水晶球占卜模拟器
模拟触摸传感器、LED灯和语音播报功能
"""

import time
import random
import requests
import json
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: paho-mqtt not installed. Please run: pip install paho-mqtt")
    exit(1)

class CrystalBallSimulator:
    def __init__(self):
        self.device_id = "crystal-ball-001"
        self.server_url = "http://localhost:3000/api/crystal-ball"
        self.mqtt_broker = "broker.emqx.io"
        self.mqtt_port = 1883
        self.mqtt_topic = "device/crystal-ball/cmd"
        self.touch_state = False
        self.led_on = False
        self.fortune_messages = [
            "今日运势极佳，适合开始新的计划！",
            "星象显示，你将遇到意想不到的机遇。",
            "水晶球闪烁着智慧的光芒，相信你的直觉。",
            "神秘的符号暗示，改变就在眼前。",
            "命运的齿轮开始转动，好运即将降临。"
        ]
        
        print(f"🔮 Crystal Ball initialized")
        print(f"🌐 Server URL: {self.server_url}")
        print(f"📡 MQTT Topic: {self.mqtt_topic}")
        print("=" * 50)

    def setup_mqtt(self):
        """设置MQTT客户端"""
        try:
            self.mqtt_client = mqtt.Client(client_id=self.device_id)
            self.mqtt_client.on_connect = self._on_mqtt_connect
            self.mqtt_client.on_message = self._on_mqtt_message
            
            self.mqtt_client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.mqtt_client.loop_start()
            
            print(f"✅ MQTT connected to {self.mqtt_broker}:{self.mqtt_port}")
            return True
            
        except Exception as e:
            print(f"❌ MQTT connection failed: {e}")
            return False

    def _on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT连接回调"""
        if rc == 0:
            print(f"✅ MQTT Connected successfully")
            client.subscribe(self.mqtt_topic)
            print(f"📡 Subscribed to topic: {self.mqtt_topic}")
        else:
            print(f"❌ MQTT connection failed with code {rc}")

    def _on_mqtt_message(self, client, userdata, msg):
        """MQTT消息接收回调"""
        try:
            payload = json.loads(msg.payload.decode())
            command = payload.get('command', '').lower()
            
            print(f"\\n📨 Received MQTT Message: {command}")
            
            if command == "start_divination":
                self.start_divination()
            elif command == "toggle_voice":
                self.toggle_voice()
            else:
                print(f"❓ Unknown command: {command}")
                
        except Exception as e:
            print(f"❌ Error processing MQTT message: {e}")

    def simulate_touch_sensor(self):
        """模拟触摸传感器"""
        # 模拟随机触摸检测
        if random.random() > 0.7:  # 30%概率检测到触摸
            return True
        return False

    def start_divination(self):
        """开始占卜流程"""
        print("\\n🔮 开始占卜...")
        self.set_led(True)
        time.sleep(2)
        
        # 随机选择占卜结果
        fortune = random.choice(self.fortune_messages)
        print(f"📜 占卜结果: {fortune}")
        
        # 模拟语音播报
        self.play_voice(fortune)
        
        # 发送到服务器
        self.send_divination_result(fortune)

    def set_led(self, state):
        """控制LED灯"""
        self.led_on = state
        status = "ON" if state else "OFF"
        print(f"💡 LED {status}")
        
        # 发送LED状态到MQTT
        self.publish_status("led", status)

    def play_voice(self, text):
        """模拟语音播报"""
        print(f"🔊 语音播报: {text}")
        
        # 发送语音状态到MQTT
        self.publish_status("voice", text)

    def publish_status(self, component, value):
        """发布状态到MQTT"""
        try:
            payload = {
                device: self.device_id,
                component: component,
                value: value,
                timestamp: datetime.now().isoformat()
            }
            
            if self.mqtt_client:
                self.mqtt_client.publish(self.mqtt_topic, json.dumps(payload))
                print(f"📡 MQTT Published: {component} -> {value}")
        except Exception as e:
            print(f"❌ MQTT publish failed: {e}")

    def send_divination_result(self, fortune):
        """发送占卜结果到服务器"""
        try:
            data = {
                device_id: self.device_id,
                fortune: fortune,
                timestamp: datetime.now().isoformat()
            }
            
            response = requests.post(self.server_url, json=data, timeout=10)
            if response.status_code == 200:
                print(f"✅ Divination result sent successfully")
            else:
                print(f"❌ Failed to send result: {response.status_code}")
        except Exception as e:
            print(f"❌ Error sending result: {e}")

    def toggle_voice(self):
        """切换语音播报状态"""
        print("🔄 Voice toggle command received")

    def run(self):
        """运行主循环"""
        print(f"🚀 Starting Crystal Ball Simulator")
        print("Press Ctrl+C to stop")
        print("=" * 50)

        # 设置MQTT连接
        self.setup_mqtt()
        
        try:
            while True:
                # 模拟触摸检测
                if self.simulate_touch_sensor():
                    if not self.touch_state:
                        print("👆 Touch detected!")
                        self.start_divination()
                        self.touch_state = True
                else:
                    self.touch_state = False
                
                time.sleep(1)
                
        except KeyboardInterrupt:
            print(f"\\n🛑 Stopping Crystal Ball...")
            if self.mqtt_client:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
            print("👋 Crystal Ball stopped!")

def main():
    simulator = CrystalBallSimulator()
    simulator.run()

if __name__ == "__main__":
    main()
`,
    mqtt_topics: {
      commands: 'device/crystal-ball/cmd',
      status: 'device/crystal-ball/status'
    }
  },
  'smart_lamp': {
    name: '手势控制台灯',
    description: '通过手势控制开关和亮度调节的智能台灯',
    sensors: ['camera', 'light_sensor'],
    actuators: ['led_lights'],
    pythonCode: `
#!/usr/bin/env python3
"""
智能台灯模拟器
模拟手势控制和环境光感应
"""

import os
import time
import subprocess
import requests
import json
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: paho-mqtt not installed. Please run: pip install paho-mqtt")
    exit(1)

class SmartLampSimulator:
    def __init__(self):
        self.device_id = "smart-lamp-001"
        self.server_url = "http://localhost:3000/api/smart-lamp"
        self.mqtt_broker = "broker.emqx.io"
        self.mqtt_port = 1883
        self.mqtt_topic = "device/smart-lamp/cmd"
        self.snap_file = "lamp_snap.jpg"
        self.upload_interval = 2
        self.lamp_on = False
        self.brightness = 50  # 0-100
        
        print(f"💡 Smart Lamp initialized")
        print(f"🌐 Server URL: {self.server_url}")
        print(f"📡 MQTT Topic: {self.mqtt_topic}")
        print("=" * 50)

    def setup_mqtt(self):
        """设置MQTT客户端"""
        try:
            self.mqtt_client = mqtt.Client(client_id=self.device_id)
            self.mqtt_client.on_connect = self._on_mqtt_connect
            self.mqtt_client.on_message = self._on_mqtt_message
            
            self.mqtt_client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.mqtt_client.loop_start()
            
            print(f"✅ MQTT connected to {self.mqtt_broker}:{self.mqtt_port}")
            return True
            
        except Exception as e:
            print(f"❌ MQTT connection failed: {e}")
            return False

    def _on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT连接回调"""
        if rc == 0:
            print(f"✅ MQTT Connected successfully")
            client.subscribe(self.mqtt_topic)
            print(f"📡 Subscribed to topic: {self.mqtt_topic}")
        else:
            print(f"❌ MQTT connection failed with code {rc}")

    def _on_mqtt_message(self, client, userdata, msg):
        """MQTT消息接收回调"""
        try:
            payload = json.loads(msg.payload.decode())
            command = payload.get('command', '').lower()
            
            print(f"\\n📨 Received MQTT Message: {command}")
            
            if command == "on":
                self.set_lamp(True)
            elif command == "off":
                self.set_lamp(False)
            elif command in ["up", "down", "min", "max"]:
                self.adjust_brightness(command)
            else:
                print(f"❓ Unknown command: {command}")
                
        except Exception as e:
            print(f"❌ Error processing MQTT message: {e}")

    def capture_photo(self):
        """使用FFmpeg抓拍照片"""
        try:
            ffmpeg_cmd = [
                "ffmpeg", "-f", "avfoundation", "-i", "0",
                "-vframes", "1", "-s", "320x240", "-y", self.snap_file
            ]
            
            result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                print(f"✅ Photo captured: {self.snap_file}")
                return True
            else:
                print(f"❌ FFmpeg failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Capture error: {e}")
            return False

    def upload_photo(self):
        """上传照片到服务器进行手势识别"""
        try:
            with open(self.snap_file, 'rb') as f:
                files = {'image': (self.snap_file, f, 'image/jpeg')}
                data = {'deviceId': self.device_id}
                
                response = requests.post(
                    f"{self.server_url}/vision",
                    files=files,
                    data=data,
                    timeout=15
                )

            if response.status_code == 200:
                result = response.json()
                command = result.get('command', {}).get('action', '')
                
                if command in ["on", "off"]:
                    self.set_lamp(command == "on")
                
                print(f"✅ Gesture processed: {command}")
                return True
            else:
                print(f"❌ Upload failed: HTTP {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Upload error: {e}")
            return False

    def set_lamp(self, state):
        """控制台灯开关"""
        self.lamp_on = state
        status = "ON" if state else "OFF"
        
        if state:
            print("\\n" + "="*50)
            print("💡💡💡 SMART LAMP ON 💡💡💡")
            print("      🌟 ILLUMINATING 🌟")
            print("💡💡💡💡💡💡💡💡💡💡💡💡💡")
            print("="*50)
        else:
            print("\\n" + "="*50)
            print("❌ SMART LAMP OFF")
            print("      💤 IN DARKNESS 💤")
            print("⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕")
            print("="*50)
        
        self.publish_status("power", status)

    def adjust_brightness(self, direction):
        """调节亮度"""
        if direction == "up":
            self.brightness = min(100, self.brightness + 25)
        elif direction == "down":
            self.brightness = max(0, self.brightness - 25)
        elif direction == "min":
            self.brightness = 10
        elif direction == "max":
            self.brightness = 100
        
        print(f"🔆 Brightness: {self.brightness}%")
        self.publish_status("brightness", self.brightness)

    def publish_status(self, component, value):
        """发布状态到MQTT"""
        try:
            payload = {
                device: self.device_id,
                component: component,
                value: value,
                timestamp: datetime.now().isoformat()
            }
            
            if self.mqtt_client:
                self.mqtt_client.publish(self.mqtt_topic, json.dumps(payload))
                print(f"📡 MQTT Published: {component} -> {value}")
        except Exception as e:
            print(f"❌ MQTT publish failed: {e}")

    def run(self):
        """运行主循环"""
        print(f"🚀 Starting Smart Lamp Simulator")
        print(f"⏰ Gesture check interval: {self.upload_interval} seconds")
        print("Press Ctrl+C to stop")
        print("=" * 50)

        self.setup_mqtt()
        
        try:
            cycle_count = 0
            while True:
                cycle_count += 1
                print(f"\\n🔄 Cycle #{cycle_count}")
                
                # 抓拍和手势识别
                if self.capture_photo():
                    self.upload_photo()
                    
                    # 清理照片
                    if os.path.exists(self.snap_file):
                        os.remove(self.snap_file)
                
                time.sleep(self.upload_interval)
                
        except KeyboardInterrupt:
            print(f"\\n🛑 Stopping Smart Lamp...")
            if self.mqtt_client:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
            print("👋 Smart Lamp stopped!")

def main():
    simulator = SmartLampSimulator()
    simulator.run()

if __name__ == "__main__":
    main()
`,
    mqtt_topics: {
      commands: 'device/smart-lamp/cmd',
      status: 'device/smart-lamp/status'
    }
  },
  'gesture_fan': {
    name: '手势控制风扇',
    description: '通过摄像头手势识别控制风扇开关',
    sensors: ['camera'],
    actuators: ['motor'],
    pythonCode: `#!/usr/bin/env python3
"""
手势控制风扇模拟器
使用摄像头抓拍并通过服务器识别手势来控制风扇
"""

import os
import sys
import platform
import subprocess
import time
import requests
import json
from datetime import datetime

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: paho-mqtt not installed. Please run: pip install paho-mqtt")
    sys.exit(1)

class GestureFanSimulator:
    def __init__(self):
        self.system = platform.system()
        self.device_id = f"gesture-fan-{self.system.lower()}"
        self.server_url = "http://localhost:3000/api/vision"
        self.mqtt_broker = "broker.emqx.io"
        self.mqtt_port = 1883
        self.mqtt_topic = "device/fan/cmd"
        self.snap_file = "fan_snap.jpg"
        self.upload_interval = 2
        self.fan_on = False
        
        print(f"🌀 Gesture Fan Simulator initialized")
        print(f"🌐 Server URL: {self.server_url}")
        print(f"📡 MQTT Topic: {self.mqtt_topic}")
        print("=" * 50)

    def setup_mqtt(self):
        """设置MQTT客户端"""
        try:
            self.mqtt_client = mqtt.Client(client_id=self.device_id)
            self.mqtt_client.on_connect = self._on_mqtt_connect
            self.mqtt_client.on_message = self._on_mqtt_message
            
            self.mqtt_client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.mqtt_client.loop_start()
            
            print(f"✅ MQTT connected to {self.mqtt_broker}:{self.mqtt_port}")
            return True
        except Exception as e:
            print(f"❌ MQTT connection failed: {e}")
            return False

    def _on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"✅ MQTT Connected successfully")
            client.subscribe(self.mqtt_topic)
        else:
            print(f"❌ MQTT connection failed with code {rc}")

    def _on_mqtt_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            command = payload.get('command', '').upper()
            print(f"\\n📨 Received Command: {command}")
            
            if command == "ON":
                self.set_fan(True)
            elif command == "OFF":
                self.set_fan(False)
        except Exception as e:
            print(f"❌ Error processing message: {e}")

    def capture_photo(self):
        """抓拍照片"""
        try:
            if self.system == "Darwin":  # macOS
                cmd = ["ffmpeg", "-f", "avfoundation", "-i", "0", "-vframes", "1", "-s", "320x240", "-y", self.snap_file]
            elif self.system == "Windows":
                cmd = ["ffmpeg", "-f", "dshow", "-i", "video=Integrated Camera", "-vframes", "1", "-s", "320x240", "-y", self.snap_file]
            else:
                cmd = ["ffmpeg", "-f", "v4l2", "-i", "/dev/video0", "-vframes", "1", "-s", "320x240", "-y", self.snap_file]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except Exception as e:
            print(f"❌ Capture error: {e}")
            return False

    def upload_photo(self):
        """上传并识别手势"""
        try:
            with open(self.snap_file, 'rb') as f:
                files = {'image': (self.snap_file, f, 'image/jpeg')}
                response = requests.post(self.server_url, files=files, data={'deviceId': self.device_id}, timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                cmd = result.get('command', {}).get('action', '').upper()
                if cmd in ["ON", "OFF"]:
                    self.set_fan(cmd == "ON")
                return True
            return False
        except Exception as e:
            print(f"❌ Upload error: {e}")
            return False

    def set_fan(self, state):
        self.fan_on = state
        status = "RUNNING 🌀" if state else "STOPPED ⭕"
        print(f"\\n{'='*30}")
        print(f"FAN STATUS: {status}")
        print('='*30)

    def run(self):
        self.setup_mqtt()
        try:
            while True:
                if self.capture_photo():
                    self.upload_photo()
                    if os.path.exists(self.snap_file):
                        os.remove(self.snap_file)
                time.sleep(self.upload_interval)
        except KeyboardInterrupt:
            print("\\n🛑 Stopping...")
            if self.mqtt_client:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()

if __name__ == "__main__":
    simulator = GestureFanSimulator()
    simulator.run()
`,
    mqtt_topics: {
      commands: 'device/fan/cmd',
      status: 'device/fan/status'
    }
  }
};

// 根据用户需求生成硬件代码
export async function POST(request: NextRequest) {
  try {
    const { userRequirement } = await request.json();
    
    if (!userRequirement) {
      return NextResponse.json(
        { error: 'No user requirement provided' },
        { status: 400 }
      );
    }

    console.log(`[HARDWARE GENERATOR] Processing requirement: ${userRequirement}`);

    // 使用AI分析用户需求并匹配硬件类型
    const aiAnalysis = await analyzeRequirement(userRequirement);
    
    // 选择合适的硬件模板
    const selectedTemplate = selectHardwareTemplate(aiAnalysis, userRequirement);
    
    if (!selectedTemplate) {
      return NextResponse.json({
        success: false,
        error: '无法识别的硬件类型',
        suggestion: '请描述更具体的硬件功能，如"水晶球占卜"、"手势控制台灯"等'
      }, { status: 400 });
    }

    // 生成硬件代码和配置
    const hardwareConfig = generateHardwareConfig(selectedTemplate, userRequirement);
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      user_requirement: userRequirement,
      ai_analysis: aiAnalysis,
      hardware_type: selectedTemplate.name,
      hardware_config: hardwareConfig,
      code: {
        python: selectedTemplate.pythonCode,
        filename: `${selectedTemplate.name.toLowerCase().replace(/\s+/g, '_')}_simulator.py`,
        description: `模拟${selectedTemplate.name}的Python代码`,
        dependencies: ['paho-mqtt', 'requests'],
        setup_instructions: [
          'pip install paho-mqtt requests',
          'python simulator.py'
        ]
      },
      mqtt_topics: selectedTemplate.mqtt_topics,
      endpoints: {
        status: `/api/${selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}`,
        control: `/api/${selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}/cmd`
      },
      next_steps: [
        '1. 保存生成的Python代码',
        '2. 安装依赖：pip install paho-mqtt requests',
        '3. 运行模拟器：python simulator.py',
        '4. 在Web界面中控制硬件'
      ]
    };

    console.log(`[HARDWARE GENERATOR] Generated configuration for: ${selectedTemplate.name}`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[HARDWARE GENERATOR] Error:', error);
    return NextResponse.json(
      { 
        error: 'Hardware generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// AI分析用户需求
async function analyzeRequirement(requirement: string) {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ALIYUN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的物联网硬件架构师。请根据用户描述的需求，将其归类为最接近的硬件模板。\\n\\n可选类型：\\n- crystal_ball: 占卜、预测、语音播报、灯光反馈类项目\\n- smart_lamp: 照明控制、亮度调节、手势/开关控制灯光项目\\n- gesture_fan: 手势识别控制、电机/风扇驱动项目\\n- custom: 如果以上都不符合，请选择此项。\\n\\n请严格返回JSON格式：{"hardware_type": "类型", "key_features": ["功能1", "功能2"], "sensors": ["传感器1"], "actuators": ["执行器1"]}'
          },
          {
            role: 'user',
            content: `硬件需求：${requirement}`
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      try {
        const jsonMatch = content.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Failed to parse AI analysis:', parseError);
      }
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }

  // 默认分析结果
  return {
    hardware_type: 'custom',
    key_features: ['未知功能'],
    sensors: ['未知传感器'],
    actuators: ['未知执行器']
  };
}

// 选择硬件模板
function selectHardwareTemplate(aiAnalysis: any, userRequirement: string) {
  const hardwareType = aiAnalysis.hardware_type;
  const requirementLower = userRequirement.toLowerCase();
  
  // 1. 优先基于强特征关键词匹配
  if (requirementLower.includes('风扇') || (requirementLower.includes('手势') && (requirementLower.includes('电机') || requirementLower.includes('转动')))) {
    return hardwareTemplates.gesture_fan;
  }
  
  if (requirementLower.includes('台灯') || requirementLower.includes('照明') || (requirementLower.includes('手势') && requirementLower.includes('灯'))) {
    return hardwareTemplates.smart_lamp;
  }
  
  if (requirementLower.includes('水晶球') || requirementLower.includes('占卜') || requirementLower.includes('预测')) {
    return hardwareTemplates.crystal_ball;
  }

  // 2. 其次基于AI分析结果
  if (hardwareType === 'crystal_ball') {
    return hardwareTemplates.crystal_ball;
  } else if (hardwareType === 'smart_lamp') {
    return hardwareTemplates.smart_lamp;
  } else if (hardwareType === 'gesture_fan') {
    return hardwareTemplates.gesture_fan;
  }
  
  // 3. 兜底逻辑：如果包含手势则优先风扇（作为演示标准）
  if (requirementLower.includes('手势')) {
    return hardwareTemplates.gesture_fan;
  }
  
  // 默认返回第一个模板作为兜底，但至少在之前的逻辑中我们已经尽力匹配了
  return hardwareTemplates.crystal_ball;
}

// 生成硬件配置
function generateHardwareConfig(template: any, userRequirement: string) {
  return {
    name: template.name,
    description: template.description,
    user_requirement: userRequirement,
    sensors: template.sensors,
    actuators: template.actuators,
    mqtt_topics: template.mqtt_topics,
    features: {
      ...template,
      customized: true
    }
  };
}

export async function GET() {
  return NextResponse.json({
    status: 'Hardware Code Generator',
    description: '基于用户需求生成硬件模拟器代码',
    supported_hardware: Object.keys(hardwareTemplates).map(key => ({
      id: key,
      name: hardwareTemplates[key].name,
      description: hardwareTemplates[key].description
    })),
    endpoints: {
      POST: {
        description: '根据用户需求生成硬件代码',
        parameters: {
          userRequirement: '用户需求描述 (required)'
        },
        response: {
          success: 'boolean',
          hardware_type: '硬件类型',
          code: '生成的Python代码',
          mqtt_topics: 'MQTT主题配置'
        }
      }
    }
  });
}