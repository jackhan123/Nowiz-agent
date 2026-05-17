#!/usr/bin/env python3
"""
树莓派模拟器
用于在Windows/Mac上模拟树莓派的摄像头抓拍和MQTT通信
"""

import os
import sys
import platform
import subprocess
import time
import requests
import json
from datetime import datetime
import threading

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: paho-mqtt not installed. Please run: pip install paho-mqtt")
    sys.exit(1)

class MockPi:
    def __init__(self):
        self.system = platform.system()
        self.device_id = f"mock-pi-{self.system.lower()}"
        self.server_url = "http://localhost:3000/api/vision"
        self.mqtt_broker = "broker.emqx.io"
        self.mqtt_port = 1883
        self.mqtt_topic = "device/fan/cmd"
        self.snap_file = "snap.jpg"
        self.upload_interval = 2  # seconds
        self.fan_status = "OFF"
        
        # 配置FFmpeg命令
        self.ffmpeg_cmd = self._get_ffmpeg_command()
        
        # MQTT客户端
        self.mqtt_client = None
        
        print(f"🎯 Mock Pi initialized for {self.system}")
        print(f"📷 FFmpeg command: {self.ffmpeg_cmd}")
        print(f"🌐 Server URL: {self.server_url}")
        print(f"📡 MQTT Topic: {self.mqtt_topic}")
        print("=" * 60)

    def _get_ffmpeg_command(self):
        """根据操作系统返回对应的FFmpeg命令"""
        if self.system == "Windows":
            return [
                "ffmpeg",
                "-f", "dshow",
                "-i", "video=\"Integrated Camera\"",
                "-vframes", "1",
                "-s", "320x240",
                "-y",
                self.snap_file
            ]
        elif self.system == "Darwin":  # macOS
            return [
                "ffmpeg",
                "-f", "avfoundation",
                "-i", "0",
                "-vframes", "1",
                "-s", "320x240",
                "-y",
                self.snap_file
            ]
        elif self.system == "Linux":
            return [
                "ffmpeg",
                "-f", "v4l2",
                "-i", "/dev/video0",
                "-vframes", "1",
                "-s", "320x240",
                "-y",
                self.snap_file
            ]
        else:
            raise Exception(f"Unsupported OS: {self.system}")

    def setup_mqtt(self):
        """设置MQTT客户端"""
        try:
            self.mqtt_client = mqtt.Client(client_id=self.device_id)
            self.mqtt_client.on_connect = self._on_mqtt_connect
            self.mqtt_client.on_message = self._on_mqtt_message
            self.mqtt_client.on_disconnect = self._on_mqtt_disconnect
            
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
            command = payload.get('command', '').upper()
            gesture = payload.get('gesture', 'unknown')
            timestamp = payload.get('timestamp', datetime.now().isoformat())
            
            print(f"\n📨 Received MQTT Message:")
            print(f"   Topic: {msg.topic}")
            print(f"   Command: {command}")
            print(f"   Gesture: {gesture}")
            print(f"   Time: {timestamp}")
            print("-" * 40)
            
            if command == "ON":
                self._show_fan_on()
            elif command == "OFF":
                self._show_fan_off()
            else:
                print(f"❓ Unknown command: {command}")
                
        except Exception as e:
            print(f"❌ Error processing MQTT message: {e}")

    def _on_mqtt_disconnect(self, client, userdata, rc):
        """MQTT断开连接回调"""
        print(f"❌ MQTT Disconnected with code {rc}")

    def _show_fan_on(self):
        """显示风扇开启状态"""
        self.fan_status = "ON"
        print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                      🔥 FAN IS ON 🔥                          ║
