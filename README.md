# 学工备忘整理工具

项目已由纯前端页面重构为前后端分离应用：前端使用 Vue 3、TypeScript、Vite 和 Tailwind CSS，后端使用 FastAPI 和 Python。Word 解析、AI 调用、通知生成、Excel 导出和复旦 UIS OAuth 交互都由后端负责，浏览器不再保存或直接发送 API 密钥、OAuth 客户端密钥或 UIS Token。

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
│  │  ├─ api/routes/            # health、auth、documents、filters、notices、exports
│  │  ├─ core/config.py         # 环境变量与密钥配置
│  │  ├─ schemas/               # Pydantic 请求/响应模型
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
- 通过复旦 UIS OAuth 2.0 授权码流程登录；浏览器只持有本应用签名的 `HttpOnly` 会话 Cookie。
- 未登录用户只能访问健康检查和认证接口，文档处理、筛选、通知生成和导出接口均要求有效会话。
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

编辑 `backend/.env`。本地只验证页面和非 AI 状态时可以暂不填写 UIS、AI 凭据；需要 AI 筛选和 AI 生成时填写：

```dotenv
DEEPSEEK_API_KEY=你的密钥
```

需要连接 UIS 时还需设置 `UIS_OAUTH_CLIENT_ID`、`UIS_OAUTH_CLIENT_SECRET` 和至少 32 个字符的随机 `AUTH_SESSION_SECRET`。真实值只能放在后端环境中，不能写入 Git 或任何 `VITE_*` 变量。完整变量见下方“UIS OAuth 配置”。

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

不配置 AI 密钥时，AI 筛选和 AI 通知生成会明确提示尚未配置。不配置 UIS 客户端凭据或合格的会话密钥时，`/api/health` 和 `/api/auth/me` 仍可访问，页面显示登录门禁，`/api/auth/login` 和所有业务接口返回 503 并保持关闭；认证配置完整但用户尚未登录时，业务接口返回 401。由于业务接口必须登录，UIS 未配置时不能在浏览器中实际使用文档处理功能。

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

## UIS OAuth 配置

后端通过进程环境变量读取配置；本地开发也可使用已被 `.gitignore` 排除的 `backend/.env`。生产服务器建议直接注入环境变量，不需要在服务器仓库中保存 `.env`。

| 环境变量 | 作用 | 生产建议值 |
|---|---|---|
| `UIS_OAUTH_CLIENT_ID` | UIS 为本应用分配的客户端标识 | UIS 最终下发值 |
| `UIS_OAUTH_CLIENT_SECRET` | 后端向 Token 端点证明客户端身份的机密 | UIS 最终下发值 |
| `UIS_OAUTH_AUTHORIZATION_URL` | 用户授权入口 | `https://id.fudan.edu.cn/idp/authCenter/authenticate` |
| `UIS_OAUTH_TOKEN_URL` | 后端用授权码换取 Token 的端点 | `https://id.fudan.edu.cn/idp/api/v3/oauth2/token` |
| `UIS_OAUTH_USER_INFO_URL` | 后端读取 UIS 用户信息的端点 | `https://id.fudan.edu.cn/idp/api/v3/oauth2/userInfo` |
| `UIS_OAUTH_LOGOUT_URL` | UIS 全局退出端点 | `https://id.fudan.edu.cn/idp/authCenter/GLO` |
| `UIS_OAUTH_REDIRECT_URI` | UIS 登录完成后的固定回调地址 | `https://lushangstudio.fudan.edu.cn/api/auth/callback` |
| `AUTH_FRONTEND_URL` | 登录成功、拒绝访问及主动退出后的固定前端地址 | `https://lushangstudio.fudan.edu.cn` |
| `AUTH_SESSION_SECRET` | 签名本应用会话 Cookie；不是 UIS 客户端密钥 | 独立生成的高熵随机值，至少 32 个字符 |
| `AUTH_SESSION_COOKIE_NAME` | 本应用会话 Cookie 名称 | `lushangstudio_session` |
| `AUTH_SESSION_COOKIE_SECURE` | 只允许浏览器经 HTTPS 携带会话 Cookie | `true` |
| `AUTH_SESSION_TTL_SECONDS` | 本应用会话有效期 | `28800`（8 小时） |
| `AUTH_STATE_TTL_SECONDS` | 一次性 OAuth `state` 有效期 | `600`（10 分钟） |
| `AUTH_UNDERGRADUATE_ALLOWLIST` | 允许登录的本科生 `user_id`；多人以英文逗号分隔 | 默认留空；仅联调时填写测试账号 |

生产环境还应设置 `APP_ENV=production` 和 `FRONTEND_ORIGINS=https://lushangstudio.fudan.edu.cn`。当前实现不启用 PKCE；Token 请求使用 HTTP Basic 客户端认证，表单只提交 `grant_type` 和 `code`。

