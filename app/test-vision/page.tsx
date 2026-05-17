'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function TestVisionPage() {
  // 状态管理
  const [visionState, setVisionState] = useState<any>(null);
  const [logs, setLogs] = useState<Array<{time: string, message: string, type: string}>>([]);
  
  // DOM元素引用
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 添加日志
  const addLog = (message: string, type: string = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{time: timestamp, message, type}, ...prev.slice(0, 19)]);
  };
  
  // 获取视觉状态
  const fetchVisionState = async () => {
    try {
      const response = await fetch('/api/vision');
      const data = await response.json();
      
      setVisionState(data);
      
      if (data.current_state) {
        addLog('服务器状态更新：在线', 'success');
      }
      
    } catch (error: any) {
      addLog(`获取状态失败: ${error.message}`, 'error');
    }
  };
  
  // 测试服务器连接
  const testServerConnection = async () => {
    try {
      const response = await fetch('/api/vision');
      if (response.ok) {
        addLog('✅ 服务器连接成功', 'success');
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      addLog(`❌ 服务器连接失败: ${error.message}`, 'error');
      return false;
    }
  };
  
  // 模拟图像上传测试
  const testImageUpload = async () => {
    try {
      addLog('🚀 开始模拟图像识别测试...', 'info');
      
      const response = await fetch('/api/test-vision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testMode: true
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        addLog(`✅ 模拟识别成功: ${result.visionResult?.vision?.gesture} (${(result.visionResult?.vision?.confidence * 100).toFixed(1)}%)`, 'success');
        addLog(`📡 MQTT指令: ${result.visionResult?.command?.action} -> ${result.visionResult?.command?.mqtt_topic}`, 'info');
      } else {
        addLog(`❌ 模拟识别失败: ${result.error}`, 'error');
      }
      
      // 更新状态
      fetchVisionState();
      
    } catch (error: any) {
      addLog(`❌ 图像上传测试失败: ${error.message}`, 'error');
    }
  };
  
  // 摄像头图像上传
  const uploadCameraImage = async () => {
    if (!videoRef.current || !canvasRef.current) {
      addLog('摄像头未初始化', 'error');
      return;
    }
    
    try {
      // 捕获当前帧
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      
      // 转换为Blob
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const formData = new FormData();
        formData.append('image', blob, 'camera-capture.jpg');
        formData.append('deviceId', 'web-test-client');
        
        addLog('📸 正在上传摄像头图像...', 'info');
        
        const response = await fetch('/api/vision', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          addLog(`✅ 识别成功: ${result.vision.gesture} (${(result.vision.confidence * 100).toFixed(1)}%)`, 'success');
          addLog(`📡 控制指令: ${result.command.description}`, 'info');
        } else {
          addLog(`❌ 识别失败: ${result.error}`, 'error');
        }
        
        // 更新状态
        fetchVisionState();
      }, 'image/jpeg', 0.9);
      
    } catch (error: any) {
      addLog(`❌ 摄像头图像上传失败: ${error.message}`, 'error');
    }
  };
  
  // 启动摄像头
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        addLog('摄像头已启动', 'success');
      }
    } catch (error: any) {
      addLog(`摄像头启动失败: ${error.message}`, 'error');
    }
  };
  
  // 文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('deviceId', 'file-upload-test');
      
      addLog(`📁 正在上传文件: ${file.name}...`, 'info');
      
      const response = await fetch('/api/vision', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        addLog(`✅ 文件识别成功: ${result.vision.gesture} (${(result.vision.confidence * 100).toFixed(1)}%)`, 'success');
        addLog(`📡 控制指令: ${result.command.description}`, 'info');
      } else {
        addLog(`❌ 文件识别失败: ${result.error}`, 'error');
      }
      
      // 更新状态
      fetchVisionState();
      
    } catch (error: any) {
      addLog(`❌ 文件上传失败: ${error.message}`, 'error');
    }
  };
  
  // 初始化
  useEffect(() => {
    addLog('🔧 测试页面初始化完成', 'success');
    testServerConnection();
    fetchVisionState();
    
    // 定期更新状态
    const interval = setInterval(fetchVisionState, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // 获取状态显示文本
  const getStateDisplay = () => {
    if (!visionState?.current_state) return '--';
    
    const state = visionState.current_state;
    const gestureMap: Record<string, string> = {
      'thumbs_up': '👍 点赞',
      'thumbs_down': '👇 拇指向下',
      'unknown': '❓ 未知'
    };
    
    return {
      lastGesture: gestureMap[state.lastGesture] || state.lastGesture || '--',
      lastCommand: state.lastCommand || '--',
      lastConfidence: state.lastConfidence 
        ? `${(state.lastConfidence * 100).toFixed(1)}%` 
        : '--',
      totalProcessed: state.totalProcessed || 0,
      onCount: state.onCount || 0,
      offCount: state.offCount || 0
    };
  };
  
  const stateDisplay = getStateDisplay();
  const logColors: Record<string, string> = {
    'success': 'text-green-400',
    'error': 'text-red-400',
    'warning': 'text-yellow-400',
    'info': 'text-blue-400'
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Newiz 视觉AI测试页面</h1>
          <p className="text-gray-400">👍/👇手势识别 • MQTT指令下发 • 实时状态监控</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：测试控制 */}
          <div className="space-y-6">
            {/* 摄像头测试 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">📹 摄像头测试</h2>
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover" 
                    autoPlay 
                    playsInline
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={startCamera}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    启动摄像头
                  </button>
                  <button 
                    onClick={uploadCameraImage}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    捕获并识别
                  </button>
                </div>
              </div>
            </div>
            
            {/* 文件上传测试 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">📁 文件上传测试</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">选择图片文件</label>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            
            {/* 模拟测试 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">🧪 模拟测试</h2>
              <div className="space-y-4">
                <button 
                  onClick={testImageUpload}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  模拟图像识别测试
                </button>
                <button 
                  onClick={testServerConnection}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  测试服务器连接
                </button>
                <button 
                  onClick={fetchVisionState}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  刷新状态
                </button>
              </div>
            </div>
          </div>
          
          {/* 右侧：状态和日志 */}
          <div className="space-y-6">
            {/* 实时状态 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">📊 实时状态</h2>
                <span className="text-sm text-gray-400">自动更新(5s)</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">最后识别手势</span>
                  <span className="font-mono">{stateDisplay.lastGesture}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">最后指令</span>
                  <span className="font-mono">{stateDisplay.lastCommand}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">置信度</span>
                  <span className="font-mono">{stateDisplay.lastConfidence}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">总处理次数</span>
                  <span className="font-mono">{stateDisplay.totalProcessed}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-700 rounded text-center">
                    <div className="text-2xl font-bold text-green-400">{stateDisplay.onCount}</div>
                    <div className="text-sm text-gray-400">ON指令</div>
                  </div>
                  <div className="p-3 bg-gray-700 rounded text-center">
                    <div className="text-2xl font-bold text-red-400">{stateDisplay.offCount}</div>
                    <div className="text-sm text-gray-400">OFF指令</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 操作日志 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">📝 操作日志</h2>
                <button 
                  onClick={() => setLogs([])}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  清空
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-sm text-gray-500">等待操作...</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className={`text-sm ${logColors[log.type]} p-2 bg-gray-700 rounded`}>
                      <span className="text-gray-400">{log.time}</span> {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* 页脚信息 */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>API端点: /api/vision | /api/test-vision</p>
          <p>MQTT主题: device/fan/cmd | 模拟MQTT代理: broker.emqx.io:1883</p>
        </div>
      </div>
    </div>
  );
}