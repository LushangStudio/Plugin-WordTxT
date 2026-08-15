# 学工备忘整理工具

项目已由纯前端页面重构为前后端分离应用：前端使用 Vue 3、TypeScript、Vite 和 Tailwind CSS，后端使用 FastAPI 和 Python。Word 解析、AI 调用、通知生成和 Excel 导出都由后端负责，浏览器不再保存或直接发送 API 密钥。

## 项目结构

```text
Plugin/
├─ frontend/                    # Vue 3 + TypeScript + Vite + Tailwind CSS
│  ├─ src/
│  │  ├─ components/           # 页面功能组件与无障碍 UI 基础组件
│  │  ├─ lib/                  # 样式类合并等通用基础能力
│  │  ├─ services/api.ts       # 后端 API 客户端
│  │  ├─ types/                # 前后端数据类型
│  │  ├─ utils/                # 前端文本与交互工具
│  │  ├─ App.vue
│  │  └─ main.ts
│  ├─ package.json
│  └─ vite.config.ts            # 开发环境 /api 反向代理
├─ backend/                     # FastAPI
│  ├─ app/
│  │  ├─ api/routes/            # health、documents、filters、notices、exports
│  │  ├─ core/config.py         # 环境变量与密钥配置
│  │  ├─ schemas/models.py      # Pydantic 请求/响应模型
│  │  ├─ services/              # Word、AI、通知、Excel 业务逻辑
│  │  └─ main.py
│  ├─ tests/                    # 后端自动化测试
│  ├─ .env.example
│  ├─ requirements.txt
│  └─ requirements-dev.txt
├─ .gitignore
└─ README.md
```

## 已实现功能

- 上传并解析 `.docx`，支持普通段落、表格以及 WPS 内容控件中的文本。
- 内容筛选工作流：提取全文、保留原表格、文本与格式双栏校对、按章节移除/恢复、AI 学生事项筛选。
- 表格选择工作流：事项结构化、分类展示、勾选、拖拽和时间排序、AI 受众筛选。
- 根据页眉、页脚、自定义要求和联系人保留策略生成通知。
- 将选中事项导出为 `.xlsx`，并附带导出元数据。
- 后端统一调用 DeepSeek 的 OpenAI 兼容接口，API 密钥不会下发到浏览器。
- 健康检查会显示后端是否在线以及 AI 是否已配置，但不会返回密钥。

## 本地运行要求

- Node.js 20 或更高版本
- Python 3.10 或更高版本
- npm
- 可选：`uv`，在网络或 pip 环境不稳定时可用于安装 Python 依赖

## 第一次启动

### 1. 启动后端

在 PowerShell 中执行：

```powershell
cd C:\Users\21497\Desktop\Plug\Plugin\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

编辑 `backend/.env`，只在需要 AI 筛选和 AI 生成时填写：

```dotenv
DEEPSEEK_API_KEY=你的密钥
```

然后启动后端：

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

如果本机 pip 受代理或证书环境影响，而已经安装了 `uv`，可改用：

```powershell
uv pip install --python .venv\Scripts\python.exe -r requirements-dev.txt
```

### 2. 启动前端

另开一个 PowerShell 窗口：

```powershell
cd C:\Users\21497\Desktop\Plug\Plugin\frontend
npm install
npm run dev
```

浏览器打开：

- 前端：<http://127.0.0.1:5173>
- 后端接口文档：<http://127.0.0.1:8000/docs>
- 后端健康检查：<http://127.0.0.1:8000/api/health>

不配置 AI 密钥时，Word 提取、事项解析、人工筛选和 Excel 导出仍可使用；AI 筛选和 AI 通知生成会明确提示尚未配置。

macOS 或 Linux 的后端激活命令为：

```bash
source .venv/bin/activate
```

## 日常启动

依赖安装完成后，只需分别启动两个终端：

```powershell
# 终端一：后端
cd C:\Users\21497\Desktop\Plug\Plugin\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
# 终端二：前端
cd C:\Users\21497\Desktop\Plug\Plugin\frontend
npm run dev
```

## 自动验证

后端测试：

```powershell
cd C:\Users\21497\Desktop\Plug\Plugin\backend
.\.venv\Scripts\python.exe -m pytest
```

前端类型检查与生产构建：

```powershell
cd C:\Users\21497\Desktop\Plug\Plugin\frontend
npm run type-check
npm run build
```

## API 概览

| 方法 | 地址 | 作用 |
|---|---|---|
| GET | `/api/health` | 后端及 AI 配置状态 |
| POST | `/api/documents/extract` | 提取 Word 全文及原表格映射 |
| POST | `/api/documents/parse` | 将 Word 解析为结构化事项 |
| POST | `/api/filters/classify` | AI 受众分类与筛选 |
| POST | `/api/notices/generate` | AI 生成通知文本和安全 HTML |
| POST | `/api/exports/xlsx` | 导出 Excel 文件 |

## 安全说明

- 真实密钥只应写入 `backend/.env`，该文件已被 `.gitignore` 排除。
- 不要在 `frontend` 下创建包含密钥的 `VITE_*` 变量；Vite 变量会进入浏览器构建产物。
- 旧版纯前端入口和密钥配置文件已从当前项目中移除。
- 如果某个密钥曾经提交到 Git、发到聊天或出现在纯前端代码中，应立即在服务商后台撤销并重新生成；仅从当前文件删除不能清除 Git 历史。
