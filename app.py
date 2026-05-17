import os
from flask import Flask, send_from_directory, request, jsonify, Response
import requests
import json

app = Flask(__name__, static_folder='.')

# 阿里云 API 配置
API_KEY = os.getenv("DASHSCOPE_KEY")
API_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

@app.route('/')
def index():
    return send_from_directory('.', 'hardware-lab-final.html')

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    try:
        data = request.json
        
        # 转发请求到阿里云 DashScope
        headers = {
            'Authorization': f'Bearer {API_KEY}',
            'Content-Type': 'application/json',
        }
        
        # 保持流式输出
        is_stream = data.get('stream', False)
        
        response = requests.post(
            API_ENDPOINT,
            headers=headers,
            json=data,
            stream=is_stream,
            timeout=60
        )

        if is_stream:
            def generate():
                for chunk in response.iter_lines():
                    if chunk:
                        yield chunk.decode('utf-8') + '\n'
            return Response(generate(), mimetype='text/event-stream')
        else:
            return jsonify(response.json())

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 AI 硬件实验室启动中...")
    print("📱 访问: http://0.0.0.0:7860")
    app.run(debug=True, port=7860, host='0.0.0.0')
