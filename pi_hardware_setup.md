# 树莓派硬件连接指南

## 🔌 GPIO 引脚连接

### 风扇控制电路
```
树莓派 GPIO 18 (物理引脚12) → 继电器模块 IN+
树莓派 GND (物理引脚14)    → 继电器模块 IN-
树莓派 5V (物理引脚2)    → 继电器模块 VCC
树莓派 GND (物理引脚6)    → 继电器模块 GND

继电器输出:
继电器 COM → 风扇正极
继电器 NO  → 风扇电源正极
风扇负极 → 电源负极
```

### 状态LED指示
```
树莓派 GPIO 24 (物理引脚18) → 220Ω电阻 → LED正极
树莓派 GND (物理引脚20)    → LED负极
```

## 📷 摄像头连接

### CSI摄像头（推荐）
```
CSI接口 (位于主板边缘) → 排线 → 摄像头模块
注意：排线蓝色面朝向USB接口
```

### USB摄像头
```
任意USB接口 → USB摄像头
推荐：Logitech C270 或类似规格
```

## ⚡ 电源要求

### 供电配置
- **树莓派**: 5V 3A USB-C电源适配器
- **风扇**: 5V/12V（根据风扇规格）
- **继电器**: 5V供电

### 功耗估算
```
树莓派4B: ~3-7W
摄像头: ~2-3W
继电器: ~0.5W
风扇: ~5-15W
总计: ~10-25W
```

## 🔧 配置文件

### 启用摄像头接口
```bash
# 编辑配置文件
sudo raspi-config

# 选择：
# Interface Options → Legacy Camera → Enable
# 或：Interface Options → Camera → Enable

# 重启生效
sudo reboot
```

### 检查硬件连接
```bash
# 检查摄像头
v4l2-ctl --list-devices
ls /dev/video*

# 检查GPIO权限
ls -l /dev/gpiomem
groups $USER  # 确认用户在gpio组中
```

## 🛡️ 安全注意事项

### 电路保护
1. **继电器保护**：
   - 在继电器线圈两端并联二极管（1N4007）
   - 防止反向电动势损坏GPIO

2. **风扇保护**：
   - 根据风扇电压选择合适继电器
   - 大功率风扇需要额外散热

3. **接线安全**：
   - 断电操作
   - 检查接线正确性
   - 避免短路

### 软件安全
```python
# GPIO安全初始化
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(pin, GPIO.OUT)
GPIO.output(pin, GPIO.LOW)  # 默认关闭

# 程序退出时清理
try:
    main_loop()
except KeyboardInterrupt:
    GPIO.cleanup()
```

## 🧪 测试步骤

### 1. 基础GPIO测试
```python
import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(18, GPIO.OUT)

print("Testing GPIO 18...")
for i in range(5):
    GPIO.output(18, GPIO.HIGH)
    print("ON")
    time.sleep(2)
    GPIO.output(18, GPIO.LOW)
    print("OFF")
    time.sleep(2)

GPIO.cleanup()
```

### 2. 摄像头测试
```bash
# 使用fswebcam测试
fswebcam -r 320x240 --jpeg 85 -D 1 test.jpg

# 或使用libcamera
libcamera-still -o test.jpg --width 320 --height 240
```

### 3. 完整系统测试
```bash
# 运行真实控制器
python3 real_pi_controller.py
```

## 🐛 故障排除

### 常见问题

**摄像头无法访问**
```bash
# 检查设备权限
sudo usermod -a -G video $USER
# 重新登录后生效

# 检查设备
ls -la /dev/video0
```

**GPIO权限问题**
```bash
# 添加用户到gpio组
sudo usermod -a -G gpio $USER
# 重新登录后生效

# 或使用sudo运行
sudo python3 real_pi_controller.py
```

**MQTT连接失败**
```bash
# 测试网络连接
ping broker.emqx.io

# 检查防火墙
sudo ufw status
```

### 调试模式
在代码中启用详细日志：
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# 添加更多状态输出
print(f"Debug: GPIO state = {GPIO.input(self.fan_pin)}")
print(f"Debug: Camera temp = {self.camera._camera.temperature}")
```

## 📋 接线图

```
树莓派4B引脚图：
物理引脚   GPIO     功能
    2       5V      5V电源
    6       GND      地线
   12      18       风扇控制
   18      24       LED指示
   14      GND      地线
```

## 🚀 启动序列

1. **连接所有硬件**
2. **上电检查**：检查LED指示
3. **运行安装脚本**：`bash install_real_pi.sh`
4. **测试硬件**：运行基础测试
5. **启动完整系统**：`python3 real_pi_controller.py`
6. **测试手势控制**：👍开风扇，👇关风扇