║                      ⚡ SPINNING ⚡                           ║
║                                                              ║
║     💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        """)

    def _show_fan_off(self):
        """显示风扇关闭状态"""
        self.fan_status = "OFF"
        print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                      ❄️ FAN IS OFF ❄️                         ║
║                      💤 STOPPED 💤                             ║
║                                                              ║
║     ⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕⭕     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        """)

    def capture_photo(self):
        """使用FFmpeg抓拍照片"""
        try:
            print(f"📸 Capturing photo with FFmpeg...")
            result = subprocess.run(
                self.ffmpeg_cmd,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                print(f"✅ Photo captured successfully: {self.snap_file}")
                return True
            else:
                print(f"❌ FFmpeg failed: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            print("❌ FFmpeg capture timeout")
            return False
        except FileNotFoundError:
            print("❌ FFmpeg not found. Please install FFmpeg first.")
            print("   Windows: Download from https://ffmpeg.org/download.html")
            print("   Mac: brew install ffmpeg")
            print("   Linux: sudo apt install ffmpeg")
            return False
        except Exception as e:
            print(f"❌ Capture error: {e}")
            return False

    def upload_photo(self):
        """上传照片到服务器"""
        try:
            if not os.path.exists(self.snap_file):
                print(f"❌ Photo file not found: {self.snap_file}")
                return False

            print(f"📤 Uploading photo to server...")
            
            with open(self.snap_file, 'rb') as f:
                files = {'image': (self.snap_file, f, 'image/jpeg')}
                data = {'deviceId': self.device_id}
                
                response = requests.post(
                    self.server_url,
                    files=files,
                    data=data,
                    timeout=15
                )

            if response.status_code == 200:
                result = response.json()
                print(f"✅ Upload successful!")
                print(f"   Gesture: {result.get('vision', {}).get('gesture', 'unknown')}")
                print(f"   Confidence: {result.get('vision', {}).get('confidence', 0):.2f}")
                print(f"   Command: {result.get('command', {}).get('action', 'none')}")
                print(f"   MQTT: {result.get('mqtt', {}).get('success', False)}")
                return True
            else:
                print(f"❌ Upload failed: HTTP {response.status_code}")
                print(f"   Response: {response.text}")
                return False

        except requests.exceptions.ConnectionError:
            print("❌ Cannot connect to server. Make sure Next.js is running on localhost:3000")
            return False
        except requests.exceptions.Timeout:
            print("❌ Upload timeout")
            return False
        except Exception as e:
            print(f"❌ Upload error: {e}")
            return False

    def cleanup_photo(self):
        """清理临时照片文件"""
        try:
            if os.path.exists(self.snap_file):
                os.remove(self.snap_file)
                print(f"🗑️ Cleaned up {self.snap_file}")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")

    def run(self):
        """运行主循环"""
        print(f"🚀 Starting Mock Pi - Device ID: {self.device_id}")
        print(f"⏰ Capture interval: {self.upload_interval} seconds")
        print(f"🎮 Current fan status: {self.fan_status}")
        print("Press Ctrl+C to stop")
        print("=" * 60)

        # 设置MQTT连接
        if not self.setup_mqtt():
            print("⚠️ MQTT connection failed, continuing without MQTT...")
        
        try:
            cycle_count = 0
            while True:
                cycle_count += 1
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"\n🔄 Cycle #{cycle_count} at {timestamp}")
                
                # 抓拍照片
                if self.capture_photo():
                    # 上传照片
                    upload_success = self.upload_photo()
                    
                    # 清理照片
                    self.cleanup_photo()
                    
                    if upload_success:
                        print(f"✅ Cycle #{cycle_count} completed successfully")
                    else:
                        print(f"⚠️ Cycle #{cycle_count} completed with upload issues")
                else:
                    print(f"❌ Cycle #{cycle_count} failed at capture stage")
                
                # 等待下次抓拍
                print(f"⏳ Waiting {self.upload_interval} seconds...")
                time.sleep(self.upload_interval)
                
        except KeyboardInterrupt:
            print(f"\n\n🛑 Stopping Mock Pi...")
            if self.mqtt_client:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
            print("👋 Mock Pi stopped. Goodbye!")
        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
            sys.exit(1)

def main():
    """主函数"""
    print("🎯 Mock Pi - Tree Fruit Pi Simulator")
    print("=" * 60)
    
    # 检查系统要求
    print("🔍 Checking system requirements...")
    
    # 检查FFmpeg
    try:
        subprocess.run(["ffmpeg", "-version"], 
                      capture_output=True, check=True, timeout=5)
        print("✅ FFmpeg is available")
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        print("❌ FFmpeg not found!")
        print("   Please install FFmpeg:")
        print("   Windows: https://ffmpeg.org/download.html")
        print("   Mac: brew install ffmpeg")
        print("   Linux: sudo apt install ffmpeg")
        sys.exit(1)
    
    # 检查requests库
    try:
        import requests
        print("✅ requests library is available")
    except ImportError:
        print("❌ requests library not found!")
        print("   Run: pip install requests")
        sys.exit(1)
    
    print("=" * 60)
    
    # 创建并运行Mock Pi
    mock_pi = MockPi()
    mock_pi.run()

if __name__ == "__main__":
    main()