'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function SmartControlPage() {
  // 硬件抽象层 (HAL)
  const [mode, setMode] = useState<'simulation' | 'real'>('simulation');
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState('未开始');
  const [detectedGesture, setDetectedGesture] = useState('--');
  const [confidence, setConfidence] = useState('--%');
  const [processTime, setProcessTime] = useState('--ms');
  const [fanRunning, setFanRunning] = useState(false);
  const [fanSpeed, setFanSpeed] = useState('转速: 0 RPM');
  const [fanTemp, setFanTemp] = useState('温度: --°C');
  const [logs, setLogs] = useState<Array<{time: string, message: string, type: string}>>([]);
  const [raspberryPiIP, setRaspberryPiIP] = useState('');
  const [hardwareConfigVisible, setHardwareConfigVisible] = useState(false);
  const [operationCount, setOperationCount] = useState(0);
  const [responseTime, setResponseTime] = useState('--ms');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 添加日志
  const addLog = (message: string, type: string = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{time: timestamp, message, type}, ...prev.slice(0, 19)]);
  };
  
  // 硬件控制
  const controlFan = async (command: 'on' | 'off') => {
    if (mode === 'simulation') {
      // 模拟控制
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      return {
        success: true,
        command: command,
        mode: 'simulation',
        timestamp: new Date().toISOString(),
        message: `模拟执行: ${command === 'on' ? '启动' : '停止'}风扇`
      };
    } else {
      // 真实控制
      try {
        const ip = raspberryPiIP || '192.168.1.100';
        const response = await fetch(`http://${ip}/api/fan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command: command })
        });
        
        const result = await response.json();
        return {
          success: true,
          command: command,
          mode: 'real',
          timestamp: new Date().toISOString(),
          data: result
        };
      } catch (error: any) {
        return {
          success: false,
          command: command,
          mode: 'real',
          timestamp: new Date().toISOString(),
          error: error.message
        };
      }
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
        setIsStreamActive(true);
        addLog('摄像头已启动', 'success');
        startGestureRecognition();
      }
    } catch (error: any) {
      addLog(`摄像头启动失败: ${error.message}`, 'error');
    }
  };
  
  // 手势识别
  const startGestureRecognition = () => {
    setRecognitionStatus('识别中');
    
    recognitionIntervalRef.current = setInterval(async () => {
      if (!isStreamActive || !videoRef.current || !canvasRef.current) return;
      
      const startTime = Date.now();
      try {
        // 捕获当前帧
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        // 模拟手势识别
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
        const gestures = ['thumbs_up', 'open_palm', 'peace_sign', 'point_up'];
        const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
        const conf = 0.6 + Math.random() * 0.4;
        
        const processTimeMs = Date.now() - startTime;
        
        setDetectedGesture(getGestureName(randomGesture));
        setConfidence(`${(conf * 100).toFixed(1)}%`);
        setProcessTime(`${processTimeMs}ms`);
        
        // 根据手势控制风扇
        if (conf > 0.7) {
          handleGestureCommand(randomGesture);
        }
        
      } catch (error: any) {
        console.error('手势识别错误:', error);
      }
    }, 2000);
  };
  
  // 获取手势名称
  const getGestureName = (gesture: string) => {
    const names: Record<string, string> = {
      'thumbs_up': '👍 点赞',
      'open_palm': '✋ 张开手掌',
      'peace_sign': '✌️ 胜利手势',
      'point_up': '☝️ 指向上',
      'fist': '✊ 拳头',
      'ok': '👌 OK手势'
    };
    return names[gesture] || gesture;
  };
  
  // 处理手势命令
  const handleGestureCommand = async (gesture: string) => {
    let command: 'on' | 'off' | null = null;
    
    switch(gesture) {
      case 'thumbs_up':
      case 'point_up':
        command = 'on';
        break;
      case 'open_palm':
      case 'fist':
      case 'ok':
        command = 'off';
        break;
      default:
        return;
    }
    
    if (command) {
      executeFanControl(command, `手势识别: ${getGestureName(gesture)}`);
    }
  };
  
  // 执行风扇控制
  const executeFanControl = async (command: 'on' | 'off', source: string = '手动操作') => {
    const startTime = Date.now();
    
    try {
      const result = await controlFan(command);
      const responseTimeMs = Date.now() - startTime;
      
      if (result.success) {
        updateFanDisplay(command === 'on');
        addLog(`${source} - ${result.message}`, 'success');
        setOperationCount(prev => prev + 1);
        setResponseTime(`${responseTimeMs}ms`);
      } else {
        addLog(`${source} - 控制失败: ${result.error}`, 'error');
      }
    } catch (error: any) {
      addLog(`${source} - 控制错误: ${error.message}`, 'error');
    }
  };
  
  // 更新风扇显示
  const updateFanDisplay = (isRunning: boolean) => {
    setFanRunning(isRunning);
    if (isRunning) {
      setFanSpeed('转速: 1500 RPM');
      setFanTemp('温度: 25°C');
    } else {
      setFanSpeed('转速: 0 RPM');
      setFanTemp('温度: --°C');
    }
  };
  
  // 模式切换
  const toggleMode = () => {
    const newMode = mode === 'simulation' ? 'real' : 'simulation';
    setMode(newMode);
    setHardwareConfigVisible(newMode === 'real');
    addLog(`已切换到${newMode === 'real' ? '真实' : '模拟'}模式`, 'info');
  };
  
  // 手动测试手势识别
  const manualGestureTest = () => {
    const gestures = ['thumbs_up', 'open_palm', 'peace_sign', 'point_up'];
    const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
    const conf = 0.8 + Math.random() * 0.2;
    
    setDetectedGesture(getGestureName(randomGesture));
    setConfidence(`${(conf * 100).toFixed(1)}%`);
    setProcessTime('150ms');
    addLog(`模拟手势: ${getGestureName(randomGesture)} (${(conf * 100).toFixed(1)}%)`, 'info');
    
    if (conf > 0.7) {
      handleGestureCommand(randomGesture);
    }
  };
  
  // 清空日志
  const clearLogs = () => {
    setLogs([]);
  };
  
  // 初始化
  useEffect(() => {
    addLog('系统初始化完成', 'success');
    addLog('当前运行在模拟模式', 'info');
    
    return () => {
      if (recognitionIntervalRef.current) {
        clearInterval(recognitionIntervalRef.current);
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const logColors: Record<string, string> = {
    'success': 'text-green-400',
    'error': 'text-red-400',
    'warning': 'text-yellow-400',
    'info': 'text-blue-400'
  };
  
  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* 头部 */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold mb-2">智能控制中心</h1>
          <p className="text-gray-400">手势智能控制 • 硬件感知响应</p>
        </div>

        {/* 模式切换 */}
        <div className="mb-6 bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1">运行模式</h3>
              <p className="text-sm text-gray-400">
                当前：{mode === 'simulation' ? '模拟模式（用于演示和测试）' : '真实模式（连接树莓派）'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm">模拟模式</label>
              <button 
                onClick={toggleMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  mode === 'real' ? 'bg-green-600' : 'bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  mode === 'real' ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <label className="text-sm">真实模式</label>
            </div>
          </div>
          {hardwareConfigVisible && (
            <div className="mt-3">
              <input 
                type="text" 
                placeholder="树莓派IP地址 (如: 192.168.1.100)" 
                value={raspberryPiIP}
                onChange={(e) => setRaspberryPiIP(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：摄像头和识别 */}
          <div className="space-y-6">
            {/* 摄像头预览 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                实时摄像头
              </h2>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                <canvas ref={canvasRef} className="hidden" />
                {!isStreamActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                      <p className="text-gray-500 mb-4">点击下方按钮启动摄像头</p>
                      <button 
                        onClick={startCamera}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        启动摄像头
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 手势识别结果 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">手势识别结果</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <span className="text-gray-400">状态</span>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    recognitionStatus === '识别中' ? 'bg-green-600 animate-pulse' : 'bg-gray-600'
                  }`}>
                    {recognitionStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <span className="text-gray-400">识别手势</span>
                  <span className="font-mono text-lg">{detectedGesture}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <span className="text-gray-400">置信度</span>
                  <span className="font-mono">{confidence}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <span className="text-gray-400">处理时间</span>
                  <span className="font-mono">{processTime}</span>
                </div>
              </div>
              <button 
                onClick={manualGestureTest}
                className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                模拟手势识别（测试用）
              </button>
            </div>
          </div>

          {/* 右侧：硬件控制 */}
          <div className="space-y-6">
            {/* 风扇控制面板 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">风扇控制面板</h2>
              <div className="space-y-4">
                {/* 风扇状态显示 */}
                <div className="text-center py-8">
                  <div className={`inline-block mb-4 ${fanRunning ? 'animate-spin' : ''}`}>
                    <svg className="w-24 h-24 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z"/>
                    </svg>
                  </div>
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <div className={`w-3 h-3 rounded-full transition-colors ${
                      fanRunning ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-600'
                    }`} />
                    <span className="text-lg font-semibold">{fanRunning ? '运行中' : '已停止'}</span>
                  </div>
                  <div className="text-gray-400">
                    <span>{fanSpeed}</span> • 
                    <span>{fanTemp}</span>
                  </div>
                </div>

                {/* 手动控制按钮 */}
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => executeFanControl('on', '手动启动')}
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    启动
                  </button>
                  <button 
                    onClick={() => executeFanControl('off', '手动停止')}
                    className="px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
                    </svg>
                    停止
                  </button>
                </div>
              </div>
            </div>

            {/* 控制日志 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">控制日志</h2>
                <button 
                  onClick={clearLogs}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  清空
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
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

            {/* 系统信息 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">系统信息</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-gray-400">连接状态</div>
                  <div className="font-semibold text-green-400">已连接</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-gray-400">API状态</div>
                  <div className="font-semibold text-yellow-400">待测试</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-gray-400">响应时间</div>
                  <div className="font-semibold">{responseTime}</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-gray-400">操作次数</div>
                  <div className="font-semibold">{operationCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}