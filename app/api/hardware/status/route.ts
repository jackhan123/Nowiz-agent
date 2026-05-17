import { NextRequest, NextResponse } from 'next/server';

// 模拟硬件状态数据
const hardwareStatus = {
  devices: [
    {
      id: 'raspberry-pi-001',
      name: '手势控制风扇',
      type: 'gesture_controlled_fan',
      status: 'online',
      lastSeen: new Date().toISOString(),
      specs: {
        cpu: 'ARM Cortex-A72',
        memory: '4GB',
        storage: '32GB',
        camera: 'Raspberry Pi Camera v2',
        sensors: ['temperature', 'humidity']
      }
    }
  ],
  system: {
    uptime: '2h 35m',
    cpuUsage: '15%',
    memoryUsage: '35%',
    networkLatency: '45ms',
    temperature: '42°C'
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    
    if (deviceId) {
      const device = hardwareStatus.devices.find(d => d.id === deviceId);
      if (!device) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }
      return NextResponse.json({ device });
    }
    
    return NextResponse.json(hardwareStatus);
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, status, data } = body;
    
    // 这里可以更新设备状态到数据库
    console.log(`Device ${deviceId} status update:`, status, data);
    
    return NextResponse.json({
      success: true,
      message: 'Status updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}