#!/bin/bash
# 真实树莓派环境安装脚本

echo "🚀 Installing Real Pi Controller dependencies..."

# 更新系统包
echo "📦 Updating system packages..."
sudo apt-get update

# 安装系统依赖
echo "📸 Installing camera dependencies..."
sudo apt-get install -y python3-pip python3-dev
sudo apt-get install -y libcamera-dev
sudo apt-get install -y v4l-utils
sudo apt-get install -y ffmpeg

# 安装Python库
echo "🐍 Installing Python packages..."
pip3 install --upgrade pip

# 核心依赖
pip3 install requests paho-mqtt

# 摄像头依赖（二选一）
echo "📷 Installing camera support..."
pip3 install picamera  # for older Pi cameras
pip3 install picamera2  # for newer Pi cameras
pip3 install opencv-python  # fallback option

# 图像处理
pip3 install pillow numpy

# GPIO控制
pip3 install RPi.GPIO

# 验证安装
echo "🔍 Verifying installation..."
python3 -c "
import requests
import paho.mqtt.client as mqtt
import RPi.GPIO as GPIO
print('✅ Core dependencies installed successfully')
"

echo "✅ Installation completed!"
echo ""
echo "🎯 Next steps:"
echo "1. Connect your camera module"
echo "2. Connect fan controller to GPIO 18"
echo "3. Run: python3 real_pi_controller.py"
echo ""