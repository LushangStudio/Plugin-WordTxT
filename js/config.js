// 前端配置：用于直接调用远程转换接口
// 注意：此文件会包含敏感密钥，仅用于本地分发给可信任对象。
// 如果不希望暴露密钥，可改为在运行时提示对方输入，或使用后端代理(部署服务器)。

window.APP_CONFIG = {
  // DeepSeek OpenAI 兼容接口的基础地址
  baseUrl: "https://api.deepseek.com",
  // 默认模型：用于未显式指定任务模型的调用
  model: "deepseek-v4-pro",
  // 正式备忘生成/补漏：质量优先，使用 Pro
  generationModel: "deepseek-v4-pro",
  // 表格选择后生成学生通知：保留表格占位符与结构，使用 Pro
  tableNoticeModel: "deepseek-v4-pro",
  // 学生事项 AI 筛选：结构化 JSON 判断，速度和成本优先，使用 Flash
  studentFilterModel: "deepseek-v4-flash",
  // API Key：仅用于本地可信环境；公开分发前请改为后端代理或运行时输入
  apiKey: "sk-34fd98a2910f4159ad2e92b60b9445e1",
  // 可选：请求温度
  temperature: 0,
};
