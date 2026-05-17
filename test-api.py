#!/usr/bin/env python3
"""
API测试脚本 - 测试Vision API的完整功能
"""

import requests
import json
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import time

def create_test_image(gesture="thumbs_up"):
    """创建测试图片"""
    # 创建一个320x240的图片
    img = Image.new('RGB', (320, 240), color=(50, 50, 50))
    draw = ImageDraw.Draw(img)
    
    # 绘制手势
    if gesture == "thumbs_up":
        # 绘制👍手势
        draw.ellipse([100, 50, 220, 170], fill=(255, 200, 150))  # 脸
        draw.ellipse([140, 90, 180, 130], fill=(0, 0, 0))  # 眼睛
        draw.ellipse([120, 140, 140, 200], fill=(255, 200, 150))  # 拇指
        draw.rectangle([140, 140, 160, 180], fill=(255, 200, 150))  # 手
        text = "👍"
    elif gesture == "thumbs_down":
        # 绘制👇手势
        draw.ellipse([100, 50, 220, 170], fill=(255, 200, 150))  # 脸
        draw.ellipse([140, 90, 180, 130], fill=(0, 0, 0))  # 眼睛
        draw.ellipse([120, 60, 140, 120], fill=(255, 200, 150))  # 拇指向下
        draw.rectangle([140, 80, 160, 120], fill=(255, 200, 150))  # 手
        text = "👇"
    else:
        text = "❓"
    
    # 添加文字
    try:
        font = ImageFont.load_default()
        draw.text((160, 200), text, fill=(255, 255, 255), font=font, anchor="mm")
    except:
        pass
    
    return img

def image_to_base64(img):
    """将PIL图片转换为base64"""
    buffer = BytesIO()
    img.save(buffer, format='JPEG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return img_str

def test_vision_api():
    """测试Vision API"""
    base_url = "http://localhost:3000"
    
    print("🧪 测试 Vision API")
    print("=" * 50)
    
    # 1. 测试GET接口
    print("\n1️⃣ 测试 GET /api/vision")
    try:
        response = requests.get(f"{base_url}/api/vision", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print("✅ GET 请求成功")
            print(f"   状态: {data['status']}")
            print(f"   当前状态: {data['current_state']}")
        else:
            print(f"❌ GET 请求失败: {response.status_code}")
    except Exception as e:
        print(f"❌ GET 请求错误: {e}")
        return False
    
    # 2. 测试POST接口 - 👍手势
    print("\n2️⃣ 测试 POST /api/vision - 👍 手势")
    try:
        img = create_test_image("thumbs_up")
        img_buffer = BytesIO()
        img.save(img_buffer, format='JPEG')
        img_buffer.seek(0)
        
        files = {'image': ('test_thumbs_up.jpg', img_buffer, 'image/jpeg')}
        data = {'deviceId': 'test-device'}
        
        response = requests.post(f"{base_url}/api/vision", files=files, data=data, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 👍 手势识别成功")
            print(f"   识别结果: {result['vision']['gesture']}")
            print(f"   置信度: {result['vision']['confidence']:.2f}")
            print(f"   控制指令: {result['command']['action']}")
            print(f"   MQTT结果: {result['mqtt']['success']}")
        else:
            print(f"❌ 👍 手势识别失败: {response.status_code}")
            print(f"   错误信息: {response.text}")
    except Exception as e:
        print(f"❌ 👍 手势识别错误: {e}")
    
    time.sleep(1)
    
    # 3. 测试POST接口 - 👇手势
    print("\n3️⃣ 测试 POST /api/vision - 👇 手势")
    try:
        img = create_test_image("thumbs_down")
        img_buffer = BytesIO()
        img.save(img_buffer, format='JPEG')
        img_buffer.seek(0)
        
        files = {'image': ('test_thumbs_down.jpg', img_buffer, 'image/jpeg')}
        data = {'deviceId': 'test-device'}
        
        response = requests.post(f"{base_url}/api/vision", files=files, data=data, timeout=15)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 👇 手势识别成功")
            print(f"   识别结果: {result['vision']['gesture']}")
            print(f"   置信度: {result['vision']['confidence']:.2f}")
            print(f"   控制指令: {result['command']['action']}")
            print(f"   MQTT结果: {result['mqtt']['success']}")
        else:
            print(f"❌ 👇 手势识别失败: {response.status_code}")
            print(f"   错误信息: {response.text}")
    except Exception as e:
        print(f"❌ 👇 手势识别错误: {e}")
    
    # 4. 再次检查状态
    print("\n4️⃣ 检查更新后的状态")
    try:
        response = requests.get(f"{base_url}/api/vision", timeout=5)
        if response.status_code == 200:
            data = response.json()
            state = data['current_state']
            print("✅ 状态获取成功")
            print(f"   最后手势: {state['lastGesture']}")
            print(f"   最后指令: {state['lastCommand']}")
            print(f"   总处理次数: {state['totalProcessed']}")
            print(f"   ON次数: {state['onCount']}")
            print(f"   OFF次数: {state['offCount']}")
    except Exception as e:
        print(f"❌ 状态获取错误: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 API 测试完成！")
    print("\n💡 提示:")
    print("   - 如果看到MQTT结果为True，说明MQTT发布成功")
    print("   - 可以启动Mock Pi来接收MQTT消息")
    print("   - 打开 http://localhost:3000/test-vision.html 查看实时状态")

if __name__ == "__main__":
    print("🔍 检查依赖...")
    try:
        import requests
        from PIL import Image, ImageDraw, ImageFont
        print("✅ 依赖检查通过")
    except ImportError as e:
        print(f"❌ 缺少依赖: {e}")
        print("   请运行: pip install requests pillow")
        exit(1)
    
    test_vision_api()