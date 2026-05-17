'use client';

import React, { useState, useEffect } from 'react';

export default function UniversalHardwarePage() {
  // 左栏对话状态
  const [chatMessages, setChatMessages] = useState<Array<{role: string, message: string, timestamp: string}>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const [isRequirementComplete, setIsRequirementComplete] = useState(false);
  const [requirementData, setRequirementData] = useState<any>(null);
  
  // 右栏控制台状态
  const [hardwareConfig, setHardwareConfig] = useState<any>(null);
  const [logs, setLogs] = useState<Array<{time: string, message: string, type: string}>>([]);
  const [controlStates, setControlStates] = useState<Record<string, any>>({});
  
  // 添加日志
  const addLog = (message: string, type: string = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{time: timestamp, message, type}, ...prev.slice(0, 19)]);
  };
  

  
  // 开始制造
  const startManufacturing = async () => {
    if (!currentMessage.trim()) return;
    
    try {
      console.log('[DEBUG] Starting manufacturing with message:', currentMessage);
      
      // 添加用户消息到对话
      setChatMessages(prev => [...prev, {
        role: 'user',
        message: currentMessage,
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      addLog('🚀 开始制造...', 'info');
      
      // 调用硬件代码生成API
      console.log('[DEBUG] Generating hardware for requirement:', currentMessage);
      
      const response = await fetch('/api/ai/generate-hardware', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userRequirement: currentMessage
        })
      });
      
      console.log('[DEBUG] API response status:', response.status);
      const result = await response.json();
      console.log('[DEBUG] API response result:', result);
      
      if (result.success) {
        setHardwareConfig(result);
        setIsRequirementComplete(true);
        setRequirementData({
          project_name: result.hardware_type,
          core_function: currentMessage,
          description: result.hardware_config.description
        });
        
        addLog(`✅ 硬件代码生成完成`, 'success');
        addLog(`硬件类型: ${result.hardware_type}`, 'info');
        addLog(`生成文件: ${result.code.filename}`, 'info');
        addLog(`MQTT主题: ${result.mqtt_topics.commands}`, 'info');
        
        // 如果有Python代码，提供下载
        if (result.code.python) {
          const blob = new Blob([result.code.python], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.code.filename;
          a.click();
          URL.revokeObjectURL(url);
          
          addLog(`📥 已下载Python代码: ${result.code.filename}`, 'success');
        }
        
      } else {
        addLog(`❌ 硬件生成失败: ${result.error}`, 'error');
        if (result.suggestion) {
          addLog(`💡 建议: ${result.suggestion}`, 'warning');
        }
      }
      
    } catch (error: any) {
      addLog(`❌ 制造请求失败: ${error.message}`, 'error');
    }
  };
  
  // 执行控制命令
  const executeControl = async (control: any, action: string) => {
    try {
      addLog(`执行控制: ${control.label} -> ${action}`, 'info');
      
      // 更新状态
      setControlStates(prev => ({
        ...prev,
        [control.mqtt_topic]: action
      }));
      
      // 模拟MQTT发布
      const payload = {
        command: action,
        hardware: hardwareConfig.hardware.name,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[MQTT SIMULATION] Published to ${control.mqtt_topic}:`, payload);
      
      addLog(`指令已发送: ${control.mqtt_topic} -> ${action}`, 'success');
      
      // 模拟硬件响应
      setTimeout(() => {
        addLog(`${control.label}响应成功`, 'success');
      }, 1000);
      
    } catch (error: any) {
      addLog(`控制执行失败: ${error.message}`, 'error');
    }
  };
  
  // 渲染控制组件
  const renderControl = (control: any) => {
    const currentState = controlStates[control.mqtt_topic];
    
    switch (control.type) {
      case 'toggle':
        return (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3">{control.label}</h3>
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-sm ${
                currentState === 'on' ? 'bg-green-600' : 'bg-gray-600'
              }`}>
                {currentState === 'on' ? '开启' : '关闭'}
              </span>
              <div className="space-x-2">
                <button 
                  onClick={() => executeControl(control, 'on')}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  开启
                </button>
                <button 
                  onClick={() => executeControl(control, 'off')}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              主题: {control.mqtt_topic}
            </div>
          </div>
        );
        
      case 'button':
        return (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3">{control.label}</h3>
            <div className="grid grid-cols-2 gap-2">
              {control.actions.map((action: string) => (
                <button 
                  key={action}
                  onClick={() => executeControl(control, action)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  {action}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              主题: {control.mqtt_topic}
            </div>
          </div>
        );
        
      default:
        return (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-3">{control.label}</h3>
            <div className="text-gray-400">
              未知控制类型: {control.type}
            </div>
          </div>
        );
    }
  };
  
  // 渲染硬件控制面板
  const renderHardwareControls = (hardwareType: string) => {
    switch (hardwareType) {
      case 'AI占卜水晶球':
        return (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-semibold mb-4">水晶球控制</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => controlCrystalBall('start_divination')}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition"
              >
                开始占卜
              </button>
              <button 
                onClick={() => controlCrystalBall('toggle_voice')}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition border border-gray-700"
              >
                切换语音
              </button>
            </div>
          </div>
        );
        
      case '手势控制台灯':
        return (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-semibold mb-4">台灯控制</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => controlLamp('on')}
                  className="px-4 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-medium transition"
                >
                  开灯
                </button>
                <button 
                  onClick={() => controlLamp('off')}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition border border-gray-700"
                >
                  关灯
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => controlLamp('up')}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm border border-gray-700 transition"
                >
                  变亮
                </button>
                <button 
                  onClick={() => controlLamp('down')}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm border border-gray-700 transition"
                >
                  变暗
                </button>
              </div>
            </div>
          </div>
        );
        
      case '手势控制风扇':
        return (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-semibold mb-4">风扇控制</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => controlFan('on')}
                  className="px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition"
                >
                  开启
                </button>
                <button 
                  onClick={() => controlFan('off')}
                  className="px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition border border-gray-700"
                >
                  关闭
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => controlFan('low')}
                  className="px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs border border-gray-700 transition"
                >
                  低速
                </button>
                <button 
                  onClick={() => controlFan('medium')}
                  className="px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs border border-gray-700 transition"
                >
                  中速
                </button>
                <button 
                  onClick={() => controlFan('high')}
                  className="px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs border border-gray-700 transition"
                >
                  高速
                </button>
                <button 
                  onClick={() => controlFan('auto')}
                  className="px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs border border-gray-700 transition"
                >
                  自动
                </button>
              </div>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-lg font-semibold mb-3">硬件控制</h3>
            <div className="text-sm text-gray-400">
              该硬件类型暂不支持Web控制，请使用生成的Python模拟器
            </div>
          </div>
        );
    }
  };

  // 水晶球控制函数
  const controlCrystalBall = async (action: string) => {
    try {
      addLog(`🔮 执行水晶球控制: ${action}`, 'info');
      
      const response = await fetch('/api/crystal-ball', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          device_id: 'crystal-ball-001'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        addLog(`✅ 水晶球操作成功: ${result.action}`, 'success');
        
        if (result.fortune) {
          addLog(`📜 占卜结果: ${result.fortune}`, 'info');
        }
        
        if (result.voice_enabled !== undefined) {
          addLog(`🔊 语音状态: ${result.voice_enabled ? '开启' : '关闭'}`, 'info');
        }
      } else {
        addLog(`❌ 水晶球操作失败: ${result.error}`, 'error');
      }
    } catch (error: any) {
      addLog(`❌ 水晶球请求失败: ${error.message}`, 'error');
    }
  };

  // 台灯控制函数
  const controlLamp = async (action: string) => {
    try {
      addLog(`💡 执行台灯控制: ${action}`, 'info');
      
      // 这里可以调用台灯API，暂时模拟
      addLog(`✅ 台灯操作成功: ${action}`, 'success');
      
      // 模拟MQTT发布
      console.log(`[LAMP CONTROL] Command: ${action}`);
    } catch (error: any) {
      addLog(`❌ 台灯控制失败: ${error.message}`, 'error');
    }
  };

  // 风扇控制函数  
  const controlFan = async (action: string) => {
    try {
      addLog(`🌀 执行风扇控制: ${action}`, 'info');
      
      // 这里可以调用风扇API，暂时模拟
      addLog(`✅ 风扇操作成功: ${action}`, 'success');
      
      // 模拟MQTT发布
      console.log(`[FAN CONTROL] Command: ${action}`);
    } catch (error: any) {
      addLog(`❌ 风扇控制失败: ${error.message}`, 'error');
    }
  };

  const logColors: Record<string, string> = {
    'success': 'text-green-400',
    'error': 'text-red-400',
    'warning': 'text-yellow-400',
    'info': 'text-blue-400'
  };
  
  return (
    <div className="min-h-screen bg-black text-white">
      {/* 顶部导航栏 */}
      <nav className="border-b border-gray-800">
        <div className="container mx-auto px-8 py-4 flex items-center justify-between">
          <div className="text-xl font-light tracking-wider">NOWIZ</div>
          <div className="flex items-center gap-12">
            <a href="#" className="text-sm tracking-wider hover:text-gray-400 transition">CREATION</a>
            <a href="#" className="text-sm tracking-wider text-white border-b-2 border-white pb-1">HARDWARE</a>
            <a href="#" className="text-sm tracking-wider hover:text-gray-400 transition">MONITOR</a>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-8 py-12 max-w-5xl h-screen flex flex-col">
        {/* 头部 */}
        <div className="text-left mb-12">
          <h1 className="text-5xl font-light mb-4 tracking-tight">描述你的创意</h1>
          <p className="text-gray-400 text-lg font-light">用自然语言告诉我们你想做什么，AI 将为你生成完整方案</p>
        </div>
        
        {/* 主要内容区域 */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* 选项卡区域 */}
          {hardwareConfig && (
            <div className="flex gap-4 mb-4">
              <button className="px-6 py-2 bg-white text-black rounded-lg text-sm font-medium flex items-center gap-2">
                <span className="text-lg">▶</span>
                正在分析需求并生成方案...
              </button>
              <button className="px-6 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-400 flex items-center gap-2">
                <span className="text-lg">▶</span>
                正在分析需求并生成方案...
              </button>
            </div>
          )}

          {/* 中间内容区 */}
          <div className="flex-1 bg-gray-950 rounded-2xl border border-gray-800 p-8 overflow-y-auto">
            {!hardwareConfig ? (
              // 示例展示
              <div className="flex items-start gap-6">
                <div className="text-gray-500 text-sm flex-shrink-0 mt-1">示例</div>
                <div className="flex-1">
                  <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <p className="text-white text-lg mb-4">制作一个智能语音助手机器人</p>
                    <div className="flex items-center gap-3 text-gray-500 text-sm">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // 硬件配置结果展示
              <div className="space-y-6">
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <h3 className="text-xl font-semibold mb-4">{hardwareConfig.hardware_type}</h3>
                  <p className="text-gray-400 mb-4">{hardwareConfig.hardware_config?.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 mb-2">传感器</div>
                      <div className="text-white">{hardwareConfig.hardware_config?.sensors?.join(', ')}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-2">执行器</div>
                      <div className="text-white">{hardwareConfig.hardware_config?.actuators?.join(', ')}</div>
                    </div>
                  </div>
                </div>

                {/* 代码信息 */}
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                  <h3 className="text-lg font-semibold mb-4">生成的代码</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">文件名:</span>
                      <span className="font-mono text-gray-300">{hardwareConfig.code?.filename}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">依赖:</span>
                      <span className="text-gray-300">{hardwareConfig.code?.dependencies?.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* 控制面板 */}
                {renderHardwareControls(hardwareConfig.hardware_type)}

                {/* 日志 */}
                {logs.length > 0 && (
                  <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <h3 className="text-lg font-semibold mb-4">操作日志</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {logs.map((log, index) => (
                        <div key={index} className={`text-xs ${logColors[log.type]} p-2 bg-gray-950 rounded`}>
                          <span className="text-gray-500">{log.time}</span> {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 底部输入区域 */}
          <div className="bg-gray-950 rounded-2xl border border-gray-800 p-6">
            <div className="flex items-end gap-4">
              {/* 左侧图片上传按钮 */}
              <button className="p-3 bg-gray-900 hover:bg-gray-800 rounded-xl border border-gray-800 transition">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              
              {/* 中间输入框 */}
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    startManufacturing();
                  }
                }}
                placeholder="描述你的创意想法..."
                className="flex-1 px-6 py-4 bg-transparent border-none focus:outline-none text-white placeholder-gray-600 resize-none"
                rows={1}
                style={{ minHeight: '60px', maxHeight: '200px' }}
              />
              
              {/* 右侧发送按钮 */}
              <button
                onClick={startManufacturing}
                disabled={!currentMessage.trim()}
                className="px-8 py-4 bg-white hover:bg-gray-100 disabled:bg-gray-800 disabled:text-gray-600 text-black rounded-xl font-medium transition flex items-center gap-2"
              >
                发送
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        textarea {
          scrollbar-width: thin;
          scrollbar-color: #374151 transparent;
        }
        
        textarea::-webkit-scrollbar {
          width: 4px;
        }
        
        textarea::-webkit-scrollbar-track {
          background: transparent;
        }
        
        textarea::-webkit-scrollbar-thumb {
          background-color: #374151;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}