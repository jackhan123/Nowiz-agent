import { NextRequest, NextResponse } from 'next/server';

// 模拟树莓派上传图片进行测试
export async function POST(request: NextRequest) {
  try {
    const { testMode = false } = await request.json();
    
    if (testMode) {
      // 创建一个测试用的虚拟图片数据
      const testImageBuffer = Buffer.from('test-image-data');
      const formData = new FormData();
      const blob = new Blob([testImageBuffer], { type: 'image/jpeg' });
      formData.append('image', blob, 'test.jpg');
      formData.append('deviceId', 'test-device');
      
      // 调用真实的vision API
      const visionResponse = await fetch(`${request.nextUrl.origin}/api/vision`, {
        method: 'POST',
        body: formData
      });
      
      const result = await visionResponse.json();
      
      return NextResponse.json({
        test: true,
        success: true,
        visionResult: result,
        message: 'Test completed - simulated image processed'
      });
    }
    
    return NextResponse.json({
      test: false,
      message: 'Set testMode=true to run vision API test'
    });
    
  } catch (error) {
    console.error('Test vision error:', error);
    return NextResponse.json(
      { error: 'Test failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  // 测试GET接口获取状态
  try {
    const visionResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/vision`);
    const state = await visionResponse.json();
    
    return NextResponse.json({
      test: 'vision-status',
      currentState: state.current_state,
      message: 'Current vision system status retrieved'
    });
  } catch (error) {
    return NextResponse.json({
      test: 'vision-status',
      error: error.message,
      message: 'Failed to get vision status'
    });
  }
}