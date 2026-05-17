# Mock Pi - 树莓派模拟器

这是一个Python脚本，用于在你的电脑上模拟树莓派的摄像头抓拍和MQTT通信功能。

## 🎯 功能特性

- **📷 摄像头抓拍**: 每2秒自动抓拍一张320x240的照片
- **🌐 图像上传**: 将照片上传到Next.js后端的 `/api/vision` 接口
- **📡 MQTT通信**: 订阅 `device/fan/cmd` 主题，接收控制指令
- **💨 风扇状态显示**: 大大的ASCII艺术显示风扇开关状态
- **🖥️ 跨平台支持**: 自动适配Windows/Mac/Linux系统

## 🛠️ 环境要求

### 必需软件
1. **Python 3.7+**
2. **FFmpeg** (图像抓拍)
   - Windows: 从 https://ffmpeg.org/download.html 下载
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`

### Python依赖
- `requests` - HTTP请求
- `paho-mqtt` - MQTT客户端

## 🚀 快速开始

### 方法1: 使用快速启动脚本
```bash
python run_mock_pi.py
```
这个脚本会自动检查并安装依赖，然后启动Mock Pi。

### 方法2: 手动安装依赖
```bash
# 安装依赖
pip install requests paho-mqtt

# 运行Mock Pi
python mock_pi.py
```

## 📋 使用步骤

1. **启动Next.js后端**
   ```bash
   npm run dev
   ```
   确保服务器运行在 `localhost:3000`

2. **启动Mock Pi**
   ```bash
   python mock_pi.py
   ```

3. **观察运行状态**
   - Mock Pi会每2秒抓拍一张照片
   - 自动上传到 `/api/vision` 接口
   - AI识别手势后通过MQTT发送指令
   - 收到ON/OFF指令时显示风扇状态

## 📊 运行示例

```
🎯 Mock Pi initialized for Darwin
📷 FFmpeg command: ['ffmpeg', '-f', 'avfoundation', '-i', '0', '-vframes', '1', '-s', '320x240', '-y', 'snap.jpg']
🌐 Server URL: http://localhost:3000/api/vision
📡 MQTT Topic: device/fan/cmd
============================================================
✅ MQTT connected to broker.emqx.io:1883
✅ MQTT Connected successfully
📡 Subscribed to topic: device/fan/cmd
🚀 Starting Mock Pi - Device ID: mock-pi-darwin
⏰ Capture interval: 2 seconds
🎮 Current fan status: OFF
Press Ctrl+C to stop
============================================================

🔄 Cycle #1 at 14:30:25
📸 Capturing photo with FFmpeg...
✅ Photo captured successfully: snap.jpg
📤 Uploading photo to server...
✅ Upload successful!
   Gesture: thumbs_up
   Confidence: 0.95
   Command: ON
   MQTT: True
🗑️ Cleaned up snap.jpg
✅ Cycle #1 completed successfully

📨 Received MQTT Message:
   Topic: device/fan/cmd
   Command: ON
   Gesture: thumbs_up
   Time: 2024-01-22T14:30:27.123Z
----------------------------------------

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                      🔥 FAN IS ON 🔥                          ║
║                      ⚡ SPINNING ⚡                           ║
║                                                              ║
║     💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨💨     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

## 🔧 配置说明

### FFmpeg摄像头配置
Mock Pi会自动检测操作系统并配置相应的FFmpeg命令：

- **Windows**: `ffmpeg -f dshow -i video="Integrated Camera"`
- **Mac**: `ffmpeg -f avfoundation -i "0"`
- **Linux**: `ffmpeg -f v4l2 -i "/dev/video0"`

如果你的摄像头设备名不同，可以修改 `mock_pi.py` 中的 `_get_ffmpeg_command()` 方法。

### 服务器配置
可以在 `MockPi` 类的 `__init__` 方法中修改：
- `server_url`: 后端服务器地址
- `mqtt_broker`: MQTT代理服务器地址
- `upload_interval`: 抓拍间隔（秒）
- `snap_file`: 临时照片文件名

## 🐛 故障排除

### FFmpeg相关问题
1. **FFmpeg未找到**: 确保已正确安装FFmpeg并添加到PATH
2. **摄像头未找到**: 检查摄像头是否被其他程序占用
3. **权限问题**: 确保Python有访问摄像头的权限

### 网络相关问题
1. **连接服务器失败**: 确保Next.js服务器正在运行在localhost:3000
2. **MQTT连接失败**: 检查网络连接，确保可以访问broker.emqx.io

### 手势识别问题
1. **识别结果不准确**: 确保手势清晰，摄像头光线良好
2. **上传失败**: 检查服务器日志，确认API接口正常

## 📝 日志说明

Mock Pi会输出详细的运行日志：
- 📸 摄像头抓拍状态
- 📤 图片上传结果
- 📨 MQTT消息接收
- ✅/❌ 操作成功/失败状态

## 🛑 停止运行

按 `Ctrl+C` 停止Mock Pi运行，程序会自动清理资源并断开MQTT连接。

## 🎮 手势测试

为了测试系统，你可以：
1. 做出👍(点赞)手势 → 触发FAN ON
2. 做出👇(拇指向下)手势 → 触发FAN OFF
3. 使用其他手势 → 无操作(unknown)

Mock Pi会在控制台实时显示识别结果和风扇状态变化！