// 前端配置：用于直接调用远程转换接口
// 注意：此文件会包含敏感密钥，仅用于本地分发给可信任对象。
// 如果不希望暴露密钥，可改为在运行时提示对方输入，或使用后端代理(部署服务器)。

window.APP_CONFIG = {
  // OpenAI 兼容接口的基础地址（与 Python 里配置保持一致）
  baseUrl: "https://ai.nengyongai.cn/v1",
  // 模型名称（与后端一致即可）
  model: "gpt-4o",
  // 仅学生事项筛选模型：用于判断每个条目是否应保留为学生备忘
  studentFilterModel: "gpt-5.4-mini",
  // API Key（示例：来自现有 Python 文件）；实际使用时请替换为您自己的
  apiKey: "sk-DZoxaZNxtiSxHYu5Gbx7uHAK351yRTyADXrBeSKX6ihw1qey",
  // 可选：请求温度
  temperature: 0,
};
