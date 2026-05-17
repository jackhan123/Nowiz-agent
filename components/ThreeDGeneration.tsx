'use client';

import React, { useState, useEffect, useRef } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        'auto-rotate'?: boolean;
        'camera-controls'?: boolean;
        'shadow-intensity'?: string;
        ar?: boolean;
      };
    }
  }
}

export default function ThreeDGeneration({ isActive }: { isActive: boolean }) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle'); // idle, generating, success, error
  const [logs, setLogs] = useState<string[]>([]);
  const [modelUrls, setModelUrls] = useState<any>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setStatus('generating');
    setLogs([]);
    setModelUrls(null);
    setTaskId(null);

    try {
      addLog("Sending prompt to Meshy AI...");
      const response = await fetch('/api/ai/meshy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to start generation');
      
      const newTaskId = data.taskId;
      setTaskId(newTaskId);
      addLog(`Task created successfully. Task ID: ${newTaskId}`);
      addLog("Waiting for model generation to complete (this may take 1-2 minutes)...");

    } catch (err: any) {
      addLog(`Error: ${err.message}`);
      setStatus('error');
    }
  };

  useEffect(() => {
    // 动态注入 model-viewer 脚本以确保它在客户端正确加载
    if (!document.querySelector('script[src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"]')) {
      const script = document.createElement('script');
      script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
      script.type = "module";
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (status === 'generating' && taskId) {
      pollInterval.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/ai/meshy?taskId=${taskId}`);
          const data = await res.json();

          if (data.status === 'SUCCEEDED') {
            clearInterval(pollInterval.current as NodeJS.Timeout);
            setModelUrls(data.model_urls);
            addLog("Model generated successfully!");
            setStatus('success');
          } else if (data.status === 'FAILED' || data.status === 'EXPIRED') {
            clearInterval(pollInterval.current as NodeJS.Timeout);
            addLog(`Task failed with status: ${data.status}`);
            setStatus('error');
          } else {
            // Processing
            const progress = data.progress || 0;
            addLog(`Processing... ${progress}%`);
          }
        } catch (err: any) {
          addLog(`Polling error: ${err.message}`);
        }
      }, 5000); // 5 seconds polling
    }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [status, taskId]);

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <section id="layer4" className={`layer-section ${isActive ? 'active' : ''}`}>
      <div className="section-header">
        <h1 className="section-title"><span className="title-number">04</span>3D 建模</h1>
        <p className="section-subtitle">TEXT TO 3D MODEL GENERATION</p>
      </div>
      <div className="realize-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="instruction-panel">
          <div className="instruction-messages">
            <div style={{ marginBottom: '16px', color: 'var(--color-text-muted)' }}>[SYSTEM] 3D 引擎已就绪。支持输入自然语言生成 3D 模型。</div>
            <div style={{ marginBottom: '10px' }}>请描述你想要生成的 3D 模型细节：</div>
            {logs.length > 0 && (
              <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                {logs.map((log, i) => <div key={i} style={{ marginBottom: '4px' }}>{log}</div>)}
              </div>
            )}
          </div>
          <div className="instruction-input-area">
            <textarea 
              className="chat-input" 
              placeholder="例如：一个带有赛博朋克风格的智能台灯外壳，包含机械线条和霓虹灯槽..." 
              style={{ minHeight: '120px', marginBottom: '12px', border: '1px solid var(--color-border)', padding: '12px', background: 'rgba(0,0,0,0.2)' }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            ></textarea>
            <button 
              className="btn-primary" 
              style={{ width: '100%' }} 
              onClick={handleGenerate} 
              disabled={status === 'generating'}
            >
              {status === 'generating' ? '生成中...' : '开始生成 3D 模型'}
            </button>
          </div>
        </div>
        
        <div className="manufacturing-preview" style={{ minHeight: '400px' }}>
          <div className="arch-label">3D_VIEWER_PREVIEW</div>
          
          {status === 'idle' && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', letterSpacing: '1px' }}>等待输入提示词...</div>
          )}
          
          {status === 'generating' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '20px', animation: 'pulse 1.5s infinite' }}>🧊</div>
              <div style={{ fontSize: '14px', color: '#fff', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>RENDERING MODEL...</div>
            </div>
          )}
          
          {status === 'success' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', height: '300px', marginBottom: '20px' }}>
                <model-viewer
                  src={modelUrls?.glb ? `/api/proxy-model?url=${encodeURIComponent(modelUrls.glb)}` : ''}
                  auto-rotate
                  camera-controls
                  shadow-intensity="1"
                  style={{ width: '100%', height: '100%', outline: 'none', backgroundColor: 'transparent' }}
                ></model-viewer>
                {/* Debug info: check if URL is loaded and model-viewer is present */}
                {!modelUrls?.glb && <div style={{color:'red', fontSize:'12px'}}>Error: GLB URL is missing from the API response.</div>}
              </div>
              <div style={{ color: '#fff', fontSize: '14px', letterSpacing: '2px', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>MODEL GENERATED SUCCESSFULLY</div>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {modelUrls?.stl && (
                  <button onClick={() => handleDownload(modelUrls.stl)} className="btn-primary" style={{ background: 'transparent', border: '1px solid #fff', color: '#fff' }}>⬇️ 导出 STL</button>
                )}
                {modelUrls?.glb && (
                  <button onClick={() => handleDownload(modelUrls.glb)} className="btn-primary" style={{ background: 'transparent', border: '1px solid #fff', color: '#fff' }}>⬇️ 导出 GLB</button>
                )}
                {modelUrls?.obj && (
                  <button onClick={() => handleDownload(modelUrls.obj)} className="btn-primary" style={{ background: 'transparent', border: '1px solid #fff', color: '#fff' }}>⬇️ 导出 OBJ</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .mock-3d-box {
          width: 100px;
          height: 100px;
          perspective: 600px;
        }
        .cube {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: spinCube 8s infinite linear;
        }
        .face {
          position: absolute;
          width: 100px;
          height: 100px;
          border: 1px solid rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(2px);
        }
        .front  { transform: rotateY(0deg) translateZ(50px); }
        .back   { transform: rotateY(180deg) translateZ(50px); }
        .right  { transform: rotateY(90deg) translateZ(50px); }
        .left   { transform: rotateY(-90deg) translateZ(50px); }
        .top    { transform: rotateX(90deg) translateZ(50px); }
        .bottom { transform: rotateX(-90deg) translateZ(50px); }
        @keyframes spinCube {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
      `}} />
    </section>
  );
}