#!/usr/bin/env python3
"""
简化版真实树莓派控制器
专注于核心硬件功能的实现
"""

import os
import sys
import time
import requests
import json
from datetime import datetime
import threading

# 根据可用性导入库
try:
    import RPi.GPIO as GPIO
    GPIO_MODE = "REAL"
except ImportError:
    print("⚠️ RPi.GPIO not found, using mock GPIO")
    GPIO_MODE = "MOCK"
    # Mock GPIO类
    class GPIO:
        BCM = "BCM"
        OUT = "OUT"
        HIGH = 1
        LOW = 0
        pin_states = {}
        
        @staticmethod
        def setmode(mode):
            pass
        
        @staticmethod
        def setwarnings(warnings):
            pass
        
        @staticmethod
        def setup(pin, mode):
            GPIO.pin_states[pin] = GPIO.LOW
        
        @staticmethod
        def output(pin, value):
            GPIO.pin_states[pin] = value
            state = "HIGH" if value == GPIO.HIGH else "LOW"
            print(f"[MOCK GPIO] Pin {pin} set to {state}")
        
        @staticmethod
        def cleanup():
            GPIO.pin_states.clear()

try:
    import cv2
    CAMERA_MODE = "OPENCV"
except ImportError:
    try:
        import picamera
        CAMERA_MODE = "PICAMERA"
    except ImportError:
        print("⚠️ No camera library found, using mock camera")
        CAMERA_MODE = "MOCK"
        
        class MockCamera:
            def __init__(self):
                self.resolution = (320, 240)
                
            def capture(self, filename, format='jpeg', quality=85):
                # 创建一个简单的测试图像
                import numpy as np
                img = np.zeros((240, 320, 3), dtype=np.uint8)
                img[:] = (100, 150, 200)  # 填充颜色
                cv2.imwrite(filename, img)
                print(f"[MOCK CAMERA] Created test image: {filename}")

class SimplePiController:
    def __init__(self):
        # 基本配置
        self.device_id = self.get_device_id()
        self.server_url = "http://localhost:3000/api/vision"
        self.upload_interval = 2
        self.fan_status = "OFF"
        
        # 硬件引脚配置
        self.fan_pin = 18
        
        # 初始化组件
        self.setup_gpio()
        self.setup_camera()
        
        print(f"🎯 Simple Pi Controller initialized")
        print(f"📱 Device ID: {self.device_id}")
        print(f"⚡ GPIO Mode: {GPIO_MODE}")
        print(f"📷 Camera Mode: {CAMERA_MODE}")
        print("=" * 50)

    def get_device_id(self):
        """获取设备ID"""
        try:
            with open('/proc/cpuinfo', 'r') as f:
                for line in f:
                    if line.startswith('Serial'):
                        return f"pi-{line.split(':')[1].strip()[:8]}"
        except:
            import uuid
            return f"pi-{uuid.uuid4().hex[:8]}"

    def setup_gpio(self):
        """初始化GPIO"""
        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            GPIO.setup(self.fan_pin, GPIO.OUT)
            GPIO.output(self.fan_pin, GPIO.LOW)
            print("✅ GPIO initialized")
        except Exception as e:
            print(f"❌ GPIO setup failed: {e}")

    def setup_camera(self):
        """初始化摄像头"""
        try:
            if CAMERA_MODE == "OPENCV":
                self.camera = cv2.VideoCapture(0)
                self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
                self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
                print("✅ OpenCV camera initialized")
            elif CAMERA_MODE == "PICAMERA":
                self.camera = picamera.PiCamera()
                self.camera.resolution = (320, 240)
                print("✅ PiCamera initialized")
            else:
                self.camera = MockCamera()
                print("✅ Mock camera initialized")
        except Exception as e:
            print(f"❌ Camera setup failed: {e}")
            self.camera = MockCamera()

    def control_fan(self, command):
        """控制风扇"""
        self.fan_status = command
        
        try:
            if command == "ON":
                GPIO.output(self.fan_pin, GPIO.HIGH)
                self.show_status("🔥 FAN ON", "🔥", "⚡")
            elif command == "OFF":
                GPIO.output(self.fan_pin, GPIO.LOW)
                self.show_status("❄️ FAN OFF", "❄️", "💤")
            return True
        except Exception as e:
            print(f"❌ Fan control failed: {e}")
            return False

    def show_status(self, title, emoji, action):
        """显示状态"""
        print(f"\n{'='*50}")
        print(f"{emoji} {title}")
        print(f"{action} Status: {self.fan_status}")
        print(f"{'='*50}\n")

    def capture_photo(self):
        """抓拍照片"""
        try:
            if CAMERA_MODE == "OPENCV":
                ret, frame = self.camera.read()
                if ret:
                    filename = f"capture_{int(time.time())}.jpg"
                    cv2.imwrite(filename, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    return filename
            elif CAMERA_MODE == "PICAMERA":
                filename = f"capture_{int(time.time())}.jpg"
                self.camera.capture(filename, format='jpeg', quality=85)
                return filename
            else:
                filename = f"capture_{int(time.time())}.jpg"
                self.camera.capture(filename)
                return filename
                
        except Exception as e:
            print(f"❌ Capture failed: {e}")
            return None

    def upload_and_process(self, filename):
        """上传并处理AI响应"""
        try:
            if not filename or not os.path.exists(filename):
                print("❌ No photo file")
                return

            print(f"📤 Uploading {filename}...")
            
            with open(filename, 'rb') as f:
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
                
                print(f"🤖 AI Result: {gesture} ({confidence:.2f})")
                print(f"🎮 Command: {command}")
                
                if command in ['ON', 'OFF']:
                    self.control_fan(command)
                
                return True
            else:
                print(f"❌ Upload failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Upload error: {e}")
            return False
        finally:
            # 清理临时文件
            if filename and os.path.exists(filename):
                os.remove(filename)
                print("🗑️ Photo cleaned up")

    def run_cycle(self):
        """运行一个完整周期"""
        print(f"\n🔄 Cycle at {datetime.now().strftime('%H:%M:%S')}")
        
        # 抓拍
        filename = self.capture_photo()
        if filename:
            print(f"📸 Photo captured: {filename}")
            
            # 上传并处理
            self.upload_and_process(filename)

    def run(self):
        """主运行循环"""
        print(f"🚀 Starting controller...")
        print(f"⏰ Interval: {self.upload_interval}s")
        print(f"🎮 Initial status: {self.fan_status}")
        print("Press Ctrl+C to stop\n")

        try:
            cycle_count = 0
            while True:
                cycle_count += 1
                print(f"--- Cycle #{cycle_count} ---")
                
                self.run_cycle()
                
                time.sleep(self.upload_interval)
                
        except KeyboardInterrupt:
            print("\n🛑 Stopping...")
        finally:
            self.cleanup()

    def cleanup(self):
        """清理资源"""
        print("🧹 Cleaning up...")
        
        if hasattr(self, 'camera') and self.camera:
            if CAMERA_MODE == "OPENCV" and hasattr(self.camera, 'release'):
                self.camera.release()
            elif CAMERA_MODE == "PICAMERA" and hasattr(self.camera, 'close'):
                self.camera.close()
            print("📷 Camera closed")
        
        try:
            GPIO.cleanup()
            print("⚡ GPIO cleaned up")
        except:
            pass
        
        print("✅ Done")

if __name__ == "__main__":
    controller = SimplePiController()
    controller.run()