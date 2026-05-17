#!/bin/bash

echo "=== Newiz 智能控制系统测试 ==="
echo ""

# 检查Next.js服务器是否运行
if ! pgrep -f "next-server" > /dev/null; then
    echo "❌ Next.js服务器未运行"
    echo "请先运行: npm run dev"
    exit 1
fi

echo "✅ Next.js服务器正在运行"
echo ""

# 检查API端点
echo "🔍 检查API端点..."
curl -s http://localhost:3000/api/vision > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Vision API端点正常"
else
    echo "❌ Vision API端点异常"
fi

curl -s http://localhost:3000/api/test-vision > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Test Vision API端点正常"
else
    echo "❌ Test Vision API端点异常"
fi

echo ""
echo "🌐 测试页面链接:"
echo "- 主控制面板: http://localhost:3000/smart-control"
echo "- 测试页面: http://localhost:3000/test-vision"
echo ""
echo "💡 提示: 请确保在浏览器中访问上述URL，而不是直接打开HTML文件"
echo ""