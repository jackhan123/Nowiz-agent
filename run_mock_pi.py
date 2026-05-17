#!/usr/bin/env python3
"""
Mock Pi 快速启动脚本
"""

import os
import sys

def check_dependencies():
    """检查并安装依赖"""
    print("🔍 Checking dependencies...")
    
    required_packages = ['requests', 'paho-mqtt']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
            print(f"✅ {package} is installed")
        except ImportError:
            print(f"❌ {package} is missing")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n📦 Installing missing packages: {', '.join(missing_packages)}")
        try:
            import subprocess
            subprocess.check_call([
                sys.executable, "-m", "pip", "install"
            ] + missing_packages)
            print("✅ All dependencies installed successfully!")
        except subprocess.CalledProcessError:
            print("❌ Failed to install dependencies. Please run manually:")
            print(f"   pip install {' '.join(missing_packages)}")
            return False
    
    return True

def main():
    print("🚀 Mock Pi Quick Start")
    print("=" * 50)
    
    if not check_dependencies():
        sys.exit(1)
    
    print("\n🎯 Starting Mock Pi...")
    print("Make sure Next.js server is running on localhost:3000")
    print("=" * 50)
    
    # 导入并运行Mock Pi
    from mock_pi import MockPi
    mock_pi = MockPi()
    mock_pi.run()

if __name__ == "__main__":
    main()