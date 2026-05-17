'use client';

import { useState, useRef, useEffect } from 'react';
import ThreeDGeneration from '../components/ThreeDGeneration';

// 阿里云API配置（前端直接调用）
const API_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_ALIYUN_API_KEY || process.env.DASHSCOPE_KEY || '',
  endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  model: 'qwen-plus'
};

const SYSTEM_PROMPT = `你是一位资深硬件产品经理。你的任务是引导用户完善硬件创意需求。
交互规范：
1. 引导流程：通过提问逐步确定核心功能、交互方式、成本预算等。
2. 提问形式：每次提议必须提供清晰的 A、B、C、D 选项。用户可以直接输入字母进行选择。
3. 禁止符号：严禁在对话中使用 Markdown 符号，如禁止使用 **、##、###、__、* 等。请使用纯文本排版。
4. 强制约束：在最后生成报告时，如果用户没有指定主控，默认推荐树莓派(Raspberry Pi)生态。

结束条件：当信息收集完整后，输出 JSON 格式：
{
    "status": "completed",
    "project_name": "项目名称",
    "summary": "项目核心摘要",
    "full_report": "详细需求文档（纯文本）"
}`;

const staticModules = [
  { type: 'Controller', name: 'ESP32-S3 WROOM', price: '¥ 18.50' },
  { type: 'Sensor', name: 'IMU MPU6050', price: '¥ 8.20' },
  { type: 'Sensor', name: 'ToF VL53L0X', price: '¥ 24.00' },
  { type: 'Display', name: 'OLED 0.96" I2C', price: '¥ 12.00' },
  { type: 'Actuator', name: 'SG90 Servo', price: '¥ 6.50' },
  { type: 'Power', name: 'Li-Po 500mAh', price: '¥ 15.00' }
];