本科生允许列表按 UIS 返回的 `user_id` 去除首尾空格后精确匹配，不支持通配符。变量为空时仍拒绝全部本科生；联调结束后应从服务器环境中删除测试账号并重启后端，原有测试账号会在下一次会话检查或业务请求时立即失效。

在 UIS 平台登记以下固定地址：

- 登录回调地址：`https://lushangstudio.fudan.edu.cn/api/auth/callback`
- 前端被动退出地址：`https://lushangstudio.fudan.edu.cn/api/auth/sso-logout`（选择手册 3.2.5.2.1“前端用户会话注销”，不传 `token`）

主动退出时，后端固定向 UIS 全局退出地址提交 `redirectToLogin=true` 和上述 `AUTH_FRONTEND_URL`，不接受请求方覆盖返回地址。该 `POST` 仅接受已有本地会话且来源与 `AUTH_FRONTEND_URL` 同源的浏览器请求：优先校验 `Origin`，缺失时校验 `Referer`；缺失、畸形或跨源请求会返回 403，不清除本地会话也不会跳转 UIS。

所有 `/api/auth/*` 响应发送 `Cache-Control: no-store`；OAuth 回调（包括尾斜杠重定向）还发送 `Referrer-Policy: no-referrer`，避免回调参数在缓存或后续 Referer 中传播。

代码和自动化测试已经覆盖本地 OAuth 协议行为，但在 UIS 下发真实 `client_id` 和 `client_secret` 前，不能完成或宣称真实 UIS 跳转、授权码交换、用户信息读取及全局退出联调。

## 生产反向代理要求

`lushangstudio.fudan.edu.cn` 必须启用 HTTPS，并由同一站点同时提供前端和后端：

- 将所有 `/api/*` 请求（包括回调和被动退出）原样反向代理到 FastAPI 服务，例如 `127.0.0.1:8000`；保留 HTTP 方法、请求体、Cookie 和 `Set-Cookie`。
- 其他路径提供 `frontend/dist` 静态文件，并为前端路由回退到 `index.html`。
- 不要把 `/api/auth/callback` 或 `/api/auth/sso-logout` 回退到前端，否则 OAuth 回调和退出会失效。
- 上游网关、负载均衡、CDN 和反向代理不得记录 OAuth 回调地址的原始查询字符串，其中会包含授权码和 `state`。前端被动退出地址按约定不应携带查询参数；作为纵深防护，也应避免记录该地址的原始查询字符串。应用已对 Uvicorn 访问日志做脱敏，但请求到达应用前的代理日志仍需单独配置为不记录或脱敏查询参数。

## 自动验证

后端测试：

```powershell
cd C:\Users\21497\Desktop\Plug\Plugin\backend
.\.venv\Scripts\python.exe -m pytest
```

前端类型检查与生产构建：

```powershell
cd C:\Users\21497\Desktop\Plug\Plugin\frontend
npm test
npm run type-check
npm run build
```

## API 概览

| 方法 | 地址 | 作用 |
|---|---|---|
| GET | `/api/health` | 后端及 AI 配置状态 |
| GET | `/api/auth/login` | 创建一次性 OAuth `state` 并跳转到 UIS |
| GET | `/api/auth/callback` | UIS 登录回调；由 UIS 平台访问 |
| GET | `/api/auth/me` | 查询当前本地登录会话 |
| POST | `/api/auth/logout` | 清除本地会话并跳转到 UIS 全局退出 |
| GET | `/api/auth/sso-logout` | 接收 UIS 前端被动退出通知并清除当前浏览器会话 |
| POST | `/api/documents/extract` | 提取 Word 全文及原表格映射 |
| POST | `/api/documents/parse` | 将 Word 解析为结构化事项 |
| POST | `/api/filters/classify` | AI 受众分类与筛选 |
| POST | `/api/notices/generate` | AI 生成通知文本和安全 HTML |
| POST | `/api/exports/xlsx` | 导出 Excel 文件 |

## 安全说明

- 真实密钥只应通过服务器环境变量注入，或在本地写入 `backend/.env`；该文件已被 `.gitignore` 排除。
- 不要在 `frontend` 下创建包含密钥的 `VITE_*` 变量；Vite 变量会进入浏览器构建产物。
- 浏览器会话不保存 UIS 的原始 Access Token、Refresh Token 或 Token 摘要，只保存最小用户信息和登录时间。
- 旧版纯前端入口和密钥配置文件已从当前项目中移除。
- 如果某个密钥曾经提交到 Git、发到聊天或出现在纯前端代码中，应立即在服务商后台撤销并重新生成；仅从当前文件删除不能清除 Git 历史。
