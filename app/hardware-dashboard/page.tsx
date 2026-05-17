'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, 
  Wifi, 
  WifiOff, 
  Cpu, 
  HardDrive, 
  Thermometer, 
  Activity,
  Upload,
  Eye,
  Power,
  Settings,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

// 硬件设备类型定义
interface HardwareDevice {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: string;
  specs: {
    cpu: string;
    memory: string;
    storage: string;
    camera: string;
    sensors: string[];
  };
}

// 系统状态类型定义
interface SystemStatus {
  uptime: string;
  cpuUsage: string;
  memoryUsage: string;
  networkLatency: string;
  temperature: string;
}

// 手势识别结果类型
interface GestureResult {
  gesture: string;
  confidence: number;
  action: string;
  timestamp: string;
}

export default function HardwareDashboard() {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [gestureHistory, setGestureHistory] = useState<GestureResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 获取硬件状态
  useEffect(() => {
    fetchHardwareStatus();
    const interval = setInterval(fetchHardwareStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchHardwareStatus = async () => {
    try {
      const response = await fetch('/api/hardware/status');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        setSystemStatus(data.system);
        setIsConnected(data.devices?.some((d: HardwareDevice) => d.status === 'online') || false);
      }
    } catch (error) {
      console.error('Failed to fetch hardware status:', error);
      setIsConnected(false);
    }
  };

  // 处理文件上传
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
    }
  };

  const uploadImage = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('deviceId', 'raspberry-pi-001');

    try {
      const response = await fetch('/api/hardware/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setGestureHistory(prev => [result.analysis, ...prev].slice(0, 10));
        // 重新获取状态
        fetchHardwareStatus();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-gray-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle className="w-4 h-4" />;
      case 'offline': return <WifiOff className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">硬件监控中心</h1>
            <p className="text-gray-600 mt-1">实时监控和控制硬件设备状态</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? (
                <><Wifi className="w-4 h-4 mr-1" />已连接</>
              ) : (
                <><WifiOff className="w-4 h-4 mr-1" />未连接</>
              )}
            </Badge>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              设置
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：设备列表 */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="w-5 h-5 mr-2" />
                  设备列表
                </CardTitle>
                <CardDescription>连接的硬件设备</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {devices.map((device) => (
                  <div key={device.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{device.name}</h3>
                      <div className={`flex items-center ${getStatusColor(device.status)}`}>
                        {getStatusIcon(device.status)}
                        <span className="ml-1 text-sm">{device.status}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>类型: {device.type}</div>
                      <div>CPU: {device.specs.cpu}</div>
                      <div>内存: {device.specs.memory}</div>
                      <div>摄像头: {device.specs.camera}</div>
                      <div className="text-xs mt-2">
                        最后在线: {new Date(device.lastSeen).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 系统状态 */}
            {systemStatus && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    系统状态
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>CPU使用率</span>
                      <span>{systemStatus.cpuUsage}</span>
                    </div>
                    <Progress value={parseInt(systemStatus.cpuUsage)} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>内存使用率</span>
                      <span>{systemStatus.memoryUsage}</span>
                    </div>
                    <Progress value={parseInt(systemStatus.memoryUsage)} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center">
                      <Thermometer className="w-4 h-4 mr-2 text-orange-500" />
                      <span>温度: {systemStatus.temperature}</span>
                    </div>
                    <div className="flex items-center">
                      <Wifi className="w-4 h-4 mr-2 text-blue-500" />
                      <span>延迟: {systemStatus.networkLatency}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    运行时间: {systemStatus.uptime}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧：控制和监控 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 图像上传测试 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Camera className="w-5 h-5 mr-2" />
                  手势识别测试
                </CardTitle>
                <CardDescription>上传图片测试手势识别功能</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <div className="space-y-2">
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-500">选择图片</span>
                      <span className="text-gray-600"> 或拖拽图片到这里</span>
                    </label>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {selectedFile && (
                      <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-gray-500">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={uploadImage}
                    disabled={!selectedFile || isUploading}
                    className="mt-4"
                  >
                    {isUploading ? (
                      <><Activity className="w-4 h-4 mr-2 animate-spin" />识别中...</>
                    ) : (
                      <><Eye className="w-4 h-4 mr-2" />开始识别</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 识别历史 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  识别历史
                </CardTitle>
                <CardDescription>最近的手势识别结果</CardDescription>
              </CardHeader>
              <CardContent>
                {gestureHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    暂无识别记录
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gestureHistory.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-3">
                          <div className="text-lg">{result.gesture}</div>
                          <div>
                            <div className="text-sm font-medium">置信度: {(result.confidence * 100).toFixed(1)}%</div>
                            <div className="text-xs text-gray-500">动作: {result.action}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 快速控制 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Power className="w-5 h-5 mr-2" />
                  快速控制
                </CardTitle>
                <CardDescription>手动控制设备</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="default" className="h-16">
                    <div className="text-center">
                      <div className="text-2xl mb-1">👍</div>
                      <div>开启设备</div>
                    </div>
                  </Button>
                  <Button variant="destructive" className="h-16">
                    <div className="text-center">
                      <div className="text-2xl mb-1">✋</div>
                      <div>关闭设备</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}