export default function HomePage() {
  const [activeLayer, setActiveLayer] = useState('layer1');
  
  // Layer 1 State
  const [messages, setMessages] = useState([
    { role: 'ai', content: '你好。我是 Nowiz 创意引导引擎。\n\n请描述你想要构建的硬件想法，我将协助你完成从功能定义到组件选型的全过程。', isStreaming: false, isReportReady: false }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentRequirementReport, setCurrentRequirementReport] = useState('');
  
  // Layer 2 State
  const [bomInput, setBomInput] = useState('');
  const [bomResult, setBomResult] = useState(null); // { items: [], architecture: {}, total: 0 }
  const [bomStatus, setBomStatus] = useState('idle'); // idle, analyzing, success, error
  const [assemblyInput, setAssemblyInput] = useState('');
  const [assemblyResult, setAssemblyResult] = useState('');
  const [assemblyStatus, setAssemblyStatus] = useState('idle');
  
  // Layer 3 State
  const [realizeContext, setRealizeContext] = useState('');
  const [instructionInput, setInstructionInput] = useState('');
  const [manufactureStatus, setManufactureStatus] = useState('IDLE_WAITING_FOR_COMMAND');
  const [codeLines, setCodeLines] = useState([]);
  const [isStriking, setIsStriking] = useState(false);

  // Background Canvas and Mouse Glow
  const canvasRef = useRef(null);
  const glowRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight;

    let animationFrameId;
    const animateBg = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for(let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      animationFrameId = requestAnimationFrame(animateBg);
    };
    animateBg();

    const handleMouseMove = (e) => {
      if (glowRef.current) {
        glowRef.current.style.left = e.clientX + 'px';
        glowRef.current.style.top = e.clientY + 'px';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const showNotification = (message, type = "info") => {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        padding: 12px 20px; border-radius: 4px; font-size: 12px;
        background: ${type === 'success' ? 'rgba(255,255,255,0.1)' : type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${type === 'success' ? '#ffffff' : type === 'error' ? '#ff4444' : 'rgba(255,255,255,0.1)'};
        color: ${type === 'error' ? '#ff4444' : '#ffffff'};
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const newUserMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setChatInput('');
    
    const newHistory = [...conversationHistory, newUserMsg];
    setConversationHistory(newHistory);

    const aiMsgIndex = messages.length + 1; // It will be inserted next
    setMessages(prev => [...prev, { role: 'ai', content: '', isStreaming: true, isReportReady: false }]);

    try {
      const response = await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...newHistory],
          stream: true
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.substring(6));
              const content = json.choices[0].delta.content || "";
              fullContent += content;

              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[aiMsgIndex].content = fullContent;
                return newMsgs;
              });
            } catch (e) {}
          }
        }
      }

      // 检查是否包含 JSON (status: completed)
      if (fullContent.includes('"status": "completed"')) {
        const match = fullContent.match(/\\{[\\s\\S]*\\}/);
        if (match) {
          const result = JSON.parse(match[0]);
          setCurrentRequirementReport(result.full_report);
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[aiMsgIndex].content = `分析完成：${result.project_name}\n\n${result.summary}`;
            newMsgs[aiMsgIndex].isStreaming = false;
            newMsgs[aiMsgIndex].isReportReady = true;
            return newMsgs;
          });
        }
      } else {
        setConversationHistory([...newHistory, { role: 'assistant', content: fullContent }]);
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[aiMsgIndex].isStreaming = false;
          return newMsgs;
        });
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[aiMsgIndex].content = "ERROR: 无法触达 AI 核心。请检查网络或 API Key。";
        newMsgs[aiMsgIndex].isStreaming = false;
        return newMsgs;
      });
    }
  };

  const teleportToHardware = () => {
    setBomInput(currentRequirementReport);
    setActiveLayer('layer2');
  };

  const generateBOM = async () => {
    if (!bomInput.trim()) return;
    setBomStatus('analyzing');
    setBomResult(null);

    try {
      const response = await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: [
            { role: 'system', content: '你是一个硬件工程师。请根据需求生成JSON格式的BOM清单和系统架构。必须推荐树莓派生态。格式：{"items":[{"name":"元件","spec":"规格","price":10}],"architecture":{"core":"树莓派 5","modules":[{"name":"模块1","type":"Sensor"}]}}' },
            { role: 'user', content: bomInput }
          ],
          stream: true
        })
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.substring(6));
              const content = json.choices[0].delta.content || "";
              fullContent += content;
            } catch (e) {}
          }
        }
      }

      const match = fullContent.match(/\\{[\\s\\S]*\\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        let total = 0;
        result.items.forEach(i => total += i.price);
        result.total = total;
        setBomResult(result);
        setBomStatus('success');
      } else {
        setBomStatus('error');
      }
    } catch (e) {
      setBomStatus('error');
    }
  };

  const copyBOMToAssembly = () => {
    if (bomResult && bomResult.items) {
      let text = "当前BOM清单：\n";
      bomResult.items.forEach(i => {
        text += `${i.name} | ${i.spec} | ¥${i.price}\n`;
      });
      setAssemblyInput(text);
      showNotification("BOM清单已复制到拼装指南", "success");
    } else {
      showNotification("请先生成BOM清单", "warning");
    }
  };

  const generateAssemblyGuide = async () => {
    if (!assemblyInput.trim()) {
      showNotification("请输入或复制BOM清单到拼装指南", "warning");
      return;
    }

    setAssemblyStatus('generating');
    setAssemblyResult('');

    try {
      const response = await fetch(API_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
          model: API_CONFIG.model,
          messages: [
            { 
              role: 'system', 
              content: `你是一位资深硬件工程师。请根据提供的BOM清单或装备信息，生成精简、实用的硬件拼装指南。
要求：
1. 输出必须结构化、步骤清晰
2. 每个步骤要具体可操作
3. 避免冗长描述，重点突出关键操作
4. 使用纯文本，禁止Markdown符号
5. 总步骤控制在5-8步内
格式：
步骤1：[操作名称]
[具体操作说明]` 
            },
            { role: 'user', content: assemblyInput }
          ],
          stream: true
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.substring(6));
              const content = json.choices[0].delta.content || "";
              fullContent += content;
              setAssemblyResult(fullContent);
            } catch (e) {}
          }
        }
      }

      setAssemblyStatus('success');
      showNotification("拼装指南生成完成", "success");
    } catch (e) {
      setAssemblyStatus('error');
      showNotification("生成失败，请重试", "error");
    }
  };

  const teleportToRealizeWithAssembly = () => {
    let fullContext = "";
    if (bomResult) {
      fullContext += `硬件配置：${bomResult.architecture?.core || 'Raspberry Pi'} + ${bomResult.architecture?.modules?.length || 0} 个模组\n\n`;
    }
    if (assemblyResult || assemblyInput) {
      fullContext += `拼装指南：\n${assemblyResult || assemblyInput}`;
    }
    setRealizeContext(fullContext || "等待同步 Hardware 实验室数据...");
    setActiveLayer('layer3');
  };

  const startManufacture = () => {
    if (!instructionInput.trim()) {
      alert("请输入制造指令细节");
      return;
    }

    setManufactureStatus('PROCESSING_FIRMWARE...');
    setIsStriking(true);
    setCodeLines([]);

    const mockCodes = [
      "import RPi.GPIO as GPIO",
      "import time",
      "GPIO.setmode(GPIO.BCM)",
      "LED_PIN = 18",
      "GPIO.setup(LED_PIN, GPIO.OUT)",
      "def trigger_logic(signal):",
      "    if signal == 'THUMBS_UP':",
      "        GPIO.output(LED_PIN, GPIO.HIGH)",
      "    else:",
      "        GPIO.output(LED_PIN, GPIO.LOW)",
      "while True:",
      "    data = sensor.read()",
      "    trigger_logic(data)"
    ];

    mockCodes.forEach((line, i) => {
      setTimeout(() => {
        setCodeLines(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
      }, i * 300);
    });

    setTimeout(() => {
      setIsStriking(false);
      setManufactureStatus('已经开发完成，快去试试吧');
    }, 5000);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
            --color-bg-primary: #000000;
            --color-bg-secondary: #0a0a0a;
            --color-bg-tertiary: #111111;
            --color-border: rgba(255, 255, 255, 0.1);
            --color-text-primary: #ffffff;
            --color-text-secondary: rgba(255, 255, 255, 0.8);
            --color-text-tertiary: rgba(255, 255, 255, 0.5);
            --color-text-muted: rgba(255, 255, 255, 0.3);
            --color-accent: #ffffff;
            --color-accent-hover: #f0f0f0;
            --transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
            --radius-sm: 2px;
            --radius-md: 4px;
            --radius-lg: 8px;
            --spacing-xl: 32px;
            --spacing-2xl: 64px;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--color-bg-primary);
            color: var(--color-text-primary);
            line-height: 1.5;
            overflow-x: hidden;
            cursor: crosshair;
        }

        #bgCanvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            opacity: 0.4;
            pointer-events: none;
        }

        .mouse-glow {
            position: fixed;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: -1;
            transform: translate(-50%, -50%);
        }

        .navbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--color-border);
            padding: 16px 0;
        }

        .nav-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 var(--spacing-xl);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .logo-text {
            font-size: 20px;
            font-weight: 200;
            letter-spacing: 4px;
            text-transform: uppercase;
        }

        .nav-menu {
            display: flex;
            gap: 48px;
            flex: 1;
            justify-content: center;
        }

        .nav-link {
            color: var(--color-text-tertiary);
            text-decoration: none;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            transition: var(--transition);
            cursor: pointer;
        }

        .nav-link:hover, .nav-link.active {
            color: var(--color-text-primary);
        }

        .btn-primary {
            background: #ffffff;
            color: #000000;
            padding: 8px 24px;
            border-radius: var(--radius-sm);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            border: none;
            cursor: pointer;
            transition: var(--transition);
        }

        .btn-primary:hover {
            background: #dddddd;
            transform: translateY(-2px);
        }
        
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .main-container {
            margin-top: 80px;
            min-height: calc(100vh - 80px);
        }

        .layer-section {
            display: none;
            max-width: 1400px;
            margin: 0 auto;
            padding: var(--spacing-2xl) var(--spacing-xl);
            animation: fadeIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .layer-section.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .section-header {
            margin-bottom: var(--spacing-2xl);
            text-align: center;
        }

        .section-title {
            font-size: 48px;
            font-weight: 200;
            letter-spacing: -1px;
            margin-bottom: 8px;
        }

        .title-number {
            font-family: serif;
            font-style: italic;
            font-size: 24px;
            color: var(--color-text-tertiary);
            margin-right: 16px;
        }

        .section-subtitle {
            color: var(--color-text-tertiary);
            font-size: 14px;
            letter-spacing: 1px;
        }

        .chat-container {
            max-width: 1000px;
            margin: 0 auto;
            height: calc(100vh - 350px);
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--color-border);
            backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            border-radius: var(--radius-md);
        }

        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: var(--spacing-xl);
        }

        .message {
            display: flex;
            gap: 20px;
            margin-bottom: 32px;
        }

        .message.user {
            flex-direction: row-reverse;
        }

        .message-avatar {
            width: 32px;
            height: 32px;
            border: 1px solid var(--color-border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            background: rgba(255,255,255,0.05);
        }

        .message-content {
            max-width: 70%;
            border-left: 2px solid var(--color-border);
            padding: 8px 24px;
        }

        .user .message-content {
            border-left: none;
            border-right: 2px solid #ffffff;
            background: rgba(255,255,255,0.03);
        }

        .message-text {
            font-size: 14px;
            color: var(--color-text-secondary);
            line-height: 1.8;
            white-space: pre-wrap;
        }

        .chat-input-container {
            padding: var(--spacing-xl);
            border-top: 1px solid var(--color-border);
        }

        .input-wrapper {
            position: relative;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--color-border);
            padding: 16px;
        }

        .chat-input {
            width: 100%;
            background: transparent;
            border: none;
            color: white;
            font-family: inherit;
            font-size: 14px;
            resize: none;
            outline: none;
            min-height: 24px;
        }

        .input-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 12px;
        }

        .report-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid #ffffff;
            padding: 24px;
            margin: 24px 0;
            animation: slideUp 0.6s ease;
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .hardware-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
        }

        .bom-panel {
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--color-border);
            padding: 32px;
            backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .bom-textarea {
            width: 100%;
            height: 200px;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--color-border);
            color: var(--color-text-secondary);
            padding: 16px;
            font-family: 'SF Mono', monospace;
            font-size: 12px;
            resize: none;
        }

        .architecture-preview {
            width: 100%;
            min-height: 400px;
            border: 1px solid var(--color-border);
            background: radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, transparent 70%);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            perspective: 1000px;
        }

        .arch-label {
            position: absolute;
            top: 20px;
            left: 20px;
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .bom-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
        }

        .bom-table th {
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--color-text-tertiary);
            padding: 12px;
            border-bottom: 1px solid var(--color-border);
        }

        .bom-table td {
            padding: 16px 12px;
            font-size: 13px;
            border-bottom: 1px solid var(--color-border);
        }

        .total-cost {
            font-size: 32px;
            font-weight: 200;
            text-align: right;
            margin-top: 32px;
        }

        .module-library {
            margin-top: 64px;
        }

        .module-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 24px;
        }

        .module-card {
            border: 1px solid var(--color-border);
            padding: 20px;
            transition: var(--transition);
        }

        .module-card:hover {
            border-color: #ffffff;
            background: rgba(255,255,255,0.03);
        }

        .realize-layout {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 32px;
            height: calc(100vh - 300px);
        }

        .instruction-panel {
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--color-border);
            display: flex;
            flex-direction: column;
            border-radius: var(--radius-md);
            overflow: hidden;
            backdrop-filter: blur(20px);
        }

        .instruction-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            font-size: 13px;
            color: var(--color-text-secondary);
        }

        .instruction-input-area {
            padding: 20px;
            border-top: 1px solid var(--color-border);
            background: rgba(255,255,255,0.01);
        }

        .manufacturing-preview {
            background: rgba(255,255,255,0.01);
            border: 1px solid var(--color-border);
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            backdrop-filter: blur(20px);
        }

        .hammer-container {
            font-size: 80px;
            margin-bottom: 24px;
            transition: var(--transition);
            filter: drop-shadow(0 0 20px rgba(255,255,255,0.2));
        }

        .hammer-striking {
            animation: hammerStrike 0.6s infinite ease-in-out;
        }

        @keyframes hammerStrike {
            0% { transform: rotate(0deg); }
            50% { transform: rotate(-45deg); }
            100% { transform: rotate(0deg); }
        }

        .manufacturing-status {
            font-size: 18px;
            font-weight: 200;
            letter-spacing: 4px;
            color: var(--color-text-tertiary);
            text-align: center;
            text-transform: uppercase;
        }

        .status-completed {
            color: #ffffff;
            text-shadow: 0 0 20px rgba(255,255,255,0.4);
        }

        .code-stream {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 180px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 10px;
            color: rgba(255,255,255,0.2);
            overflow: hidden;
            pointer-events: none;
            mask-image: linear-gradient(to top, black, transparent);
            padding: 20px;
        }

        .code-line {
            white-space: pre;
            margin-bottom: 4px;
            animation: scrollCode 8s linear infinite;
        }

        @keyframes scrollCode {
            from { transform: translateY(100%); }
            to { transform: translateY(-100%); }
        }

        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        
        @keyframes pulse {
            0% { opacity: 0.4; }
            50% { opacity: 1; }
            100% { opacity: 0.4; }
        }
        
        @keyframes loading {
            0% { left: -50%; }
            100% { left: 100%; }
        }
      `}} />

      <canvas id="bgCanvas" ref={canvasRef}></canvas>
      <div className="mouse-glow" id="mouseGlow" ref={glowRef}></div>

      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <span className="logo-text">NOWIZ</span>
          </div>
          <div className="nav-menu">
            <a className={`nav-link ${activeLayer === 'layer1' ? 'active' : ''}`} onClick={() => setActiveLayer('layer1')}>Creation</a>
            <a className={`nav-link ${activeLayer === 'layer2' ? 'active' : ''}`} onClick={() => setActiveLayer('layer2')}>Hardware</a>
            <a className={`nav-link ${activeLayer === 'layer3' ? 'active' : ''}`} onClick={() => setActiveLayer('layer3')}>Realize</a>
            <a className={`nav-link ${activeLayer === 'layer4' ? 'active' : ''}`} onClick={() => setActiveLayer('layer4')}>3D GENERATION</a>
          </div>
        </div>
      </nav>

      <main className="main-container">
        {/* Layer 1: Creation */}
        <section id="layer1" className={`layer-section ${activeLayer === 'layer1' ? 'active' : ''}`}>
          <div className="section-header">
            <h1 className="section-title"><span className="title-number">01</span>描述创意</h1>
            <p className="section-subtitle">NATURAL LANGUAGE TO HARDWARE PROTOCOL</p>
          </div>
          <div className="chat-container">
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  <div className={`message ${msg.role === 'user' ? 'user' : 'ai'}`}>
                    <div className="message-avatar">{msg.role === 'ai' ? 'AI' : 'ME'}</div>
                    <div className="message-content">
                      {msg.isStreaming && !msg.content.includes('{') ? (
                        <div className="message-text">{msg.content}</div>
                      ) : msg.isStreaming && msg.content.includes('{') ? (
                        <div className="message-text">
                          {msg.content.substring(0, msg.content.indexOf('{')).trim()}
                          <div style={{ borderLeft: '2px solid #fff', padding: '10px 15px', background: 'rgba(255,255,255,0.02)', marginTop: '10px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', letterSpacing: '2px', marginBottom: '8px' }}>FINALIZING STRATEGIC REPORT</div>
                            <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
                              <div style={{ position: 'absolute', height: '100%', width: '50%', background: '#fff', animation: 'loading 1.5s infinite ease-in-out' }}></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="message-text">{msg.content}</div>
                      )}
                    </div>
                  </div>
                  {msg.isReportReady && (
                    <div className="report-card">
                      <h4 style={{ marginBottom: '12px', fontWeight: 400 }}>STRATEGIC_PLAN_READY</h4>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '20px' }}>硬件方案已锁定。准备进入实验室进行物料匹配。</p>
                      <button className="btn-primary" onClick={teleportToHardware}>🚀 传送至 HARDWARE</button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-container">
              <div className="input-wrapper">
                <textarea 
                  className="chat-input" 
                  placeholder="输入你的创意构思..." 
                  rows={1}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                ></textarea>
                <div className="input-footer">
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>ENTER TO SEND</span>
                  <button className="btn-primary" onClick={handleSendMessage} disabled={messages.some(m => m.isStreaming) || !chatInput.trim()}>Send</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Layer 2: Hardware */}
        <section id="layer2" className={`layer-section ${activeLayer === 'layer2' ? 'active' : ''}`}>
          <div className="section-header">
            <h1 className="section-title"><span className="title-number">02</span>硬件选型</h1>
            <p className="section-subtitle">BOM GENERATION & COMPONENT ANALYSIS</p>
          </div>
          <div className="hardware-layout">
            <div className="bom-panel">
              <h3 style={{ fontSize: '14px', letterSpacing: '1px' }}>REQUIREMENT SPECIFICATION</h3>
              <textarea 
                className="bom-textarea" 
                placeholder="在此粘贴需求报告..."
                value={bomInput}
                onChange={(e) => setBomInput(e.target.value)}
              ></textarea>
              <button className="btn-primary" style={{ width: '100%', marginBottom: '32px' }} onClick={generateBOM} disabled={bomStatus === 'analyzing' || !bomInput.trim()}>
                {bomStatus === 'analyzing' ? '生成中...' : '生成完整清单'}
              </button>
              
              <h3 style={{ fontSize: '14px', marginBottom: '16px', letterSpacing: '1px' }}>SYSTEM BILL OF MATERIALS</h3>
              <div style={{ marginBottom: '32px' }}>
                {bomStatus === 'idle' && <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textAlign: 'center', padding: '40px' }}>等待输入分析...</p>}
                {bomStatus === 'analyzing' && (
                  <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: '#fff', marginBottom: '16px', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>SYSTEM ANALYZING...</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 2 }}>
                      {'>'} PARSING ARCHITECTURE<br/>
                      {'>'} MATCHING COMPONENTS<br/>
                      {'>'} CALCULATING SPECIFICATIONS<br/>
                      {'>'} OPTIMIZING BOM STRUCTURE
                    </div>
                  </div>
                )}
                {bomStatus === 'error' && <p style={{ color: '#ff4444', textAlign: 'center', marginTop: '100px' }}>BOM_GENERATION_FAILED</p>}
                {bomStatus === 'success' && bomResult && (
                  <>
                    <table className="bom-table">
                      <thead>
                        <tr>
                          <th>Component</th>
                          <th>Spec</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomResult.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name}</td>
                            <td>{item.spec}</td>
                            <td>¥{item.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="total-cost">¥ {bomResult.total.toFixed(2)}</div>
                    <div style={{ marginTop: '20px' }}>
                      <button className="btn-primary" onClick={copyBOMToAssembly} style={{ width: '100%', background: 'transparent', border: '1px solid var(--color-border)', color: 'white' }}>
                        📋 复制到拼装指南
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="bom-panel" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '16px', letterSpacing: '1px' }}>ARCHITECTURE PREVIEW</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: '8px', display: 'block' }}>拼装指南输入（支持从BOM复制或手动输入）</label>
                <textarea 
                  className="bom-textarea" 
                  placeholder="输入BOM清单或装备描述..." 
                  style={{ height: '120px' }}
                  value={assemblyInput}
                  onChange={(e) => setAssemblyInput(e.target.value)}
                ></textarea>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button className="btn-primary" onClick={copyBOMToAssembly} style={{ flex: 1, padding: '10px' }}>
                  📋 复制BOM到指南
                </button>
                <button className="btn-primary" onClick={generateAssemblyGuide} disabled={assemblyStatus === 'generating'} style={{ flex: 2, padding: '10px' }}>
                  🛠️ 生成拼装指南
                </button>
              </div>
              
              <div className="architecture-preview">
                <div className="arch-label">ASSEMBLY GUIDE OUTPUT</div>
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '11px', padding: '40px', overflowY: 'auto' }}>
                  {assemblyStatus === 'idle' && '等待生成拼装指南...'}
                  {assemblyStatus === 'generating' && (
                    <div style={{ fontFamily: "'SF Mono', monospace", fontSize: '11px', lineHeight: 1.6, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', textAlign: 'left', width: '100%' }}>
                      {assemblyResult || '正在生成精简拼装指南...'}
                    </div>
                  )}
                  {assemblyStatus === 'success' && (
                    <div style={{ fontFamily: "'SF Mono', monospace", fontSize: '11px', lineHeight: 1.6, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', textAlign: 'left', width: '100%' }}>
                      {assemblyResult}
                    </div>
                  )}
                  {assemblyStatus === 'error' && <div style={{ color: '#ff4444' }}>拼装指南生成失败</div>}
                </div>
              </div>
              
              <button className="btn-primary" style={{ width: '100%', marginTop: '20px' }} onClick={teleportToRealizeWithAssembly}>
                🚀 一键制造
              </button>
            </div>
          </div>

          <div className="module-library">
            <h3 style={{ fontSize: '18px', fontWeight: 200, borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>硬件模块库 / MODULE_LIBRARY</h3>
            <div className="module-grid">
              {staticModules.map((m, idx) => (
                <div className="module-card" key={idx}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{m.type}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>{m.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{m.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Layer 3: Realize */}
        <section id="layer3" className={`layer-section ${activeLayer === 'layer3' ? 'active' : ''}`}>
          <div className="section-header">
            <h1 className="section-title"><span className="title-number">03</span>开始制造</h1>
            <p className="section-subtitle">RASPBERRY PI ECOSYSTEM - EMBEDDED SYSTEM INTEGRATION</p>
          </div>
          <div className="realize-layout">
            <div className="instruction-panel">
              <div className="instruction-messages">
                <div style={{ marginBottom: '16px', color: 'var(--color-text-muted)' }}>[SYSTEM] 环境就绪。树莓派核心已连接。</div>
                <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.03)', fontSize: '11px', borderLeft: '2px solid #fff', whiteSpace: 'pre-wrap' }}>
                  {realizeContext || "等待同步 Hardware 实验室数据..."}
                </div>
                <div style={{ marginBottom: '10px' }}>请输入具体的执行逻辑指令（例如：👍开启风扇，👇关闭风扇）：</div>
              </div>
              <div className="instruction-input-area">
                <textarea 
                  className="chat-input" 
                  placeholder="例如：当摄像头检测到拇指向上时，打开 LED 灯..." 
                  style={{ minHeight: '80px', marginBottom: '12px', border: '1px solid var(--color-border)', padding: '12px', background: 'rgba(0,0,0,0.2)' }}
                  value={instructionInput}
                  onChange={(e) => setInstructionInput(e.target.value)}
                ></textarea>
                <button className="btn-primary" style={{ width: '100%' }} onClick={startManufacture} disabled={isStriking}>开始制造</button>
              </div>
            </div>
            <div className="manufacturing-preview">
              <div className="arch-label">MANUFACTURING_PROCESS_MONITOR</div>
              <div className={`hammer-container ${isStriking ? 'hammer-striking' : ''}`}>🔨</div>
              <div className={`manufacturing-status ${manufactureStatus === '已经开发完成，快去试试吧' ? 'status-completed' : ''}`}>{manufactureStatus}</div>
              {codeLines.length > 0 && (
                <div className="code-stream" style={{ display: 'block' }}>
                  {codeLines.map((line, idx) => (
                    <div key={idx} className="code-line">{line}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Layer 4: 3D Generation */}
        <ThreeDGeneration isActive={activeLayer === 'layer4'} />
      </main>
    </>
  );
}
