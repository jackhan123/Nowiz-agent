'use client';

import React, { useState, useEffect } from 'react';

export default function TestPage() {
  const [visionState, setVisionState] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const [isPolling, setIsPolling] = useState(false);

  // 获取视觉API状态
  const fetchVisionState = async () => {
    try {
      const response = await fetch('/api/vision');
      const data = await response.json();
      setVisionState(data);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch vision state:', error);
    }
  };

  // 测试视觉API
  const testVisionAPI = async () => {
    try {
      const response = await fetch('/api/test-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testMode: true })
      });
      const data = await response.json();
      console.log('Test result:', data);
      await fetchVisionState(); // 刷新状态
    } catch (error) {
      console.error('Test failed:', error);
    }
  };

  // 自动轮询
  useEffect(() => {
    fetchVisionState();
    const interval = setInterval(fetchVisionState, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">
          🎯 Mock Pi 实时监控系统
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 系统状态 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">📊 系统状态</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>自动轮询:</span>
                <span className={isPolling ? 'text-green-400' : 'text-gray-400'}>
                  {isPolling ? '运行中' : '已停止'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>最后更新:</span>
                <span className="text-blue-400">{lastUpdate || '--'}</span>
              </div>
              <div className="flex justify-between">
                <span>MQTT代理:</span>
                <span className="text-green-400">broker.emqx.io:1883</span>
              </div>
              <div className="flex justify-between">
                <span>MQTT主题:</span>
                <span className="text-yellow-400">device/fan/cmd</span>
              </div>
            </div>
          </div>

          {/* 控制面板 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">🎮 控制面板</h2>
            <div className="space-y-4">
              <button
                onClick={testVisionAPI}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                🧪 测试视觉识别API
              </button>
              <button
                onClick={() => setIsPolling(!isPolling)}
                className={`w-full px-4 py-2 rounded transition-colors ${
                  isPolling 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isPolling ? '⏸️ 停止轮询' : '▶️ 开始轮询'}
              </button>
              <button
                onClick={fetchVisionState}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
              >
                🔄 刷新状态
              </button>
            </div>
          </div>
        </div>

        {/* 视觉识别状态 */}
        {visionState && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">👁️ 视觉识别状态</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700 p-4 rounded">
                <h3 className="font-semibold mb-2">最后识别结果</h3>
                <div className="text-2xl mb-2">
                  {visionState.current_state?.lastGesture === 'thumbs_up' && '👍'}
                  {visionState.current_state?.lastGesture === 'thumbs_down' && '👇'}
                  {visionState.current_state?.lastGesture === 'unknown' && '❓'}
                  {!visionState.current_state?.lastGesture && '--'}
                </div>
                <div className="text-sm text-gray-400">
                  {visionState.current_state?.lastGesture || '无'}
                </div>
              </div>

              <div className="bg-gray-700 p-4 rounded">
                <h3 className="font-semibold mb-2">最后指令</h3>
                <div className="text-xl mb-2">
                  {visionState.current_state?.lastCommand === 'ON' && '🔥 ON'}
                  {visionState.current_state?.lastCommand === 'OFF' && '❄️ OFF'}
                  {visionState.current_state?.lastCommand === 'NONE' && '⭕ NONE'}
                  {!visionState.current_state?.lastCommand && '--'}
                </div>
                <div className="text-sm text-gray-400">
                  {visionState.current_state?.lastCommand || '无'}
                </div>
              </div>

              <div className="bg-gray-700 p-4 rounded">
                <h3 className="font-semibold mb-2">置信度</h3>
                <div className="text-xl mb-2">
                  {visionState.current_state?.lastConfidence 
                    ? `${(visionState.current_state.lastConfidence * 100).toFixed(1)}%`
                    : '--'
                  }
                </div>
                <div className="text-sm text-gray-400">识别准确度</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700 p-4 rounded text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {visionState.current_state?.totalProcessed || 0}
                </div>
                <div className="text-sm text-gray-400">总处理次数</div>
              </div>

              <div className="bg-gray-700 p-4 rounded text-center">
                <div className="text-2xl font-bold text-yellow-400 mb-1">
                  {visionState.current_state?.onCount || 0}
                </div>
                <div className="text-sm text-gray-400">ON指令次数</div>
              </div>

              <div className="bg-gray-700 p-4 rounded text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">
                  {visionState.current_state?.offCount || 0}
                </div>
                <div className="text-sm text-gray-400">OFF指令次数</div>
              </div>
            </div>

            {visionState.current_state?.lastProcessedAt && (
              <div className="mt-4 text-sm text-gray-400 text-center">
                最后处理时间: {new Date(visionState.current_state.lastProcessedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* 手势映射表 */}
        {visionState?.gesture_mapping && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">📋 手势映射表</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(visionState.gesture_mapping).map(([gesture, info]) => (
                <div key={gesture} className="bg-gray-700 p-4 rounded flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{gesture}</div>
                    <div className="text-sm text-gray-400">{info.description}</div>
                  </div>
                  <div className="text-lg">
                    {gesture.includes('thumbs_up') && '👍'}
                    {gesture.includes('thumbs_down') && '👇'}
                    {gesture.includes('unknown') && '❓'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📖 使用说明</h2>
          <div className="space-y-3 text-sm text-gray-300">
            <div>1. 确保 Next.js 服务运行在 <code className="bg-gray-700 px-2 py-1 rounded">localhost:3000</code></div>
            <div>2. 启动 Mock Pi: <code className="bg-gray-700 px-2 py-1 rounded">python run_mock_pi.py</code></div>
            <div>3. 对着摄像头做出手势:</div>
            <div className="ml-4">
              <div>👍 点赞手势 → 触发 ON 指令</div>
              <div>👇 拇指向下 → 触发 OFF 指令</div>
            </div>
            <div>4. 观察 Mock Pi 控制台和本页面的实时状态变化</div>
            <div>5. 页面每2秒自动刷新，显示最新的识别结果</div>
          </div>
        </div>
      </div>
    </div>
  );
}