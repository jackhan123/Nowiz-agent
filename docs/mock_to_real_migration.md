# Mock Pi → 真实Pi 迁移指南

## 📊 功能对比表

| 功能 | Mock Pi | 真实Pi | 迁移说明 |
|------|---------|---------|----------|
| **摄像头抓拍** | FFmpeg + 系统摄像头 | PiCamera/OpenCV | 替换摄像头库 |
| **图像上传** | requests (相同) | requests (相同) | 无需修改 |
| **GPIO控制** | 模拟状态 | RPi.GPIO | 添加硬件控制 |
| **MQTT通信** | paho-mqtt (相同) | paho-mqtt (相同) | 无需修改 |
| **设备标识** | 模拟ID | 树莓派序列号 | 更换ID生成逻辑 |
| **状态显示** | ASCII艺术 | 硬件LED + ASCII | 添加物理LED |

## 🔧 关键代码替换

### 1. 摄像头模块替换

**Mock Pi (FFmpeg):**
```python
subprocess.run([
    'ffmpeg', '-f', 'avfoundation', '-i', '0',
    '-vframes', '1', '-s', '320x240', '-y', 'snap.jpg'
])
```

**真实Pi (PiCamera):**
```python
from picamera import PiCamera

camera = PiCamera()
camera.resolution = (320, 240)
camera.capture('snap.jpg', format='jpeg', quality=85)
```

**或 (OpenCV):**
```python
import cv2

camera = cv2.VideoCapture(0)
camera.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
ret, frame = camera.read()
cv2.imwrite('snap.jpg', frame)
```

### 2. GPIO控制替换

**Mock Pi (状态变量):**
```python
def control_fan(self, command):
    self.fan_status = command
    print(f"Fan status: {command}")
```

**真实Pi (硬件控制):**
```python
import RPi.GPIO as GPIO

def control_fan(self, command):
    if command == "ON":
        GPIO.output(self.fan_pin, GPIO.HIGH)
    elif command == "OFF":
        GPIO.output(self.fan_pin, GPIO.LOW)
    self.fan_status = command
```

### 3. 设备标识替换

**Mock Pi (系统检测):**
```python
self.device_id = f"mock-pi-{self.system.lower()}"
```

**真实Pi (硬件序列号):**
```python
def get_device_id(self):
    with open('/proc/cpuinfo', 'r') as f:
        for line in f:
            if line.startswith('Serial'):
                return f"pi-{line.split(':')[1].strip()[:8]}"
```

## 📦 安装步骤

### 1. 系统准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 启用摄像头接口
sudo raspi-config
# 选择: Interface Options → Camera → Enable
```

### 2. 安装依赖
```bash
# 使用提供的安装脚本
bash install_real_pi.sh

# 或手动安装
pip3 install requests paho-mqtt
pip3 install RPi.GPIO
pip3 install picamera2  # 或 picamera
pip3 install opencv-python
```

### 3. 硬件连接
按照 `pi_hardware_setup.md` 连接：
- 风扇继电器 → GPIO 18
- 状态LED → GPIO 24  
- CSI摄像头或USB摄像头

## 🧪 测试验证

### 1. 硬件测试
```bash
# 测试GPIO
python3 -c "
import RPi.GPIO as GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup(18, GPIO.OUT)
GPIO.output(18, GPIO.HIGH)
print('GPIO 18 HIGH')
time.sleep(2)
GPIO.output(18, GPIO.LOW)
print('GPIO 18 LOW')
GPIO.cleanup()
"

# 测试摄像头
raspistill -o test.jpg -w 320 -h 240
# 或
libcamera-still -o test.jpg --width 320 --height 240
```

### 2. 软件测试
```bash
# 运行简化版控制器
python3 pi_simple_controller.py

# 或运行完整版控制器  
python3 real_pi_controller.py
```

## 🚀 部署选项

### 选项1: 直接替换
```bash
# 备份原文件
mv mock_pi.py mock_pi.py.bak

# 部署真实控制器
cp pi_simple_controller.py mock_pi.py
python3 mock_pi.py
```

### 选项2: 并行运行
```bash
# Mock Pi继续运行（测试）
python3 mock_pi.py &

# 真实Pi运行（生产）
python3 real_pi_controller.py &
```

### 选项3: 配置切换
```python
# 在代码中添加配置选项
USE_MOCK_MODE = False  # False使用真实硬件

if USE_MOCK_MODE:
    from mock_pi import MockPi
    controller = MockPi()
else:
    from real_pi_controller import RealPiController
    controller = RealPiController()
```

## 📋 迁移检查清单

### ✅ 软件准备
- [ ] 树莓派OS已更新
- [ ] 摄像头接口已启用
- [ ] Python依赖已安装
- [ ] 代码已部署

### ✅ 硬件准备  
- [ ] 风扇继电器已连接
- [ ] 状态LED已连接
- [ ] 摄像头已安装
- [ ] 电源充足

### ✅ 功能测试
- [ ] GPIO控制正常
- [ ] 摄像头抓拍正常
- [ ] 网络连接正常
- [ ] 手势识别正常
- [ ] 风扇响应正常

### ✅ 生产部署
- [ ] 开机自启动配置
- [ ] 错误日志记录
- [ ] 远程监控设置
- [ ] 备份方案制定

## 🔍 常见问题

### 摄像头问题
**问题**: `picamera` 库找不到
**解决**: 使用 `picamera2` (新版) 或 `opencv-python`

```python
# 新版树莓派
from picamera2 import Picamera2
camera = Picamera2()
camera.configure(camera.create_preview_configuration(main={"size": (320, 240)})

# 或使用OpenCV
import cv2
camera = cv2.VideoCapture(0)
```

### GPIO权限问题
**问题**: `Permission denied`
**解决**: 添加用户到gpio组或使用sudo

```bash
# 添加到gpio组
sudo usermod -a -G gpio $USER
# 重新登录生效

# 或直接用sudo运行
sudo python3 real_pi_controller.py
```

### 性能优化
**问题**: CPU占用过高
**解决**: 降低抓拍频率或图像质量

```python
# 优化设置
self.camera_resolution = (240, 180)  # 降低分辨率  
self.upload_interval = 5  # 降低抓拍频率
camera_quality = 70  # 降低JPEG质量
```

## 📈 监控和维护

### 状态监控
```python
# 添加系统状态检查
def get_system_status(self):
    import psutil
    return {
        'cpu_temp': self.get_cpu_temperature(),
        'cpu_usage': psutil.cpu_percent(),
        'memory_usage': psutil.virtual_memory().percent,
        'disk_usage': psutil.disk_usage('/').percent
    }
```

### 日志记录
```python
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/pi_controller.log'),
        logging.StreamHandler()
    ]
)
```

## 🎯 下一步

1. **硬件测试**: 完成所有硬件连接和基础测试
2. **软件部署**: 选择合适的部署方式
3. **功能验证**: 确保手势识别和风扇控制正常
4. **生产优化**: 添加监控、日志和错误处理
5. **长期维护**: 设置自动更新和备份机制

完成迁移后，你就拥有了一个功能完整的AI手势控制硬件系统！🚀