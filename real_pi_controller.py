#!/usr/bin/env python3
"""
真实树莓派控制器
将Mock Pi的模拟功能替换为真实硬件调用
"""

import os
import sys
import platform
import time
import requests
import json
from datetime import datetime
import threading
import base64
import io

# 硬件库导入
try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    print("Warning: RPi.GPIO not found. Using mock GPIO mode.")
    GPIO_AVAILABLE = False

try:
    import picamera
    from picamera.array import PiRGBArray
    CAMERA_AVAILABLE = True
except ImportError:
    print("Warning: picamera not found. Using mock camera mode.")
    CAMERA_AVAILABLE = False

try:
    import cv2
    import numpy as np
    OPENCV_AVAILABLE = True
except ImportError:
    print("Warning: OpenCV not found. Using fallback image capture.")
    OPENCV_AVAILABLE = False

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: paho-mqtt not installed. Please run: pip install paho-mqtt")
    sys.exit(1)

class RealPiController:
    def __init__(self):
        self.system = platform.system()
        self.device_id = f"raspberry-pi-{self.get_serial_number()}"
        self.server_url = "http://localhost:3000/api/vision"
        self.mqtt_broker = "broker.emqx.io"
        self.mqtt_port = 1883
        self.mqtt_topic = "device/fan/cmd"
        self.snap_file = "snap.jpg"
        self.upload_interval = 2  # seconds
        self.fan_status = "OFF"
        
        # 硬件配置
        self.fan_pin = 18  # GPIO 18 (物理引脚12)
        self.led_pin = 24   # GPIO 24 (物理引脚18)
        
        # 摄像头配置
        self.camera_resolution = (320, 240)
        self.camera_framerate = 15
        
        # 初始化硬件
        self.setup_gpio()
        self.setup_camera()
        
        # MQTT客户端
        self.mqtt_client = None
        
        print(f"🎯 Real Pi Controller initialized")
        print(f"📱 Device ID: {self.device_id}")
        print(f"🌐 Server URL: {self.server_url}")
        print(f"📡 MQTT Topic: {self.mqtt_topic}")
        print(f"⚡ Fan GPIO: {self.fan_pin}")
        print(f"💡 LED GPIO: {self.led_pin}")
        print("=" * 60)

    def get_serial_number(self):
        """获取树莓派唯一序列号"""
        try:
            with open('/proc/cpuinfo', 'r') as f:
                for line in f:
                    if line.startswith('Serial'):
                        return line.split(':')[1].strip()[:8]
        except:
            return "unknown"

    def setup_gpio(self):
        """初始化GPIO引脚"""
        if not GPIO_AVAILABLE:
            print("⚠️ GPIO not available - using mock mode")
            return
            
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            
            # 设置风扇控制引脚
            GPIO.setup(self.fan_pin, GPIO.OUT)
            GPIO.output(self.fan_pin, GPIO.LOW)
            
            # 设置状态LED引脚
            GPIO.setup(self.led_pin, GPIO.OUT)
            GPIO.output(self.led_pin, GPIO.LOW)
            
            print("✅ GPIO initialized successfully")
        except Exception as e:
            print(f"❌ GPIO initialization failed: {e}")

    def setup_camera(self):
        """初始化摄像头"""
        if CAMERA_AVAILABLE:
            try:
                self.camera = picamera.PiCamera()
                self.camera.resolution = self.camera_resolution
                self.camera.framerate = self.camera_framerate
                self.camera.rotation = 0
                print("✅ PiCamera initialized successfully")
            except Exception as e:
                print(f"❌ PiCamera initialization failed: {e}")
                self.camera = None
        elif OPENCV_AVAILABLE:
            try:
                self.camera = cv2.VideoCapture(0)
                self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, self.camera_resolution[0])
                self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, self.camera_resolution[1])
                print("✅ OpenCV Camera initialized successfully")
            except Exception as e:
                print(f"❌ OpenCV Camera initialization failed: {e}")
                self.camera = None
        else:
            print("⚠️ Camera not available - using mock mode")
            self.camera = None

    def control_fan(self, command):
        """真实硬件风扇控制"""
        self.fan_status = command
        
        if GPIO_AVAILABLE:
            try:
                if command == "ON":
                    GPIO.output(self.fan_pin, GPIO.HIGH)
                    GPIO.output(self.led_pin, GPIO.HIGH)
                    print("🔥 Fan turned ON (GPIO HIGH)")
                elif command == "OFF":
                    GPIO.output(self.fan_pin, GPIO.LOW)
                    GPIO.output(self.led_pin, GPIO.LOW)
                    print("❄️ Fan turned OFF (GPIO LOW)")
                
                self.display_fan_status()
                return True
            except Exception as e:
                print(f"❌ GPIO control failed: {e}")
                return False
        else:
            # Mock模式
            self.display_fan_status()
            return True

    def display_fan_status(self):
        """显示风扇状态ASCII艺术"""
        if self.fan_status == "ON":
            print("\n" + "="*60)
            print("╔══════════════════════════════════════════════════════════════╗")
            print("║                                                              ║")
            print("║                      🔥 FAN IS ON 🔥                          ║")
            print("║                      ⚡ SPINNING ⚡                           ║")
            print("║                                                              ║")
            print("║     💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨     ║")
            print("║                                                              ║")
            print("╚══════════════════════════════════════════════════════════════╝")
        else:
            print("\n" + "="*60)
            print("╔══════════════════════════════════════════════════════════════╗")
            print("║                                                              ║")
            print("║                      ❄️ FAN IS OFF ❄️                         ║")
            print("║                      💤 SLEEPING 💤                           ║")
            print("║                                                              ║")
            print("║     ⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪     ║")
            print("║                                                              ║")
            print("╚══════════════════════════════════════════════════════════════╝")
        print("="*60)

    def capture_photo(self):
        """真实摄像头抓拍"""
        if self.camera is None:
            print("❌ Camera not available")
            return False
            
        try:
            if CAMERA_AVAILABLE and hasattr(self.camera, 'capture'):
                # 使用PiCamera抓拍
                self.camera.capture(self.snap_file, format='jpeg', quality=85)
                print(f"📸 Photo captured with PiCamera: {self.snap_file}")
                return True
            elif OPENCV_AVAILABLE:
                # 使用OpenCV抓拍
                ret, frame = self.camera.read()
                if ret:
                    cv2.imwrite(self.snap_file, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    print(f"📸 Photo captured with OpenCV: {self.snap_file}")
                    return True
                else:
                    print("❌ Failed to capture frame with OpenCV")
                    return False
        except Exception as e:
            print(f"❌ Photo capture failed: {e}")
            return False

    def upload_photo(self):
        """上传照片到AI服务器"""
        try:
            if not os.path.exists(self.snap_file):
                print("❌ Photo file not found")
                return False
                
            print("📤 Uploading photo to server...")
            
            with open(self.snap_file, 'rb') as f:
                files = {'image': f}
                data = {'deviceId': self.device_id}
                
                response = requests.post(
                    self.server_url, 
                    files=files, 
                    data=data,
                    timeout=10
                )
            
            if response.status_code == 200:
                result = response.json()
                gesture = result.get('vision', {}).get('gesture', 'unknown')
                confidence = result.get('vision', {}).get('confidence', 0)
                command = result.get('command', {}).get('action', 'NONE')
                
                print(f"✅ Upload successful!")
                print(f"   Gesture: {gesture}")
                print(f"   Confidence: {confidence:.2f}")
                print(f"   Command: {command}")
                
                # 执行控制命令
                if command in ['ON', 'OFF']:
                    self.control_fan(command)
                
                return True
            else:
                print(f"❌ Upload failed: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Upload error: {e}")
            return False

    def cleanup_photo(self):
        """清理临时照片文件"""
        try:
            if os.path.exists(self.snap_file):
                os.remove(self.snap_file)
                print("🗑️ Cleaned up photo file")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")

    def setup_mqtt(self):
        """设置MQTT连接"""
        try:
            self.mqtt_client = mqtt.Client()
            self.mqtt_client.on_connect = self.on_mqtt_connect
            self.mqtt_client.on_message = self.on_mqtt_message
            self.mqtt_client.on_disconnect = self.on_mqtt_disconnect
            
            self.mqtt_client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.mqtt_client.loop_start()
            
            return True
        except Exception as e:
            print(f"❌ MQTT setup failed: {e}")
            return False

    def on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT连接回调"""
        if rc == 0:
            print(f"✅ MQTT connected to {self.mqtt_broker}:{self.mqtt_port}")
            client.subscribe(self.mqtt_topic)
            print(f"📡 Subscribed to topic: {self.mqtt_topic}")
        else:
            print(f"❌ MQTT connection failed with code {rc}")

    def on_mqtt_message(self, client, userdata, msg):
        """MQTT消息回调"""
        try:
            payload = json.loads(msg.payload.decode())
            command = payload.get('command', '')
            gesture = payload.get('gesture', '')
            timestamp = payload.get('timestamp', '')
            
            print(f"\n📨 Received MQTT Message:")
            print(f"   Topic: {msg.topic}")
            print(f"   Command: {command}")
            print(f"   Gesture: {gesture}")
            print(f"   Time: {timestamp}")
            print("-" * 50)
            
            if command in ['ON', 'OFF']:
                self.control_fan(command)
                
        except Exception as e:
            print(f"❌ MQTT message processing error: {e}")

    def on_mqtt_disconnect(self, client, userdata, rc):
        """MQTT断开回调"""
        print(f"❌ MQTT disconnected with code {rc}")

    def run_capture_cycle(self):
        """运行一次抓拍循环"""
        print(f"🔄 Starting capture cycle...")
        
        # 抓拍照片
        if self.capture_photo():
            # 上传照片
            if self.upload_photo():
                print("✅ Cycle completed successfully")
            else:
                print("❌ Upload failed")
        else:
            print("❌ Capture failed")
        
        # 清理文件
        self.cleanup_photo()
        
        print("-" * 50)

    def run(self):
        """主运行循环"""
        print(f"🚀 Starting Real Pi Controller")
        print(f"⏰ Capture interval: {self.upload_interval} seconds")
        print(f"🎮 Initial fan status: {self.fan_status}")
        print("Press Ctrl+C to stop")
        print("=" * 60)
        
        # 显示初始状态
        self.display_fan_status()
        
        # 设置MQTT
        if self.setup_mqtt():
            print("✅ MQTT setup completed")
        else:
            print("⚠️ MQTT setup failed, continuing without remote control")
        
        try:
            cycle_count = 0
            while True:
                cycle_count += 1
                print(f"\n🔄 Cycle #{cycle_count} at {datetime.now().strftime('%H:%M:%S')}")
                
                self.run_capture_cycle()
                
                # 等待下次抓拍
                time.sleep(self.upload_interval)
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping Real Pi Controller...")
        finally:
            self.cleanup()

    def cleanup(self):
        """清理资源"""
        print("🧹 Cleaning up resources...")
        
        # 关闭摄像头
        if self.camera:
            if CAMERA_AVAILABLE and hasattr(self.camera, 'close'):
                self.camera.close()
            elif OPENCV_AVAILABLE and hasattr(self.camera, 'release'):
                self.camera.release()
            print("📷 Camera closed")
        
        # 清理GPIO
        if GPIO_AVAILABLE:
            try:
                GPIO.cleanup()
                print("⚡ GPIO cleaned up")
            except:
                pass
        
        # 断开MQTT
        if self.mqtt_client:
            try:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
                print("📡 MQTT disconnected")
            except:
                pass
        
        print("✅ Cleanup completed")

if __name__ == "__main__":
    controller = RealPiController()
    controller.run()