# AI 硬件实验室 🚀

用 AI 设计你的硬件项目 - 输入想法，自动生成完整硬件方案和 BOM 清单。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

编辑 `.env.local` 文件，填入你的 OpenAI API Key：

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

**获取 API Key 的方式：**

#### 方案 A：OpenAI（推荐，效果最好）
- 访问 https://platform.openai.com/api-keys
- 注册并创建 API Key
- 模型：`gpt-4o` 或 `gpt-4-turbo`

#### 方案 B：阿里云通义千问（国内可用）
```bash
OPENAI_API_KEY=your_aliyun_api_key
OPENAI_API_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
OPENAI_MODEL_NAME=qwen-plus
```
- 访问 https://dashscope.aliyun.com/
- 开通灵积模型服务
- 获取 API Key

#### 方案 C：DeepSeek（低成本）
```bash
OPENAI_API_KEY=your_deepseek_api_key
OPENAI_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions
OPENAI_MODEL_NAME=deepseek-chat
```
- 访问 https://platform.deepseek.com/
- 价格非常便宜（约 OpenAI 的 1/10）

### 3. 运行项目

```bash
npm run dev
```

访问 http://localhost:3000

## 功能特性

✅ **AI 驱动**：基于大语言模型生成专业硬件方案  
✅ **详细 BOM**：包含具体型号、规格、价格、供应商  
✅ **全面覆盖**：主控、传感器、电源、外壳全方位设计  
✅ **一键导出**：复制所有内容到剪贴板  
✅ **快速示例**：点击示例快速体验  
✅ **响应式设计**：支持手机/平板/电脑访问

## 技术栈

- **前端**：Next.js 14 + React + TypeScript
- **样式**：Tailwind CSS
- **AI**：OpenAI API (兼容多种模型)
- **图标**：Lucide React
- **部署**：Vercel（一键部署）

## 部署到 Vercel

1. 推送代码到 GitHub
2. 访问 https://vercel.com/new
3. 导入你的 GitHub 仓库
4. 添加环境变量：`OPENAI_API_KEY`
5. 点击 Deploy

## 使用示例

输入：**"智能台灯"**

AI 将生成：
- 核心主控推荐（ESP32-S3）
- 传感器列表（光照传感器、触摸传感器）
- 显示模块（OLED 屏幕）
- 电源方案（USB Type-C + 锂电池）
- 工业设计建议（3D 打印外壳）
- 完整 BOM 清单（包含具体型号和价格）

## 项目结构

```
Newiz/
├── app/
│   ├── api/
│   │   └── generate-hardware/
│   │       └── route.ts          # AI 生成 API
│   ├── globals.css               # 全局样式
│   ├── layout.tsx                # 根布局
│   └── page.tsx                  # 主页面
├── .env.local                    # 环境变量（不提交到 git）
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 注意事项

⚠️ **免责声明**：AI 生成的方案仅供参考，实际制作前请咨询专业人士  
⚠️ **价格说明**：BOM 价格为估算值，以实际采购为准  
⚠️ **安全提示**：涉及电池、高压的项目请注意用电安全

## 常见问题

### Q: API 调用失败？
A: 检查 `.env.local` 中的 API Key 是否正确，确保有足够的额度

### Q: 生成速度慢？
A: 正常现象，AI 生成需要 5-15 秒，请耐心等待

### Q: 想修改 Prompt？
A: 编辑 `app/api/generate-hardware/route.ts` 中的 `SYSTEM_PROMPT`

### Q: 支持其他语言模型吗？
A: 支持所有兼容 OpenAI API 格式的模型（通义千问、DeepSeek、Moonshot 等）

## 许可证

MIT License

## 作者

Newiz Team

---

**Enjoy Building! 🎉**
# Newiz
