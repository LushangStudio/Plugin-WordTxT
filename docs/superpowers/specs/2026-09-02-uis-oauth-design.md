# 复旦 UIS OAuth 认证设计

## 目标与范围

为现有 Vue 3 + FastAPI 学工备忘工作台增加复旦 UIS OAuth 2.0 授权码登录。OAuth 协议交互全部由后端完成，浏览器只持有本应用的 `HttpOnly` 会话 Cookie，不接触 `client_secret`、`access_token` 或 `refresh_token`。

本次包含登录、回调、用户信息读取、本地会话、主动退出、UIS 前端被动退出、业务 API 鉴权、前端登录门禁以及自动化测试。单用户调用次数限制不在本次范围内，因为尚未确定配额数值和统计周期；认证完成后可基于 `user_id` 增加。

## 已确认的协议约束

- 授权端点：`GET https://id.fudan.edu.cn/idp/authCenter/authenticate`
- Token 端点：`POST https://id.fudan.edu.cn/idp/api/v3/oauth2/token`
- UserInfo 端点：`GET https://id.fudan.edu.cn/idp/api/v3/oauth2/userInfo`
- 全局退出端点：`GET https://id.fudan.edu.cn/idp/authCenter/GLO`
- 回调地址：`https://lushangstudio.fudan.edu.cn/api/auth/callback`
- 授权请求参数：`response_type=code`、`client_id`、`redirect_uri`、`state`
- 不使用 PKCE，不发送 `code_challenge`、`code_challenge_method` 或 `code_verifier`
- Token 请求使用 HTTP Basic `client_id:client_secret`，表单仅发送 `grant_type=authorization_code` 和 `code`，不发送 `redirect_uri`
- UserInfo 按 3.2.3.6 参数表解析：必填 `user_id`、`user_name`、`user_type`、`sessionId`；可选 `mobile`、`email`、`department`
- `user_type == "本专科生"` 时拒绝进入应用；其他已认证类型允许进入
- 不使用手册成功示例中的 `userId`、`userName`、`spRoleList` 作为替代字段

## 用户流程

1. 前端加载时请求 `GET /api/auth/me`。
2. 未登录时显示 UIS 登录入口，不渲染文档处理工作台。
3. `GET /api/auth/login` 生成高熵、一次性的 `state`，将其和签发时间保存在签名会话中，然后 302 到 UIS 授权端点。
4. `GET /api/auth/callback` 必须校验 `state` 存在、相等且未超过 10 分钟，并在使用时立即删除。
5. 后端以 HTTP Basic 交换授权码，再以 `Authorization: Bearer <access_token>` 调用 UserInfo。
6. UserInfo 必填字段缺失或类型错误时登录失败；本科生跳回前端并显示“当前应用暂不面向本科生开放”。
7. 其他用户建立本应用会话并跳回固定前端地址。
8. 所有文档、筛选、通知和导出 API 要求本地会话；健康检查及 OAuth 必需路由公开。
9. 主动退出通过 `POST /api/auth/logout` 清除本地会话并 303 到 UIS 全局退出地址，`redirectToUrl` 只能使用配置中的固定前端地址。
10. UIS 前端被动退出在用户浏览器中异步调用 `GET /api/auth/sso-logout`。应用直接清除当前浏览器会话并返回无敏感信息的 204；该地址不接收 Token 参数。

## 后端模块边界

- `app/core/config.py`：OAuth、会话 Cookie 和固定跳转地址配置；提供不暴露密钥的 `auth_configured` 判定。
- `app/schemas/auth.py`：严格的 UIS UserInfo、前端用户和 `/auth/me` 响应模型。
- `app/services/oauth_service.py`：授权 URL、Token 交换、UserInfo 请求和平台错误归一化。
- `app/core/auth.py`：本地会话创建/解析和业务 API 的 `require_current_user` 依赖。
- `app/api/routes/auth.py`：登录、回调、当前用户、主动退出和被动退出 HTTP 流程。
- `app/main.py`：安装 Starlette `SessionMiddleware`；测试可通过 `create_app(settings)` 构造独立应用。
- `app/api/router.py`：公开挂载 auth/health，将鉴权依赖统一施加到四组业务路由。

## 会话与安全策略

- Cookie 名称默认为 `lushangstudio_session`，`HttpOnly`，`SameSite=Lax`，生产环境要求 `Secure=true`，最长 8 小时。
- `AUTH_SESSION_SECRET` 至少 32 个字符。缺少 `client_id`、`client_secret`、回调地址或合格会话密钥时，认证入口返回 503，业务路由保持失败关闭。
- 会话只保存前端需要的用户标识、用户类型和本次登录时间；不保存原始 Access/Refresh Token、Token 摘要、手机号、邮箱或院系。
- 被动退出采用手册 3.2.5.2.1 的前端用户会话注销模式。生产环境的 UIS 与应用均为 HTTPS 且同属 `fudan.edu.cn`，因此保留 `SameSite=Lax`；若学校改要求 3.2.5.2.2 服务端模式，则必须另行引入共享会话存储维护 Token 与本地会话的关联。
- OAuth `state` 使用 `secrets.token_urlsafe(32)`，采用常量时间比较，单次使用并设置 10 分钟有效期。
- 不接受用户传入的任意登录后跳转地址，避免开放重定向。
- 平台即使以 HTTP 200 返回 `errcode`，也按 OAuth 失败处理；错误响应和日志不得包含凭据、授权码或 Token。

## 前端行为与视觉规范

- 保持当前工业化工具台及三栏工作区，不重设计主页面。
- 初始状态显示“正在确认登录状态”；匿名状态显示与主内容左边界对齐的 UIS 访问说明和登录按钮。
- 登录后页眉显示姓名及用户类型，并提供退出表单；上传入口保持原位置。
- 所有 `fetch`（包括 Excel 下载）统一使用 `credentials: "include"`。
- 任一业务请求返回 401 时，API 层通知根组件清除当前用户并回到登录门禁，不自动重放可能产生副作用的请求。
- OAuth 回调带 `auth_error=undergraduate_not_allowed` 时显示固定中文提示并从地址栏清理该查询参数。

## 可测试验收标准

1. 当 OAuth 配置完整且用户点击登录时，系统应生成并保存一次性 `state`，且授权 URL 不包含任何 PKCE 参数。
2. 当回调 `state` 缺失、错配或过期时，系统应拒绝回调且不调用 Token 端点。
3. 当回调有效时，系统应以 Basic 认证交换 code，且 Token 表单不包含 `redirect_uri`。
4. 当 UserInfo 缺少 3.2.3.6 的必填字段时，系统应拒绝建立会话。
5. 当 `user_type` 为 `本专科生` 时，系统应拒绝访问并向前端提供明确提示。
6. 当非本科生登录成功时，系统应建立本地会话，`/api/auth/me` 返回最小用户信息，受保护业务 API 可访问。
7. 当请求未携带有效本地会话时，五个业务端点应返回 401；`/api/health` 仍返回 200。
8. 当用户主动退出或 UIS 在当前浏览器访问前端被动退出地址时，系统应清除本地会话。
9. 当前端处于匿名状态时，工作台不应渲染；登录后应显示工作台及用户退出入口。
10. 当 API 返回 401 时，前端应切回匿名状态；所有 API 与下载请求应携带 Cookie 凭据模式。
