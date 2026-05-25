
// 统一选择器与状态元素
const $  = s => document.querySelector(s);
const statusEl = $('#status');
const tableWrap = $('#tableWrap');
const fileInput = $('#fileInput');
const parseBtn = $('#parseBtn');
const exportBtn = $('#exportBtn');
const libraryStatus = $('#libraryStatus');
// 新增：挑选与通知生成相关元素
const collectBtn = $('#collectBtn');
const selectedOutput = $('#selectedOutput');
const noticeHeader = $('#noticeHeader');
const noticeFooter = $('#noticeFooter');
const generateNoticeBtn = $('#generateNoticeBtn');
const finalNoticeOutput = $('#finalNoticeOutput');
const extractWordTextBtn = $('#extractWordTextBtn');
const wordTextStatus = $('#wordTextStatus');
const wordContentEditor = $('#wordContentEditor');
const promptTemplateSelect = $('#promptTemplateSelect');
const counselorPromptInput = $('#counselorPromptInput');
const savePromptBtn = $('#savePromptBtn');
const resetPromptBtn = $('#resetPromptBtn');
const generateFromFilteredTextBtn = $('#generateFromFilteredTextBtn');
const currentDocNameEl = $('#currentDocName');
const activeModeStatus = $('#activeModeStatus');
const wordContentStats = $('#wordContentStats');
const copyResultTextBtn = $('#copyResultTextBtn');
// 新增：复制通知按钮与状态提示元素
const copyNoticeBtn = document.getElementById('copyNoticeBtn');
const copyStatusEl = document.getElementById('copyStatus');

// 新增：初始化复制按钮状态与监听通知输出变化，成功生成后自动启用
(() => {
  try {
    if (copyNoticeBtn) {
      copyNoticeBtn.disabled = true; // 初始化禁用
    }
    if (finalNoticeOutput) {
      const observer = new MutationObserver(() => {
        const btn = document.getElementById('copyNoticeBtn');
        const status = document.getElementById('copyStatus');
        if (!btn) return;
        const hasTable = !!finalNoticeOutput.querySelector('table, .docx-table');
        if (hasTable) {
          btn.disabled = false;
          btn.title = '复制表格到剪贴板';
          if (status) status.textContent = '';
        } else {
          btn.disabled = true;
          btn.title = '无表格可复制';
        }
      });
      observer.observe(finalNoticeOutput, { childList: true, subtree: true, characterData: true });
    }
  } catch (e) {
    console.warn('复制按钮状态监听初始化失败:', e);
  }
})();
// 新增：排序指示器与拖拽提示
const sortIndicator = $('#sortIndicator');
const dragHint = $('#dragHint');
// 新增：统一的取消全选按钮（作用于当前排序）
const clearSelectBtn = document.getElementById('clearSelectBtn');
// 正则规则
const BLOCK_HEAD_RE = /^(?<prefix>\s*(?:\d+|[一二三四五六七八九十百千]+|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\))[\.\.、．]?\s*)?(?<title>【[^】]{1,50}】)/gm;
// 删除旧版联系人解析；新增支持“联系人：姓名1 电话1，姓名2 电话2……”格式
const DATE_WITH_WEEK_RE = /(?<date>\d{1,2}月\d{1,2}日)(?:（(?<week>周[一二三四五六日天]|星期[一二三四五六日天])）)?/;
const TIME_RE = /((?:上|下)午)?\s*(\d{1,2})[：:](\d{2})/g;
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>'"\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]+)/gi;
// 中文数字序号识别正则：匹配段落开头的中文数字序号
const CHINESE_NUMBER_PREFIX_RE = /^\s*[一二三四五六七八九十百千万]+[\s、．.，,:：]/;
// 分类标题识别：仅匹配“中文数字+中文顿号”开头，且为独立段落
// 例如：“一、思政工作”、“二、思政大课”，严格排除数字编号/空格/冒号/井号等干扰项
const CATEGORY_LINE_RE = /(^|\n)\s*([一二三四五六七八九十百千]+)、\s*([^\n【】#:：]{2,50})\s*(?=$|\n)/g;
const SPECIAL_CATEGORY_LINE_RE = /(^|\n)\s*(专项工作)\s*(?=$|\n)/g;
// 变更：二级分类支持英文分隔符（."."、")"、"．"）以兼容英文标题格式，如 "3) Student Development Work"
const SUBCATEGORY_LINE_RE = /(^|\n)\s*((?:[1-9]|1[0-9]))[、\.．\)]\s*([^\n【】#:：]{1,100})\s*(?=$|\n)/g;
// 变更：条目支持中文/英文括号且允许括号内外存在空格，如 "( 1 )"、"（ 2 ）"
const ITEM_START_RE = /^\s*(（\s*\d+\s*）|\(\s*\d+\s*\))/;
const ITEM_MARKER_RE = /(（\s*\d+\s*）|\(\s*\d+\s*\))/g;
const BRACKET_NUMBER_RE = /【(\s*)\d+(\s*)】/g;

// 新增：API 配置检测与提示（无需本地后端）
function isApiConfigured(){
  try{
    const cfg = window.APP_CONFIG || {};
    return Boolean(cfg && cfg.baseUrl && cfg.apiKey && cfg.model);
  }catch(e){
    return false;
  }
}

// 初始化：显示库/服务状态，并根据配置启用/禁用“生成通知”按钮
(() => {
  const ok = isApiConfigured();
  if (libraryStatus){
    libraryStatus.textContent = ok
      ? '依赖加载正常；转换服务：已准备就绪（无需命令行）'
      : '依赖加载正常；转换服务：未配置（仅整理/导出可用）';
  }
  if (generateNoticeBtn){
    generateNoticeBtn.disabled = !ok;
    generateNoticeBtn.title = ok ? '直接在本地网页调用转换服务' : '请配置 js/config.js 中的 API 信息后使用';
  }
})();

// 文件名生成
function getDocxBaseName() {
  const f = fileInput && fileInput.files && fileInput.files[0];
  if (!f || !f.name) return '';
  return f.name.replace(/\.[dD][oO][cC][xX]$/, '').trim();
}
function makeAutoFilename() {
  const base = getDocxBaseName();
  if (base) return `${base}_通知整理.xlsx`;
  return '通知整理.xlsx';
}

let records = [];
let originalRecords = [];
let keywordCutInfo = null;
// 新增：自定义排序状态
let customOrder = [];
let sortableInstance = null;
// 新增：分类标记集合（仅用于展示，不参与导出/排序）
let categoryMarkers = [];
// 新增：完整结构（分类标记与条目），用于层级重组与重编号输出
let parsedStructure = null;
let originalWordText = '';
// 新增：每种排序方式的独立选择状态
let selectionState = { original: new Set(), time: new Set(), custom: new Set() };
let lastSortType = null;
let selectionHandlerBound = false;
// 拖拽开始前的选择状态快照（仅用于自定义排序）
let dragSelectionSnapshot = null;
// 记录上一次渲染的行UID集合（按排序方式），用于识别真正“新增”的行
let lastRenderedUids = { original: new Set(), time: new Set(), custom: new Set() };

function getCurrentSortType(){
  const el = document.querySelector('input[name="sortType"]:checked');
  return el ? el.value : 'original';
}
function setSortIndicator(){
  const t = getCurrentSortType();
  if (sortIndicator){
    sortIndicator.textContent = t === 'time' ? '时间排序' : t === 'custom' ? '自定义排序' : '原文档顺序';
  }
  if (dragHint){
    dragHint.style.display = t === 'custom' ? '' : 'none';
  }
}
function getCustomOrderKey(){
  const base = getDocxBaseName() || 'default';
  return `rs_custom_order_${base}`;
}
function saveCustomOrder(){
  try{
    const key = getCustomOrderKey();
    localStorage.setItem(key, JSON.stringify(customOrder));
  }catch(e){
    console.warn('保存自定义排序失败:', e);
  }
}
function loadCustomOrder(validUids){
  try{
    const key = getCustomOrderKey();
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // 过滤不存在的uid
    const set = new Set(validUids || []);
    return arr.filter(u => set.has(u));
  }catch(e){
    console.warn('读取自定义排序失败:', e);
    return [];
  }
}

function normalizeText(s){
  return s
    .replace(/\u3000/g,' ')
    .replace(/\r\n?/g,'\n');
}

function normalizeMemoLayoutText(text){
  let s = String(text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/\[[^\]\n]{1,20}\d+(?:\.\d+)+\]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  const categoryTitles = '学生工作|就业工作|工作提醒|发放材料';
  const subcategoryTitleChars = '[\\u4E00-\\u9FFF“”《》（）()A-Za-z0-9·\\- ]{0,40}?';
  const subcategoryKeywords = '工作|教育|服务|管理|事务|招生|专项|材料|活动|通知';
  const categoryRe = new RegExp(`([^\\n])(?=([一二三四五六七八九十百千]+)、\\s*(?:${categoryTitles}))`, 'g');
  const specialCategoryRe = /([^\n])(?=(专项工作))/g;
  const subcategoryRe = new RegExp(`([^\\n])(?=((?:[1-9]|1[0-9])[、\\.．\\)]\\s*${subcategoryTitleChars}(?:${subcategoryKeywords})))`, 'g');
  const categoryLineRe = new RegExp(`(^|\\n)\\s*([一二三四五六七八九十百千]+、\\s*(?:${categoryTitles}))\\s*`, 'g');
  const specialCategoryLineRe = /(^|\n)\s*(专项工作)\s*/g;
  const subcategoryLineRe = new RegExp(`(^|\\n)\\s*((?:[1-9]|1[0-9])[、\\.．\\)]\\s*${subcategoryTitleChars}(?:${subcategoryKeywords}))\\s*`, 'g');

  s = s
    .replace(categoryRe, '$1\n')
    .replace(specialCategoryRe, '$1\n')
    .replace(subcategoryRe, '$1\n')
    .replace(categoryLineRe, '$1$2\n')
    .replace(specialCategoryLineRe, '$1$2\n')
    .replace(subcategoryLineRe, '$1$2\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

function sanitizeGeneratedNoticeText(input){
  let s = String(input || '').replace(/\r/g, '');

  s = s
    .replace(/^\s*```(?:markdown|md|text)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/(^|\n)\s*```[A-Za-z0-9_-]*\s*(?=\n|$)/g, '$1')
    .replace(/(^|\n)\s*```\s*(?=\n|$)/g, '$1');

  s = s
    .replace(/(^|\n)\s*(?:通知开头|通知结尾|开头|结尾)[:：]\s*/g, '$1')
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1')
    .replace(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g, '$1 $2')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1：$2')
    .replace(/<(?!!--TABLE_PLACEHOLDER_\d+--)[^>\n]+>/g, '')
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/__([^_\n]+?)__/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/`([^`\n]+?)`/g, '$1')
    .replace(/(^|\n)\s{0,3}>\s?/g, '$1')
    .replace(/(^|\n)\s{0,3}[-*+]\s+/g, '$1')
    .replace(/[ \t]{2,}\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
}

function setGeneratedPlainTextOutput(outputEl, text){
  if (!outputEl) return;
  outputEl.textContent = sanitizeGeneratedNoticeText(text);
}

function buildGenerationItemsFromFilteredText(text){
  const blocks = splitWordTextBlocks(text)
    .map(block => String(block || '').trim())
    .filter(Boolean);
  return blocks.map((text, index) => ({
    id: `ITEM_${index + 1}`,
    text
  }));
}

function formatGenerationItemsForPrompt(items){
  return (items || []).map(item => `[${item.id}]\n${item.text}`).join('\n\n');
}

function getMissingGeneratedItemIds(result, items){
  const found = new Set();
  const re = /\[ITEM_(\d+)\]/g;
  let m;
  while ((m = re.exec(String(result || ''))) !== null) {
    found.add(`ITEM_${Number(m[1])}`);
  }
  return (items || []).map(item => item.id).filter(id => !found.has(id));
}

function stripInternalItemMarkers(text){
  return String(text || '')
    .replace(/(^|\n)\s*\[ITEM_(\d+)\]\s*(?:\d+[、\.．]\s*)?/g, (match, prefix, n) => `${prefix}${Number(n)}. `)
    .replace(/\s*\[ITEM_(\d+)\]\s*(?:\d+[、\.．]\s*)?/g, (match, n) => `\n\n${Number(n)}. `)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function removeBigHeaderLines(s){
  const lines = s.split('\n').filter(line=>{
    return !/^\s*(?:\(?[一二三四五六七八九十百千]+\)?|[0-9]+)\s*[、\.．]\s*$/.test(line);
  }).filter(line=>{
    return !/^\s*(?:[一二三四五六七八九十]+)[、\.]?.*$/.test(line);
  });
  const text = lines.join('\n');
  return text.replace(/(?:^|\n)\s*(?:[一二三四五六七八九十]+|\d+)[、\.]\s*/g, '\n');
}

function splitBlocks(full){
  const matches = [...full.matchAll(BLOCK_HEAD_RE)];
  if (matches.length === 0){
    return full.trim() ? [{ text: full.trim() }] : [];
  }
  const out = [];
  for (let i=0; i<matches.length; i++){
    const m = matches[i];
    const start = m.index;
    const end = (i+1 < matches.length) ? matches[i+1].index : full.length;

    let chunk = full.slice(start, end).trim();
    const prefix = m.groups.prefix || '';
    if (prefix) {
      chunk = chunk.replace(prefix, '').trim();
    }
    out.push({ text: chunk });
  }
  return out;
}

function extractDateWeek(text){
  const m = text.match(DATE_WITH_WEEK_RE);
  if (!m) return { dateNoWeek: '', week: '' };
  return { dateNoWeek: m.groups.date || '', week: m.groups.week || '' };
}

function extractContact(text){
  try{
    const s = String(text || '');
    const start = s.search(/联系人[:：]/);
    if (start < 0) return { name: '', phone: '' };
    const rest = s.slice(start).replace(/^联系人[:：]\s*/,'');
    // 仅取至首个中文句号（若存在），避免跨段误取
    const endIdx = rest.indexOf('。');
    const line = (endIdx >= 0 ? rest.slice(0, endIdx) : rest).trim();
    if (!line) return { name: '', phone: '' };
    // 以中文逗号分隔多个“姓名 电话”对
    const parts = line.split('，').map(p => p.trim()).filter(Boolean);
    const names = [];
    const phones = [];
    for (const part of parts){
      // 要求姓名与电话之间仅一个空格；电话允许数字与连接符
      const m = part.match(/^([^\s，。]+)\s([0-9\-－—]+)$/);
      if (m){ names.push(m[1]); phones.push(m[2]); }
    }
    return { name: names.join('、'), phone: phones.join('，') };
  }catch(e){
    return { name: '', phone: '' };
  }
}

function formatTimeMatch(m){
  const ampm = m[1] || '';
  const hh = String(m[2]).padStart(2,'0');
  const mm = m[3];
  return `${ampm}${hh}:${mm}`;
}

function extractTimes(text){
  const times = [];
  for (const m of text.matchAll(TIME_RE)){
    const t = formatTimeMatch(m);
    if (!times.includes(t)) times.push(t);
  }
  return times;
}

function makeTimeCell(dateNoWeek, times){
  if (dateNoWeek && times.length) return `${dateNoWeek} ${times.join('、')}`;
  if (dateNoWeek) return dateNoWeek;
  if (times.length) return times.join('、');
  return '';
}

function extractMonthDay(timeStr) {
  if (!timeStr) return { month: 0, day: 0 };
  const match = timeStr.match(/(\d{1,2})月(\d{1,2})日/);
  if (match) {
    return {
      month: parseInt(match[1], 10),
      day: parseInt(match[2], 10)
    };
  }
  return { month: 0, day: 0 };
}

function sortByTime(rows) {
  const withTime = [];
  const withoutTime = [];
  rows.forEach(row => {
    const { month, day } = extractMonthDay(row["时间"]);
    if (month > 0 && day > 0) {
      withTime.push({ ...row, _month: month, _day: day });
    } else {
      withoutTime.push(row);
    }
  });
  withTime.sort((a, b) => {
    if (a._month !== b._month) return a._month - b._month;
    return a._day - b._day;
  });
  return [...withTime.map(({ _month, _day, ...row }) => row), ...withoutTime];
}

function convertPlainTextUrls(text) {
  if (!text) return '';
  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(URL_PATTERN.source, 'gi');
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHtml(text.substring(lastIndex, match.index)));
    }
    const url = match[0];
    parts.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.substring(lastIndex)));
  }
  return parts.length > 0 ? parts.join('') : escapeHtml(text);
}

function convertUrlsToLinks(input) {
  if (!input) return '';
  const text = String(input);
  // 如果文本中包含现有 <a> 标签，则只在非标签区域进行 URL 转换，避免重复包裹
  const anchorRe = /<a\b[^>]*>.*?<\/a>/gi;
  let result = '';
  let lastIndex = 0;
  let m;
  while ((m = anchorRe.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index);
    result += convertPlainTextUrls(before);
    result += m[0]; // 保留原始 a 标签
    lastIndex = anchorRe.lastIndex;
  }
  const tail = text.slice(lastIndex);
  result += convertPlainTextUrls(tail);
  return result;
}

// 过滤以中文数字序号开头的段落
function filterChineseNumberParagraphs(text) {
  if (!text) return '';
  
  // 按段落分割（保留段落分隔符）
  const paragraphs = text.split(/\n\s*\n/);
  
  // 过滤掉以中文数字序号开头的段落
  const filteredParagraphs = paragraphs.filter(paragraph => {
    const trimmed = paragraph.trim();
    if (!trimmed) return true; // 保留空段落
    
    // 检查是否以中文数字序号开头
    return !CHINESE_NUMBER_PREFIX_RE.test(trimmed);
  });
  
  // 重新组合段落，保持原有的段落分隔
  return filteredParagraphs.join('\n\n');
}

function parseNewFormatStructure(fullText){
  const s = normalizeMemoLayoutText(fullText);
  const markers = [];
  const items = [];
  let m;
  CATEGORY_LINE_RE.lastIndex = 0;
  while ((m = CATEGORY_LINE_RE.exec(s)) !== null) {
    const title = `${m[2]}、${(m[3] || '').trim()}`.trim();
    const pos = m.index + (m[1] ? m[1].length : 0);
    const end = CATEGORY_LINE_RE.lastIndex;
    if (title) markers.push({ title, pos, end, level: 1 });
  }
  SPECIAL_CATEGORY_LINE_RE.lastIndex = 0;
  while ((m = SPECIAL_CATEGORY_LINE_RE.exec(s)) !== null) {
    const title = (m[2] || '').trim();
    const pos = m.index + (m[1] ? m[1].length : 0);
    const end = SPECIAL_CATEGORY_LINE_RE.lastIndex;
    if (title) markers.push({ title, pos, end, level: 1 });
  }
  SUBCATEGORY_LINE_RE.lastIndex = 0;
  while ((m = SUBCATEGORY_LINE_RE.exec(s)) !== null) {
    const title = `${m[2]}、${(m[3] || '').trim()}`.trim();
    const pos = m.index + (m[1] ? m[1].length : 0);
    const end = SUBCATEGORY_LINE_RE.lastIndex;
    if (title) markers.push({ title, pos, end, level: 2 });
  }

  markers.sort((a,b)=>a.pos-b.pos);
  const contentMarkers = markers.filter(mk => mk.level === 1 || mk.level === 2);
  for (let i=0; i<contentMarkers.length; i++){
    const marker = contentMarkers[i];
    const next = contentMarkers.find((mk, idx) => idx > i && (mk.level <= marker.level || marker.level === 2));
    const start = typeof marker.end === 'number' ? marker.end : marker.pos + marker.title.length;
    let end = next ? next.pos : s.length;
    if (marker.level === 1) {
      const firstSub = contentMarkers.find((mk, idx) => idx > i && mk.level === 2 && mk.pos < end);
      if (firstSub) end = firstSub.pos;
    }
    const raw = s.slice(start, end).trim();
    if (!raw) continue;

    const chunks = splitItemsWithinSection(raw, start);
    chunks.forEach(chunk => {
      if (chunk && chunk.text) items.push(chunk);
    });
  }

  items.sort((a,b)=>a.pos-b.pos);
  for (let i=0; i<items.length; i++){
    items[i].end = i + 1 < items.length ? items[i + 1].pos : s.length;
  }
  return { markers, items };
}

function normalizeItemPrefix(text){
  return String(text || '')
    .replace(/^(\s*)\(\s*(\d+)\s*\)/, (full, p, n) => `${p}（${n}）`)
    .replace(/^(\s*)（\s*(\d+)\s*）/, (full, p, n) => `${p}（${n}）`);
}

function splitItemsWithinSection(rawText, basePos){
  const raw = String(rawText || '').trim();
  if (!raw) return [];
  if (!ITEM_START_RE.test(raw) || shouldKeepSectionAsSingleItem(raw)) {
    return [{ text: raw, pos: basePos + String(rawText || '').indexOf(raw) }];
  }

  const matches = [];
  const re = new RegExp(ITEM_MARKER_RE.source, 'g');
  let m;
  while ((m = re.exec(raw)) !== null) {
    const prefix = raw.slice(Math.max(0, m.index - 8), m.index);
    const suffix = raw.slice(re.lastIndex, re.lastIndex + 40);
    const startsAfterBoundary = m.index === 0 || /[。；;]\s*$/.test(prefix) || /\s+$/.test(prefix);
    const looksLikeItemTitle = /[\u4E00-\u9FFF“A-Za-z0-9]/.test(suffix) && /。/.test(suffix.slice(0, 80));
    if (startsAfterBoundary && looksLikeItemTitle) matches.push({ index: m.index });
  }
  if (!matches.length) return [{ text: raw, pos: basePos + String(rawText || '').indexOf(raw) }];

  const chunks = [];
  for (let i=0; i<matches.length; i++){
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i+1].index : raw.length;
    const text = normalizeItemPrefix(raw.slice(start, end).trim());
    if (text) chunks.push({ text, pos: basePos + start });
  }
  return chunks;
}

function shouldKeepSectionAsSingleItem(raw){
  const text = String(raw || '').trim();
  if (!text) return false;
  const firstMarker = text.search(ITEM_MARKER_RE);
  if (firstMarker <= 0) return false;
  const before = text.slice(0, firstMarker);
  return /[。；;：:]\s*$/.test(before) || before.length > 20;
}

async function parseDocx(file){
  try {
    statusEl.textContent = '解析中…';
    const arrayBuffer = await file.arrayBuffer();
    const pre = await preprocessDocxTextWithTruncation(arrayBuffer, ['工作提醒','发放材料']);
    const nf = parseNewFormatStructure(pre.text);
    categoryMarkers = nf.markers;
    parsedStructure = nf;
    keywordCutInfo = pre;

    const startNo = Number($('#startIndex').value) || 1;
    let running = startNo;

    // 解析表格：优先使用与正文同一条线性结构中提取出的表格，保证新版 WPS/Word 嵌套表格位置不丢失
    let tableExtraction = {
      tables: Array.isArray(pre.tables) ? pre.tables : [],
      report: pre.tableReport || { found: 0, converted: 0, failed: 0, failures: [] }
    };
    if (!tableExtraction.tables.length) {
      tableExtraction = await extractTablesFromDocx(arrayBuffer, pre.cutParagraphIndex || Infinity);
    }
    // 更新页面状态：显示表格解析统计
    try {
      const tps = document.getElementById('tableParseStatus');
      if (tps) {
        const rep = tableExtraction.report;
        const ksum = Array.isArray(pre.occurrences) ? pre.occurrences.length : 0;
        const kinfo = pre.first ? `；首次“工作提醒”：第${pre.first.pageNo}页，第${pre.first.paragraphIndex}段，第${pre.first.lineIndex}行` : '；未检测到“工作提醒”';
        tps.textContent = `表格解析：发现 ${rep.found}，成功 ${rep.converted}，失败 ${rep.failed}；关键词次数：${ksum}${kinfo}`;
      }
    } catch(e) { console.warn(e); }

    let rows = nf.items.map(({text, pos, end}, i) => {
      const { dateNoWeek, week } = extractDateWeek(text);
      const times = extractTimes(text);
      const timeCell = makeTimeCell(dateNoWeek, times);
      const contactInfo = extractContact(text);
      const rawText = String(text).trim();
      const nextPos = typeof end === 'number' ? end : Number.MAX_SAFE_INTEGER;
      const itemTables = tableExtraction.tables.filter(t => {
        if (!t) return false;
        if (rawText.includes(t.token)) return true;
        return typeof pos === 'number' && typeof t.pos === 'number' && t.pos >= pos && t.pos < nextPos;
      });
      const cleanedText = stripDocxTableTokens(rawText, itemTables);
      const workSummary = extractWorkSummary(cleanedText);

      let rawPos = typeof pos === 'number' ? pos : -1;

      const uid = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `uid_${Date.now()}_${i}`;

      // 将可能关联的表格嵌入“提取的内容_html”中（按相邻段落标题匹配）
      let htmlContent = replaceDocxTableTokensWithHtml(rawText, tableExtraction.tables);
      for (const table of itemTables) {
        if (table && table.token && !rawText.includes(table.token) && !htmlContent.includes(table.html)) {
          htmlContent += `\n${table.html || ''}`;
        }
      }
      if (itemTables.length && !/<table\b/i.test(htmlContent)) {
        htmlContent += `\n${itemTables.map(t => t.html || '').join('\n')}`;
      }
      try {
        const relatedTables = itemTables.length ? [] : matchTablesForParagraph(tableExtraction.tables, cleanedText, '');
        if (relatedTables && relatedTables.length) {
          const tablesHtml = relatedTables.map(t => t.html).join('\n');
          // 直接连接表格内容，不显示“相关表格：”提示
          htmlContent = `${htmlContent}\n${tablesHtml}`;
        }
      } catch(e) { console.warn('表格关联失败:', e); }
      return {
        uid,
        "编号": running++,
        "时间": timeCell,
        "星期几": week,
        "联系人": contactInfo.name,
        "联系电话": contactInfo.phone,
        "工作概述": workSummary,
        "提取的内容": cleanedText,
        "提取的内容_html": htmlContent,
        "备注": "",
        rawPos
      };
    });

    validateNoLeak(rows, tableExtraction, pre.forbiddenText, ['工作提醒','发放材料']);

    statusEl.textContent = `解析完成，共 ${rows.length} 条`;
    return rows;
  } catch (err) {
    console.error('DOCX解析失败:', err);
    statusEl.textContent = '解析失败：' + (err?.message || err);
    throw err;
  }
}

// 提取 DOCX 表格并转为 HTML
async function extractTablesFromDocx(arrayBuffer, maxParagraphIndex){
  const result = { tables: [], report: { found: 0, converted: 0, failed: 0, failures: [] } };
  try {
    if (!window.JSZip) {
      console.warn('JSZip 未加载，无法解析 DOCX 表格');
      return result;
    }
    const zip = await JSZip.loadAsync(arrayBuffer);
    const entry = zip.file('word/document.xml');
    if (!entry) {
      console.warn('DOCX 中不存在 word/document.xml');
      return result;
    }
    const xmlText = await entry.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const wNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const linear = buildDocxLinearContent(xmlDoc, wNs, { maxParagraphIndex });
    result.tables = linear.tables;
    result.report = linear.report;
  } catch (err) {
    console.warn('表格提取失败:', err);
  }
  return result;
}

function getParagraphText(pNode, wNs){
  let text = '';
  const runs = pNode.getElementsByTagNameNS(wNs, 'r');
  for (const r of runs){
    const tList = r.getElementsByTagNameNS(wNs, 't');
    for (const t of tList){ text += t.textContent; }
    // 处理换行
    const brs = r.getElementsByTagNameNS(wNs, 'br');
    if (brs && brs.length) text += '\n';
  }
  return text;
}

function hasAncestorLocalName(node, localNames){
  const names = Array.isArray(localNames) ? localNames : [localNames];
  let p = node ? node.parentNode : null;
  while (p && p.localName) {
    if (names.includes(p.localName)) return true;
    p = p.parentNode;
  }
  return false;
}

function collectDocxBlockNodes(root){
  const blocks = [];
  const visit = node => {
    if (!node || node.nodeType !== 1) return;
    if (node.localName === 'tbl') {
      blocks.push({ type: 'table', node });
      return;
    }
    if (node.localName === 'p') {
      blocks.push({ type: 'paragraph', node });
      return;
    }
    Array.from(node.childNodes || []).forEach(visit);
  };
  Array.from(root.childNodes || []).forEach(visit);
  return blocks.filter(block => {
    if (block.type === 'table') return !hasAncestorLocalName(block.node, 'tbl');
    return !hasAncestorLocalName(block.node, ['tbl', 'p']);
  });
}

function buildDocxLinearContent(xmlDoc, wNs, options = {}){
  const body = xmlDoc.getElementsByTagNameNS(wNs, 'body')[0];
  const result = { text: '', tables: [], report: { found: 0, converted: 0, failed: 0, failures: [] } };
  if (!body) return result;

  const parts = [];
  let tableIndex = 0;
  let paragraphIndex = 0;
  let lastParaText = '';
  const maxParagraphIndex = options.maxParagraphIndex;
  const blocks = collectDocxBlockNodes(body);

  for (const block of blocks){
    if (block.type === 'paragraph') {
      paragraphIndex++;
      const text = getParagraphText(block.node, wNs).trim();
      if (text) {
        lastParaText = text;
        parts.push(text);
      }
      continue;
    }

    if (block.type === 'table') {
      result.report.found++;
      const currentIndex = ++tableIndex;
      if (typeof maxParagraphIndex === 'number' && paragraphIndex >= maxParagraphIndex) {
        continue;
      }
      try {
        const tableHtml = buildHtmlTable(block.node, wNs);
        const html = `<table class="docx-table">${tableHtml}</table>`;
        const plain = extractTableTextFromTbl(block.node, wNs);
        const token = `<!--DOCX_TABLE_${currentIndex}-->`;
        const pos = parts.join('\n').length + (parts.length ? 1 : 0);
        result.tables.push({
          id: currentIndex,
          token,
          html,
          plain,
          index: currentIndex - 1,
          precedingText: lastParaText || '',
          paraIndexAtTable: paragraphIndex,
          pos
        });
        parts.push(token);
        result.report.converted++;
      } catch(e) {
        console.warn('转换表格失败:', e);
        result.report.failed++;
        result.report.failures.push({ index: currentIndex - 1, precedingText: lastParaText || '', error: String(e.message || e) });
      }
    }
  }

  result.text = normalizeMemoLayoutText(parts.join('\n'));
  return result;
}

function replaceDocxTableTokensWithHtml(text, tables){
  let html = convertUrlsToLinks(String(text || '')).replace(/\n/g,'<br>');
  if (!Array.isArray(tables) || !tables.length) return html;
  for (const table of tables){
    if (!table || !table.token) continue;
    html = html.split(escapeHtml(table.token)).join(table.html || '');
    html = html.split(table.token).join(table.html || '');
  }
  return html;
}

function stripDocxTableTokens(text, tables){
  let out = String(text || '');
  if (!Array.isArray(tables)) return out;
  for (const table of tables){
    if (table && table.token) out = out.split(table.token).join('');
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

function extractWorkSummary(text){
  const s = String(text || '')
    .replace(/<!--DOCX_TABLE_\d+-->/g, '')
    .replace(/^\s*(?:（\s*\d+\s*）|\(\s*\d+\s*\)|\d+[、\.．\)）])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  const m = s.match(/^[\s\S]*?[。！？!?\.](?=\s|$|[\u4E00-\u9FFF])/);
  if (m && m[0]) return m[0].trim();
  const firstLine = s.split(/\n/).map(line => line.trim()).find(Boolean) || s;
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine;
}

function findFirstSectionHeadingOffset(text, keywords){
  const lines = String(text || '').split('\n');
  const keys = Array.isArray(keywords) ? keywords : [keywords];
  const headingRes = keys
    .map(k => String(k || '').trim())
    .filter(Boolean)
    .map(k => new RegExp('^\\s*(?:([一二三四五六七八九十百千]+|\\d+)[、\\.．\\)）]\\s*)?'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:[:：])?\\s*$'));
  let offset = 0;
  for (let i=0; i<lines.length; i++){
    const line = lines[i] || '';
    for (let hi=0; hi<headingRes.length; hi++){
      if (headingRes[hi].test(line)) {
        return { offset, paragraphIndex: i + 1, lineIndex: 1, keyword: String(keys[hi] || '').trim() };
      }
    }
    offset += line.length + 1;
  }
  return null;
}

function normalizeExtractedWordText(text){
  return normalizeMemoLayoutText(text);
}

function getCurrentDocxFile(){
  const f = fileInput && fileInput.files && fileInput.files[0];
  if (!f) return null;
  const name = f.name || '';
  if (/^~\$/i.test(name)) throw new Error('选择的是 Word 临时锁文件（~$开头），请改选实际文档');
  if (/\.doc$/i.test(name)) throw new Error('当前不支持 .doc 格式，请先另存为 .docx');
  if (!/\.docx$/i.test(name)) throw new Error('仅支持 .docx 文件');
  return f;
}

function extractTableTextFromTbl(tblNode, wNs){
  const rows = Array.from(tblNode.getElementsByTagNameNS(wNs, 'tr'));
  return rows.map(tr => {
    const cells = Array.from(tr.getElementsByTagNameNS(wNs, 'tc'));
    return cells.map(tc => {
      const paras = Array.from(tc.childNodes)
        .filter(n => n.nodeType === 1 && n.localName === 'p')
        .map(p => getParagraphText(p, wNs).replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return paras.join('；');
    }).join(' | ');
  }).filter(line => line.trim()).join('\n');
}

function extractAllDocxTextNodes(xmlDoc, wNs){
  try {
    const textNodes = Array.from(xmlDoc.getElementsByTagNameNS(wNs, 't'));
    return normalizeMemoLayoutText(textNodes.map(n => n.textContent || '').join(''));
  } catch (e) {
    console.warn('深层文本提取失败:', e);
    return '';
  }
}

async function extractDocxFullText(file){
  try {
    if (!window.JSZip) throw new Error('JSZip 未加载');
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const entry = zip.file('word/document.xml');
    if (!entry) throw new Error('DOCX 中不存在 word/document.xml');
    const xmlText = await entry.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    const wNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const body = xmlDoc.getElementsByTagNameNS(wNs, 'body')[0];
    if (!body) throw new Error('无法读取 Word 正文');

    const linear = buildDocxLinearContent(xmlDoc, wNs);
    const directText = linear.text;
    const allText = extractAllDocxTextNodes(xmlDoc, wNs);
    if (allText && allText.length > Math.max(200, directText.length * 2)) {
      return directText && directText.length > 200 ? directText : allText;
    }
    return directText;
  } catch (err) {
    console.warn('JSZip 提取 Word 正文失败，尝试 mammoth fallback:', err);
    if (!window.mammoth || !window.mammoth.extractRawText) throw err;
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return normalizeExtractedWordText(result && result.value ? result.value : '');
  }
}

async function preprocessDocxTextWithTruncation(arrayBuffer, keyword){
  const zip = await JSZip.loadAsync(arrayBuffer);
  const entry = zip.file('word/document.xml');
  if (!entry) return { text: '', occurrences: [], first: null, cutParagraphIndex: null, forbiddenText: '' };
  const xmlText = await entry.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  const wNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const body = xmlDoc.getElementsByTagNameNS(wNs, 'body')[0];
  if (!body) return { text: '', occurrences: [], first: null, cutParagraphIndex: null, forbiddenText: '' };
  const blocks = collectDocxBlockNodes(body);
  let pageNo = 1;
  let occurrences = [];
  let paragraphs = [];
  let cutParagraphIndex = null;
  let cutOffset = null;
  let cutLineStart = null;
  const keywords = Array.isArray(keyword) ? keyword.map(k=>String(k||'').trim()).filter(Boolean) : [String(keyword||'').trim()];
  const headingRes = keywords.map(k => new RegExp('^\\s*(?:([一二三四五六七八九十百千]+|\\d+)[、\\.．\\)）]\\s*)?'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:[:：])?\\s*$'));
  const linear = buildDocxLinearContent(xmlDoc, wNs);
  let full = linear.text || '';
  let pIndex = 0;
  if (full) {
    paragraphs = full.split('\n');
    const found = findFirstSectionHeadingOffset(full, keywords);
    if (found) {
      occurrences.push({ pageNo: 1, paragraphIndex: found.paragraphIndex, lineIndex: found.lineIndex, keyword: found.keyword });
      cutParagraphIndex = found.paragraphIndex;
      cutOffset = found.offset;
    }
  } else {
    for (const block of blocks){
      const node = block.node;
      if (block.type === 'paragraph'){
        pIndex++;
        const runs = Array.from(node.getElementsByTagNameNS(wNs,'r'));
        runs.forEach(r=>{
          const lastBreak = r.getElementsByTagNameNS(wNs,'lastRenderedPageBreak');
          if (lastBreak && lastBreak.length) pageNo++;
        });
        const text = getParagraphText(node, wNs);
        const lines = String(text).split('\n');
        for (let li=0; li<lines.length; li++){
          const line = lines[li];
          let matchedIdx = -1;
          for (let hi=0; hi<headingRes.length; hi++){
            if (headingRes[hi].test(line)) { matchedIdx = hi; break; }
          }
          if (matchedIdx >= 0){
            occurrences.push({ pageNo, paragraphIndex: pIndex, lineIndex: li+1, keyword: keywords[matchedIdx] });
            if (cutParagraphIndex == null){
              cutParagraphIndex = pIndex;
              cutOffset = null;
              const prev = li > 0 ? lines.slice(0, li).join('\n') : '';
              cutLineStart = prev.length + (li > 0 ? 1 : 0);
            }
            break;
          }
        }
        paragraphs.push(text);
      }
    }
    full = normalizeMemoLayoutText(paragraphs.join('\n'));
  }
  if (occurrences.length){
    if (cutOffset == null){
      let acc = 0;
      for (let i=0; i<paragraphs.length; i++){
        if (i+1 < cutParagraphIndex){ acc += paragraphs[i].length + 1; continue; }
        let off = 0;
        if (typeof cutLineStart === 'number'){
          off = cutLineStart;
        } else {
          // Fallback: locate first keyword occurrence within the paragraph
          let idxLine = -1;
          for (const k of keywords){
            const idx = paragraphs[i].indexOf(k);
            if (idx >= 0){ idxLine = idx; break; }
          }
          off = idxLine >= 0 ? idxLine : 0;
        }
        cutOffset = acc + off;
        break;
      }
    }
    const text = full.slice(0, Math.max(0, cutOffset));
    const forbiddenText = full.slice(Math.max(0, cutOffset));
    const first = occurrences[0] || null;
    const keptTables = Array.isArray(linear.tables) ? linear.tables.filter(t => text.includes(t.token)) : [];
    return { text, occurrences, first, cutParagraphIndex, forbiddenText, tables: keptTables, tableReport: { ...(linear.report || {}), converted: keptTables.length } };
  }
  return { text: full, occurrences, first: null, cutParagraphIndex: null, forbiddenText: '', tables: linear.tables, tableReport: linear.report };
}

function validateNoLeak(rows, tableExtraction, forbiddenText, keyword){
  const keywords = Array.isArray(keyword) ? keyword.map(k=>String(k||'').trim()).filter(Boolean) : [String(keyword||'').trim()];
  const headingLines = keywords.map(k=> new RegExp(`(^|\n)\\s*(?:([一二三四五六七八九十百千]+|\\d+)[、\\.．\\)）]\\s*)?${k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?:[:：])?\\s*(?=$|\n)`));
  if (headingLines.length){
    for (const r of rows){
      const a = String(r['提取的内容']||'');
      const b = String(r['提取的内容_html']||'').replace(/<[^>]+>/g,'');
      if (headingLines.some(re=>re.test(a) || re.test(b))) throw new Error('关键词泄漏');
    }
  }
  if (forbiddenText){
    const sample = forbiddenText.slice(0, 50);
    for (const r of rows){
      const a = String(r['提取的内容']||'');
      const b = String(r['提取的内容_html']||'').replace(/<[^>]+>/g,'');
      if ((sample && a.includes(sample)) || (sample && b.includes(sample))) throw new Error('截断后内容泄漏');
    }
  }
  if (tableExtraction && Array.isArray(tableExtraction.tables)){
    for (const t of tableExtraction.tables){
      if (t && t.token && forbiddenText && forbiddenText.includes(t.token)) throw new Error('表格泄漏');
    }
  }
}

function buildHtmlTable(tblNode, wNs){
  // 读取表格边框样式（默认）
  const tblPr = tblNode.getElementsByTagNameNS(wNs, 'tblPr')[0];
  let defaultBorder = { color: '#D1D5DB', width: 1, style: 'solid' };
  if (tblPr){
    const borders = tblPr.getElementsByTagNameNS(wNs, 'tblBorders')[0];
    if (borders){
      const top = borders.getElementsByTagNameNS(wNs, 'top')[0] || borders.getElementsByTagName('w:top')[0];
      const sz = top ? Number(top.getAttribute('w:sz') || top.getAttribute('sz') || 8) : 8;
      const val = top ? (top.getAttribute('w:val') || top.getAttribute('val') || 'single') : 'single';
      const color = top ? (top.getAttribute('w:color') || top.getAttribute('color') || 'D1D5DB') : 'D1D5DB';
      defaultBorder = { color: `#${color}`, width: Math.max(1, Math.round((sz/8)*1.2)), style: (val==='dashed'?'dashed':'solid') };
    }
  }

  // 处理行/列，支持 gridSpan 与 vMerge
  const rows = Array.from(tblNode.getElementsByTagNameNS(wNs, 'tr'));
  const openRowspans = new Map(); // colIndex -> { cellObj }
  const tableRows = [];

  for (const tr of rows){
    const cells = Array.from(tr.getElementsByTagNameNS(wNs, 'tc'));
    const rowCells = [];
    let colIndex = 0;
    for (const tc of cells){
      // vMerge/gridSpan
      const tcPr = tc.getElementsByTagNameNS(wNs, 'tcPr')[0];
      const gridSpanEl = tcPr ? tcPr.getElementsByTagNameNS(wNs, 'gridSpan')[0] : null;
      const vMergeEl = tcPr ? tcPr.getElementsByTagNameNS(wNs, 'vMerge')[0] : null;
      const colspan = gridSpanEl ? Number(gridSpanEl.getAttribute('w:val') || gridSpanEl.getAttribute('val') || 1) : 1;
      const vMergeVal = vMergeEl ? (vMergeEl.getAttribute('w:val') || vMergeEl.getAttribute('val') || 'continue') : null;

      if (vMergeEl && vMergeVal !== 'restart'){
        // 继续合并：提升上一行对应单元格的 rowspan，当前列位跳过
        const opener = openRowspans.get(colIndex);
        if (opener) opener.rowspan = (opener.rowspan || 1) + 1;
        // 当前行占位推进列索引，但不输出单元格
        colIndex += colspan;
        continue;
      }

      // 文本与样式
      const innerParas = Array.from(tc.getElementsByTagNameNS(wNs, 'p'));
      const innerHtml = innerParas.map(p => renderParagraphHtml(p, wNs)).join('');
      const nestedTables = Array.from(tc.getElementsByTagNameNS(wNs, 'tbl'));
      let nestedHtml = '';
      if (nestedTables && nestedTables.length){
        nestedHtml = nestedTables.map(nt => {
          const inner = buildHtmlTable(nt, wNs);
          return `<table class="docx-table" style="border-collapse:collapse; width:100%;">${inner}</table>`;
        }).join('');
      }

      // 水平/垂直对齐
      let hClass = '';
      let vClass = '';
      if (tcPr){
        const vAlignEl = tcPr.getElementsByTagNameNS(wNs, 'vAlign')[0];
        const v = vAlignEl ? (vAlignEl.getAttribute('w:val') || vAlignEl.getAttribute('val')) : '';
        if (v === 'center') vClass = 'valign-middle';
        else if (v === 'bottom') vClass = 'valign-bottom';
      }
      // 边框（单元格级别）
      let borderStyle = '';
      if (tcPr){
        const tcBorders = tcPr.getElementsByTagNameNS(wNs, 'tcBorders')[0];
        if (tcBorders){
          const any = ['top','bottom','left','right'].map(pos => tcBorders.getElementsByTagNameNS(wNs, pos)[0]).find(Boolean);
          if (any){
            const sz = Number(any.getAttribute('w:sz') || any.getAttribute('sz') || (defaultBorder.width*8));
            const val = any.getAttribute('w:val') || any.getAttribute('val') || (defaultBorder.style==='dashed'?'dashed':'single');
            const color = any.getAttribute('w:color') || any.getAttribute('color') || defaultBorder.color.replace('#','');
            borderStyle = `border: ${Math.max(1, Math.round((sz/8)*1.2))}px ${(val==='dashed')?'dashed':'solid'} #${color};`;
          }
        }
      }

      const cellObj = {
        html: (innerHtml || nestedHtml) ? (innerHtml + nestedHtml) : '&nbsp;',
        colspan,
        rowspan: 1,
        classes: [hClass, vClass].filter(Boolean).join(' '),
        style: borderStyle || `border: ${defaultBorder.width}px ${defaultBorder.style} ${defaultBorder.color};`
      };

      // 若是 vMerge 重启，标记为开启跨行
      if (vMergeEl && (vMergeVal === 'restart' || vMergeVal === 'start')){
        openRowspans.set(colIndex, cellObj);
      } else {
        // 如果之前该列存在开启的合并，但当前不是继续，关闭它（不再新增计数）
        openRowspans.delete(colIndex);
      }

      rowCells.push(cellObj);
      colIndex += colspan;
    }
    tableRows.push(rowCells);
  }

  // 生成 HTML
  const parts = ['<tbody>'];
  for (const r of tableRows){
    parts.push('<tr>');
    for (const c of r){
      const attrs = [];
      if (c.colspan && c.colspan > 1) attrs.push(`colspan="${c.colspan}"`);
      if (c.rowspan && c.rowspan > 1) attrs.push(`rowspan="${c.rowspan}"`);
      if (c.classes) attrs.push(`class="${c.classes}"`);
      const style = c.style ? ` style="${c.style}"` : '';
      parts.push(`<td ${attrs.join(' ')}${style}>${c.html}</td>`);
    }
    parts.push('</tr>');
  }
  parts.push('</tbody>');
  return parts.join('');
}

function renderParagraphHtml(pNode, wNs){
  // 组合运行的样式（粗体/斜体/字号/对齐）
  const runs = Array.from(pNode.getElementsByTagNameNS(wNs, 'r'));
  let html = '';
  for (const r of runs){
    const texts = Array.from(r.getElementsByTagNameNS(wNs, 't')).map(t => escapeHtml(t.textContent));
    const rPr = r.getElementsByTagNameNS(wNs, 'rPr')[0];
    const bold = rPr && rPr.getElementsByTagNameNS(wNs, 'b').length;
    const italic = rPr && rPr.getElementsByTagNameNS(wNs, 'i').length;
    const szEl = rPr ? rPr.getElementsByTagNameNS(wNs, 'sz')[0] : null;
    const sz = szEl ? Number(szEl.getAttribute('w:val') || szEl.getAttribute('val') || 22) : 22; // half-points
    const fontPx = Math.round((sz/2) * 1.333); // 近似换算为 px
    let span = texts.join('');
    if (bold) span = `<strong>${span}</strong>`;
    if (italic) span = `<em>${span}</em>`;
    html += `<span style="font-size:${fontPx}px">${span}</span>`;
  }
  // 段落对齐
  const pPr = pNode.getElementsByTagNameNS(wNs, 'pPr')[0];
  const jcEl = pPr ? pPr.getElementsByTagNameNS(wNs, 'jc')[0] : null;
  const align = jcEl ? (jcEl.getAttribute('w:val') || jcEl.getAttribute('val') || '') : '';
  let cls = '';
  if (align === 'center') cls = 'align-center';
  else if (align === 'right') cls = 'align-right';
  return cls ? `<div class="${cls}">${html}</div>` : `<div>${html}</div>`;
}

function matchTablesForParagraph(tables, cleanedText, title){
  const out = [];
  const norm = s => String(s || '').replace(/[\s\u3000]+/g,'').replace(/[【】]/g,'').trim();
  const tText = norm(title || '');
  const cText = norm(cleanedText || '');
  for (const t of tables){
    const p = norm(t.precedingText || '');
    if (!p) continue;
    // 标题精确匹配或包含关系
    if ((tText && p.includes(tText)) || (cText && cText.includes(p))) {
      out.push(t);
    }
  }
  return out;
}

function renderTable(rows){
  if (!rows.length){
    tableWrap.innerHTML = '<div class="muted">暂无数据</div>';
    return;
  }
  const sortType = getCurrentSortType();
  const showDrag = sortType === 'custom';
  const selectionSet = selectionState[sortType] || new Set();
  // 展示用表头（含选择列）；导出仍使用固定列集
  const headersDisplay = showDrag ? ["拖拽","选择","编号","时间","星期几","联系人","联系电话","工作概述","提取的内容","备注"] : ["选择","编号","时间","星期几","联系人","联系电话","工作概述","提取的内容","备注"];
  const theadHtml = ['<thead><tr>', ...headersDisplay.map(h=>`<th>${h}</th>`), '</tr></thead>'].join('');
  const colSpan = headersDisplay.length;
  const tbodyRows = rows.map((r, i) => {
    if (r && r.isCategoryRow) {
      const title = String(r.categoryTitle || '').trim();
      return `<tr class="category-title-row"><td class="category-cell" colspan="${colSpan}">${escapeHtml(title)}</td></tr>`;
    }
    const checkedAttr = selectionSet.has(r.uid) ? ' checked' : '';
    return (
      `<tr data-uid="${r.uid}">
        ${showDrag ? `<td class="drag-cell"><span class="drag-handle" title="拖拽排序">≡</span></td>` : ''}
        <td><input type="checkbox" class="row-select" data-row-index="${i}" data-uid="${r.uid}"${checkedAttr} /></td>
        <td>${escapeHtml(r["编号"])}</td>
        <td>${escapeHtml(r["时间"])}</td>
        <td>${escapeHtml(r["星期几"])}</td>
        <td>${escapeHtml(r["联系人"])}</td>
        <td>${escapeHtml(r["联系电话"])}</td>
        <td>${escapeHtml(r["工作概述"])}</td>
        <td>${r["提取的内容_html"]}</td>
        <td>${escapeHtml(r["备注"])}</td>
      </tr>`
    );
  });
  const html = [`<table>${theadHtml}<tbody id="tableBody">`, ...tbodyRows, '</tbody></table>'].join('');
  tableWrap.innerHTML = html;
  // 初始化或销毁拖拽能力
  initOrDestroyDrag();
  // 绑定一次性事件代理：用户勾选变化仅更新选择状态（移除行高亮）
  if (!selectionHandlerBound) {
    tableWrap.addEventListener('change', (e) => {
      const target = e.target;
      if (target && target.classList && target.classList.contains('row-select')) {
        const uid = target.getAttribute('data-uid');
        const currentSort = getCurrentSortType();
        const set = selectionState[currentSort] || (selectionState[currentSort] = new Set());
        if (target.checked) {
          set.add(uid);
        } else {
          set.delete(uid);
        }
      }
    });
    selectionHandlerBound = true;
  }
}

function findRecordByUid(uid){
  if (!uid) return null;
  for (const r of records){
    if (r && r.uid === uid) return r;
  }
  return null;
}

// 收集当前表格中勾选行的“提取的内容”
function getSelectedContents(){
  const boxes = tableWrap.querySelectorAll('.row-select:checked');
  const list = [];
  boxes.forEach(box => {
    const uid = box.getAttribute('data-uid');
    if (uid){
      const rec = findRecordByUid(uid);
      if (rec && rec['提取的内容']) list.push(String(rec['提取的内容']));
      return;
    }
    const idx = Number(box.dataset.rowIndex || -1);
    if (idx >= 0 && idx < records.length) {
      const txt = records[idx]?.['提取的内容'];
      if (txt) list.push(String(txt));
    }
  });
  return list;
}

// 保留已选项（按uid）
function getSelectedUidsFromDom(){
  return Array.from(tableWrap.querySelectorAll('.row-select:checked')).map(el=>el.getAttribute('data-uid')).filter(Boolean);
}
function restoreSelections(uids){
  if (!uids || !uids.length) return;
  const set = new Set(uids);
  tableWrap.querySelectorAll('.row-select').forEach(box => {
    const uid = box.getAttribute('data-uid');
    if (set.has(uid)) box.checked = true;
  });
}

function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])
  );
}
// 正则安全转义（用于构造动态匹配）
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 文本宽度估算（中文按2，ASCII按1，空格按0.5），作为近似列宽依据
function measureTextWidth(str){
  const s = String(str || '');
  let w = 0;
  for (const ch of s){
    if (ch === ' ') w += 0.5;
    else if (/^[\x00-\x7F]$/.test(ch)) w += 1; // ASCII
    else w += 2; // 中文/全角
  }
  return w;
}

function autoFitColumns(worksheet, headers, data, minMap, maxMap){
  // 计算每列最大内容宽度，并设置列宽（单位为字符宽近似）
  const cols = headers.map((header, idx) => {
    const key = header;
    const values = data.map(r => String(r[key] ?? ''));
    let maxW = Math.max(measureTextWidth(header), ...values.map(measureTextWidth));
    const minW = minMap[key] ?? 8;
    const maxWCap = maxMap[key] ?? 80;
    maxW = Math.ceil(Math.min(maxWCap, Math.max(minW, maxW * 1.1))); // 略加缓冲
    return { header, key, width: maxW };
  });
  worksheet.columns = cols;
}

function estimateRowHeightByWrap(text, colWidth){
  if (!text) return undefined;
  const lines = String(text).split(/\r?\n/);
  let totalLines = 0;
  for (const line of lines){
    const w = measureTextWidth(line);
    totalLines += Math.max(1, Math.ceil(w / Math.max(1, colWidth)));
  }
  const base = 18; // 行高基准（pt）
  const height = Math.min(120, Math.max(base, totalLines * base));
  return height;
}

// 使用 ExcelJS 实现带样式的 .xlsx 导出（列宽/行高自适应）
async function exportExcel(rows, filename){
  if (!rows || rows.length === 0) {
    alert('没有数据可导出！');
    return;
  }
  if (typeof ExcelJS === 'undefined') {
    alert('Excel库未加载，无法导出');
    return;
  }
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('通知整理', {
      properties: { defaultRowHeight: 18 }
    });

    // 数据准备：剔除 HTML 列
    const exportData = rows.map(row => {
      const { "提取的内容_html": _, uid, ...cleanRow } = row;
      return cleanRow;
    });

    const headers = ["编号","时间","星期几","联系人","联系电话","工作概述","提取的内容","备注"];

    // 列宽自适应（设定每列最小/最大宽度）
    const minMap = { "编号": 6, "时间": 14, "星期几": 8, "联系人": 10, "联系电话": 14, "工作概述": 24, "提取的内容": 40, "备注": 12 };
    const maxMap = { "编号": 10, "时间": 24, "星期几": 12, "联系人": 18, "联系电话": 22, "工作概述": 42, "提取的内容": 80, "备注": 20 };
    autoFitColumns(worksheet, headers, exportData, minMap, maxMap);

    // 头部样式
    const headerRow = worksheet.getRow(1);
    headerRow.values = headers; // 显式写入表头
    headerRow.font = { name: 'Microsoft YaHei', size: 12, bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

    // 数据行 + 行高自适应（根据“提取的内容”列估算）
    const contentColIndex = headers.indexOf('提取的内容') + 1; // 列序号（1-based）
    const contentColWidth = worksheet.getColumn(contentColIndex).width || 60;

    exportData.forEach((data, idx) => {
      const rowIndex = idx + 2; // 从第二行开始写数据
      const row = worksheet.addRow(headers.map(h => data[h]));
      row.font = { name: 'Microsoft YaHei', size: 11 };
      row.alignment = { vertical: 'top', horizontal: 'left' };
      // 为“提取的内容”列开启换行
      const contentCell = worksheet.getCell(rowIndex, contentColIndex);
      contentCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };

      // 行高估算并应用
      const estimated = estimateRowHeightByWrap(data['提取的内容'], contentColWidth);
      if (estimated) row.height = estimated;
    });

    // 新增：元数据工作表
    const metaSheet = workbook.addWorksheet('元数据');
    metaSheet.columns = [{ header: '键', key: 'k', width: 20 }, { header: '值', key: 'v', width: 40 }];
    const sortType = getCurrentSortType();
    const baseName = getDocxBaseName();
    const meta = [
      { k: '排序方式', v: sortType },
      { k: '文档名', v: baseName || '' },
      { k: '导出时间', v: new Date().toLocaleString() },
      { k: '记录条数', v: String(rows.length) }
    ];
    meta.forEach(m => metaSheet.addRow([m.k, m.v]));

    // 导出文件名
    let outputName = (filename || makeAutoFilename()).trim();
    if (!outputName.toLowerCase().endsWith('.xlsx')) {
      outputName += '.xlsx';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    statusEl.textContent = `导出成功：${outputName}`;
    setTimeout(() => { statusEl.textContent = `解析完成，共 ${rows.length} 条`; }, 3000);
  } catch (error) {
    console.error('导出Excel失败:', error);
    alert('导出失败：' + (error?.message || error));
    statusEl.textContent = '导出失败';
  }
}

function applyCustomOrder(rows){
  if (!rows || !rows.length) return [];
  const uidToRow = new Map(rows.map(r => [r.uid, r]));
  const ordered = [];
  // 按自定义顺序放置已有的uid
  customOrder.forEach(uid => {
    const r = uidToRow.get(uid);
    if (r) ordered.push(r);
    uidToRow.delete(uid);
  });
  // 其余未在customOrder中的，按原顺序追加
  rows.forEach(r => { if (uidToRow.has(r.uid)) ordered.push(r); });
  return ordered;
}

function getSortedRecords() {
  const sortType = getCurrentSortType();
  setSortIndicator();
  if (sortType === 'time') {
    return sortByTime(originalRecords);
  } else if (sortType === 'custom') {
    // 加载或使用现有自定义排序
    const existingUids = originalRecords.map(r=>r.uid);
    if (!customOrder.length) customOrder = loadCustomOrder(existingUids);
    return applyCustomOrder(originalRecords);
  } else {
    return [...originalRecords];
  }
}

// 新增：在“原文档顺序”下，按分类重置“编号”列（每类从起始编号开始）
function assignCategorySequenceNumbers(rows, startNo){
  if (!Array.isArray(rows) || rows.length === 0) return;
  const sortType = getCurrentSortType();
  const topCats = Array.isArray(categoryMarkers) ? categoryMarkers.filter(c => c.level === 1) : [];
  if (sortType !== 'original' || topCats.length === 0){
    rows.forEach((record, index) => { record["编号"] = startNo + index; });
    return;
  }
  const cats = [...topCats].sort((a,b)=>a.pos - b.pos);
  let ci = 0;
  const counters = new Map();
  rows.forEach(record => {
    const pos = (typeof record.rawPos === 'number' && record.rawPos >= 0) ? record.rawPos : Number.MAX_SAFE_INTEGER;
    while (ci + 1 < cats.length && cats[ci+1].pos <= pos) ci++;
    const key = cats[ci] ? String(cats[ci].pos) : 'no_cat';
    const cur = counters.has(key) ? counters.get(key) : startNo;
    record["编号"] = cur;
    counters.set(key, cur + 1);
  });
}

function refreshTable() {
  if (originalRecords.length === 0) return;
  const sortedRecords = getSortedRecords();
  const startNo = Number($('#startIndex').value) || 1;
  assignCategorySequenceNumbers(sortedRecords, startNo);
  // 原文档顺序下插入分类标题行（仅用于展示，不影响导出与选择）
  const sortType = getCurrentSortType();
  // 在渲染前初始化该排序方式的选择状态（首次或切换时默认全选）
  initializeSelectionsForCurrentSort(sortedRecords);
  const displayRows = sortType === 'original' ? injectCategoriesForDisplay(sortedRecords) : sortedRecords;
  renderTable(displayRows);
  // 保持导出与选择针对实际内容行
  records = sortedRecords;
  lastSortType = sortType;
  exportBtn.disabled = false;
}

// 新增：初始化当前排序方式的选择状态（首次或切换时重置为全选，其他情况保留并同步）
function initializeSelectionsForCurrentSort(rows){
  const sortType = getCurrentSortType();
  const existing = selectionState[sortType] || (selectionState[sortType] = new Set());
  const prevRendered = lastRenderedUids[sortType] || (lastRenderedUids[sortType] = new Set());
  const uids = rows.map(r=>r.uid);
  // 仅在切换排序且当前集合为空时重置为全选；
  // 若用户曾通过“取消全选”清空，则保留为空状态
  if (lastSortType !== sortType && existing.size === 0){
    // 切换排序或首次进入：重置为全选
    selectionState[sortType] = new Set(uids);
    lastRenderedUids[sortType] = new Set(uids);
    return;
  }
  // 同步：移除不存在的UID；仅将“相较上次渲染新增”的UID设为选中；保留用户原有勾选（包括用户清空后的保持）
  const currentSet = new Set(uids);
  for (const uid of Array.from(existing)){
    if (!currentSet.has(uid)) existing.delete(uid);
  }
  uids.forEach(uid => {
    if (!prevRendered.has(uid)) {
      // 仅新增行默认选中
      existing.add(uid);
    }
  });
  // 更新本次渲染快照
  lastRenderedUids[sortType] = new Set(uids);
}

function initOrDestroyDrag(){
  const sortType = getCurrentSortType();
  const tbody = document.getElementById('tableBody');
  if (sortType !== 'custom'){
    if (sortableInstance && sortableInstance.destroy){
      try { sortableInstance.destroy(); } catch(e){}
    }
    sortableInstance = null;
    return;
  }
  if (!tbody) return;
  if (typeof Sortable === 'undefined') return;
  if (sortableInstance){
    try { sortableInstance.destroy(); } catch(e){}
    sortableInstance = null;
  }
  sortableInstance = new Sortable(tbody, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'drag-ghost',
    chosenClass: 'drag-chosen',
    dragoverBubble: true,
    fallbackOnBody: true,
    delayOnTouchOnly: true,
    delay: 120,
    onStart: () => {
      // 在自定义排序开始前记录当前勾选状态
      const set = selectionState['custom'] || (selectionState['custom'] = new Set());
      dragSelectionSnapshot = new Set(Array.from(set));
    },
    onEnd: () => {
      // 读取当前DOM顺序并生成customOrder
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const newOrder = rows.map(tr => tr.getAttribute('data-uid')).filter(Boolean);
      customOrder = newOrder;
      saveCustomOrder();
      // 在刷新前恢复拖拽前的勾选状态
      if (dragSelectionSnapshot) {
        selectionState['custom'] = new Set(Array.from(dragSelectionSnapshot));
        dragSelectionSnapshot = null;
      }
      // 刷新表格以重编号与保持一致
      refreshTable();
    }
  });
}

// 事件监听
fileInput.addEventListener('change', ()=>{
  parseBtn.disabled = !fileInput.files.length; // 修复：选择文件后应可解析
  exportBtn.disabled = true;
  tableWrap.innerHTML = '';
  originalWordText = '';
  if (currentDocNameEl) {
    const f = fileInput.files && fileInput.files[0];
    currentDocNameEl.textContent = f ? `当前文档：${f.name}` : '当前文档：未选择';
  }
  if (wordContentEditor && !wordContentEditor.value.trim()) {
    setWordTextStatus(fileInput.files.length ? '已选择文件，可直接提取 Word 内容。' : '可从 Word 提取，也可直接粘贴内容后生成。');
  }
  statusEl.textContent = fileInput.files.length ? '已选择文件，等待解析' : '未加载';
});

parseBtn.addEventListener('click', async ()=>{
  const f = fileInput.files[0];
  if (!f) return;

  // 仅支持.docx，针对.doc提供指引
  const name = f.name || '';
  // 过滤 Word 锁文件（~$ 开头），该类型不可解析
  if (/^~\$/i.test(name)) {
    statusEl.textContent = '选择的是 Word 临时锁文件（~$开头），请改选实际文档';
    alert('该文件是 Word 的临时锁文件，无法解析。请在 material 目录选择真实的 .docx 文档。');
    return;
  }
  if (/\.doc$/i.test(name)) {
    statusEl.textContent = '当前不支持.doc格式，请先另存为.docx后再上传';
    alert('当前不支持.doc格式，请先将文件另存为.docx再解析');
    return;
  }
  if (!/\.docx$/i.test(name)) {
    statusEl.textContent = '仅支持.docx文件';
    alert('仅支持.docx文件');
    return;
  }

  try{
    originalRecords = await parseDocx(f);
    // 加载旧的自定义排序（若存在）
    customOrder = loadCustomOrder(originalRecords.map(r=>r.uid));
    refreshTable();
    exportBtn.disabled = false;
  }catch(err){
    console.error(err);
    statusEl.textContent = '解析失败：' + (err?.message || err);
    exportBtn.disabled = true;
  }
});

exportBtn.addEventListener('click', ()=>{
  if (!records || records.length === 0) {
    alert('请先解析文档！');
    return;
  }
  const inputVal = ($('#outfile').value || '').trim();
  const name = inputVal || makeAutoFilename();
  exportExcel(records, name);
});

document.querySelectorAll('input[name="sortType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    setSortIndicator();
    refreshTable();
  });
});

// 取消全选（当前排序）：快速清空并直接反映在DOM
clearSelectBtn && clearSelectBtn.addEventListener('click', () => {
  try{
    const sortType = getCurrentSortType();
    selectionState[sortType] = new Set();
    // 同步当前表格复选框状态，无需重渲染提升响应速度
    tableWrap.querySelectorAll('.row-select').forEach(box => { box.checked = false; });
    // 无障碍提示：清空完成
    const status = document.getElementById('status');
    if (status) {
      status.setAttribute('aria-live','polite');
      status.textContent = '已取消全选';
      setTimeout(()=>{ status.textContent = `解析完成，共 ${records.length} 条`; }, 2000);
    }
  }catch(e){ console.error(e); }
});

// 结尾标点智能剥离与压缩规则
function stripTrailingPunctuation(input){
  if (input == null) return '';
  let s = String(input).replace(/\s+$/,'');
  // 先移除除省略号/破折号/点号之外的尾部标点
  s = s.replace(/[，,。．；;：:、!?！？'"”’）\)\]\}\u3001\u3002\uff0c\uff1b\uff1a\uff01\uff1f\u3009\u300b\u3011\u300f\u2019\u201d]+$/g, '');
  // 点号：1、2个点移除；3个及以上压缩为'...'
  s = s.replace(/\.{1,2}$/g, '');
  s = s.replace(/\.{3,}$/g, '...');
  // 中文省略号：单个'…'移除；两个及以上压缩为'……'
  s = s.replace(/…{1}$/g, '');
  s = s.replace(/…{2,}$/g, '……');
  // 破折号：单个'—'移除；两个及以上压缩为'——'
  s = s.replace(/—{1}$/g, '');
  s = s.replace(/—{2,}$/g, '——');
  // 仅标点则返回空
  const hasContent = /[\u4e00-\u9fffA-Za-z0-9]/.test(s);
  if (!hasContent) return '';
  return s;
}

function truncateParagraphsAtLastPeriod(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  // 以空行分段，取首个非空段落，并在该段落的最后一个句号处截断，丢弃后续段落
  const paragraphs = s.split(/\n\s*\n/);
  for (const pRaw of paragraphs) {
    const p = pRaw.trim();
    if (!p) continue;
    const idxDot = Math.max(p.lastIndexOf('。'), p.lastIndexOf('．'), p.lastIndexOf('.'));
    const idxQ   = Math.max(p.lastIndexOf('？'), p.lastIndexOf('?'));
    const idxE   = Math.max(p.lastIndexOf('！'), p.lastIndexOf('!'));
    const lastIdx = Math.max(idxDot, idxQ, idxE);
    if (lastIdx >= 0) {
      return p.slice(0, lastIdx + 1);
    }
    return p; // 首段无句末标点时，保留整段
  }
  return '';
}

function stripArabicNumberBeforeBrackets(text) {
  const s = String(text || '');
  // 移除段落或行首紧邻【之前的阿拉伯数字及常见分隔符
  return s.replace(/(^|\n)\s*\(?\d+\)?[、．\.,，：:\-—]*\s*(?=【)/g, '$1');
}

// 仅保留以【】为起始的段落及其后文本，删除“相关表格：”提示并去除重复【】行
function keepBracketSectionAndDedup(input) {
  let s = String(input || '').replace(/\r/g, '');
  const m = s.match(/(^|\n)\s*【[^】]+】/);
  if (!m) return s;
  const start = m.index + (m[0].startsWith('\n') ? 1 : 0);
  let out = s.slice(start);
  // 去除独立的“相关表格：”提示行
  out = out.replace(/(^|\n)\s*相关表格：\s*(?=\n|$)/g, '$1');
  // 去重：若后续再次出现相同的【...】标题行，保留首个，移除其余
  const head = (out.match(/^\s*【[^】]+】/m) || [])[0];
  if (head) {
    const pat = new RegExp(`(^|\\n)\\s*${escapeRegExp(head)}\\s*(?=\\n|$)`, 'g');
    let first = true;
    out = out.replace(pat, (match, p1) => {
      if (first) { first = false; return p1 ? p1 : ''; }
      return p1 ? p1 : '';
    });
  }
  return out;
}

// 新增：删除“联系人”到首个中文句号的处理
function removeContactClauses(input) {
  const text = String(input || "");
  // 精确删除以“联系人:”或“联系人：”开头，到首个中文句号“。”为止的片段（非贪婪），跨行匹配
  const cleaned = text.replace(/联系人[:：][\s\S]*?。/g, "");
  return cleaned;
}

copyResultTextBtn && copyResultTextBtn.addEventListener('click', async () => {
  try {
    const output = document.getElementById('finalNoticeOutput');
    const status = document.getElementById('copyStatus');
    const text = output ? sanitizeGeneratedNoticeText(output.innerText || output.textContent || '').trim() : '';
    if (!text) {
      if (status) status.textContent = '暂无可复制的结果';
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = '复制成功（文本）';
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-10000px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (status) status.textContent = '复制成功（文本）';
  } catch (e) {
    const status = document.getElementById('copyStatus');
    if (status) status.textContent = '复制失败：' + (e?.message || e);
  }
});

// 新增：提取原文中的分类标题及其索引位置
// 删除宽松版提取逻辑，使用严格版识别规则（见下方唯一实现）

// 新增：按分类重排【】内数字（每个分类从1开始），保持【】结构不变
function renumberBracketsByCategory(text){
  const s = String(text || '');
  // 找出所有分类起始位置
  const cats = extractCategoryLines(s);
  if (cats.length === 0) return s; // 无分类则不处理
  // 形成分段：每个分类到下一个分类之前
  const segments = [];
  for (let i=0; i<cats.length; i++){
    const start = cats[i].pos;
    const end = (i+1 < cats.length) ? cats[i+1].pos : s.length;
    segments.push({ start, end });
  }
  // 构造新文本：非分类区域原样保留，分类区域内对【数字】重排
  let out = '';
  let cursor = 0;
  for (const seg of segments){
    // 追加分类前的非分类区域
    if (cursor < seg.start) out += s.slice(cursor, seg.start);
    const chunk = s.slice(seg.start, seg.end);
    let counter = 1;
    const replaced = chunk.replace(BRACKET_NUMBER_RE, (m, p1, p2) => `【${p1}${counter++}${p2}】`);
    out += replaced;
    cursor = seg.end;
  }
  if (cursor < s.length) out += s.slice(cursor);
  return out;
}

// 新增：提取原文中的分类标题及其索引位置
function extractCategoryLines(text){
  const s = String(text || '');
  const markers = [];
  let m;
  while ((m = CATEGORY_LINE_RE.exec(s)) !== null) {
    const rawTitle = (m[3] || '').trim();
    const title = stripTrailingPunctuation(rawTitle);
    const pos = m.index + (m[1] ? m[1].length : 0);
    if (title) markers.push({ title, pos });
  }
  // 去重并按位置排序
  const uniq = [];
  const seen = new Set();
  markers.sort((a,b)=>a.pos-b.pos).forEach(x=>{
    const key = `${x.pos}|${x.title}`;
    if (!seen.has(key)) { seen.add(key); uniq.push(x); }
  });
  return uniq;
}

// 新增：将分类标题行按原文位置插入到展示行中（不影响records与导出）
function injectCategoriesForDisplay(rows){
  try{
    if (!Array.isArray(rows) || rows.length === 0) return rows;
    if (!Array.isArray(categoryMarkers) || categoryMarkers.length === 0) return rows;
    const cats = [...categoryMarkers].sort((a,b)=>a.pos - b.pos);
    const out = [];
    let ci = 0;
    for (let i=0; i<rows.length; i++){
      const r = rows[i];
      const p = (typeof r.rawPos === 'number' && r.rawPos >= 0) ? r.rawPos : Number.MAX_SAFE_INTEGER;
      while (ci < cats.length && cats[ci].pos <= p){
        const c = cats[ci++];
        out.push({ isCategoryRow: true, categoryTitle: c.title, uid: `cat_${ci}_${c.pos}` });
      }
      out.push(r);
    }
    while (ci < cats.length){
      const c = cats[ci++];
      out.push({ isCategoryRow: true, categoryTitle: c.title, uid: `cat_${ci}_${c.pos}` });
    }
    return out;
  }catch(e){
    console.warn('插入分类行失败:', e);
    return rows;
  }
}

function getPromptTemplates(){
  return [
    {
      id: 'studentNotice',
      name: '模板1：面向学生通知',
      prompt: `请根据我筛选后的学工备忘内容，生成一份可直接发送给学生的通知。要求：
- 只保留学生需要知道、需要参加、需要报名、需要提交、需要办理的事项。
- 删除仅面向院系、辅导员、行政内部的工作要求。
- 将“请各院系通知学生”改写为直接面向学生的表达。
- 保留时间、地点、对象、报名/提交方式、链接、材料要求。
- 联系人和电话按页面选择决定是否保留。
- 不虚构原文没有的信息。
- 信息不明确时标注“未明确”。
- 输出清晰，适合直接复制到班级群。`
    },
    {
      id: 'counselorTodo',
      name: '模板2：辅导员待办清单',
      prompt: `请根据我筛选后的学工备忘内容，生成辅导员内部待办清单。要求：
- 提取需要辅导员执行、转发、统计、审核、提交、提醒、组织的事项。
- 按截止时间优先排序。
- 每条包含：事项、对象、截止时间、具体动作、提交方式/链接、联系人、备注。
- 时间不明确时标注“未明确”。
- 不要写成面向学生的通知口吻。`
    },
    {
      id: 'studentTimeline',
      name: '模板3：学生事务时间线',
      prompt: `请根据我筛选后的学工备忘内容，提取学生相关事务时间线。要求：
- 按日期和时间顺序排列。
- 每条包含：时间、事项、对象、地点/方式、材料/链接、注意事项。
- 无明确时间的事项放到最后“时间未明确”部分。
- 删除纯内部行政说明。`
    },
    {
      id: 'applicationOnly',
      name: '模板4：报名/提交事项',
      prompt: `请根据我筛选后的学工备忘内容，只提取需要主动操作的事项。要求：
- 只保留报名、申请、材料提交、信息填报、预约、领取、考试确认、准考证打印等事项。
- 每条包含：操作事项、适用对象、截止时间、操作方式/链接、材料要求、联系人。
- 删除一般宣传、背景介绍和内部工作说明。`
    },
    {
      id: 'custom',
      name: '模板5：自定义处理',
      prompt: '请完全按照我输入的个性化要求处理筛选后的内容。必须严格依据原文，不得虚构信息；缺失信息标注“未明确”；保留关键时间、地点、对象、链接和材料要求。'
    }
  ];
}

function getSavedPromptKey(templateId){
  return `word_filtered_prompt_${templateId || 'studentNotice'}`;
}

function setWordTextStatus(message, type){
  if (!wordTextStatus) return;
  wordTextStatus.textContent = message || '';
  wordTextStatus.className = type ? `muted ${type}` : 'muted';
}

function scrollToResultOutput(){
  const target = document.querySelector('.result-card') || finalNoticeOutput;
  if (target && target.scrollIntoView) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function initWorkflowTabs(){
  const tabs = Array.from(document.querySelectorAll('.tab-btn[data-tab]'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));
  if (!tabs.length || !panels.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      panels.forEach(panel => panel.classList.toggle('active', panel.id === id));
      if (activeModeStatus) {
        activeModeStatus.textContent = id === 'tableWorkflow'
          ? '当前模式：表格选择生成'
          : '当前模式：内容筛选生成';
      }
    });
  });
}

function updateWordContentStats(){
  if (!wordContentEditor || !wordContentStats) return;
  const len = (wordContentEditor.value || '').trim().length;
  wordContentStats.textContent = `当前约 ${len} 字`;
  wordContentStats.className = len > 60000 ? 'muted error' : (len > 30000 ? 'muted error' : 'muted');
  if (len > 60000) {
    wordContentStats.textContent += '，超过 60000 字，请继续筛选';
  } else if (len > 30000) {
    wordContentStats.textContent += '，建议先删除无关部分';
  }
}

function initPromptTemplates(){
  if (!promptTemplateSelect || !counselorPromptInput) return;
  const templates = getPromptTemplates();
  promptTemplateSelect.innerHTML = templates.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
  function loadPrompt(){
    const selected = templates.find(t => t.id === promptTemplateSelect.value) || templates[0];
    const saved = localStorage.getItem(getSavedPromptKey(selected.id));
    counselorPromptInput.value = saved || selected.prompt;
  }
  promptTemplateSelect.addEventListener('change', loadPrompt);
  loadPrompt();
}

function getFilterKeywords(filterType){
  const map = {
    student: ['学生','同学','报名','参加','提交','申请','领取','办理','填写','考试','讲座','培训','活动','会议','试穿','预约','准考证','宣讲会','就业','选调生','国考','心理委员','家庭经济困难','奖学金','爱心物资'],
    counselor: ['请各院系','请各单位','通知','统计','审核','提交','发送至','纸质版','电子版','汇总表','填报','归档','督促','组织','提醒','学工首要负责人','辅导员'],
    application: ['报名','申请','提交','填写','填报','发送','材料','表单','问卷','预约','领取','缴费','确认','审核','归档','准考证'],
    employment: ['就业','生涯','选调生','国考','宣讲会','招聘','基层就业','毕业生','档案','求职','公务员','招录','笔试'],
    scholarship: ['奖学金','奖助','资助','家庭经济困难','爱心物资','西服','申领','助学','困难学生']
  };
  return map[filterType] || [];
}

function getStudentFilterModel(){
  const cfg = window.APP_CONFIG || {};
  return String(cfg.studentFilterModel || 'gpt-5.4-mini').trim();
}

function setWordFilterButtonsDisabled(disabled, activeType){
  document.querySelectorAll('[data-word-filter]').forEach(btn => {
    if (!btn) return;
    const isActive = activeType && btn.getAttribute('data-word-filter') === activeType;
    if (disabled && isActive && !btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent || '';
      btn.textContent = 'AI筛选中...';
    }
    if (!disabled && btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
    btn.disabled = disabled;
  });
}

function splitWordTextBlocks(text){
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const boundaryRe = /^\s*(?:[一二三四五六七八九十百千]+、|\d+[、\.．\)）]|（\s*\d+\s*）|\(\s*\d+\s*\))/;
  const blocks = [];
  let current = [];
  for (const line of lines){
    if (boundaryRe.test(line) && current.join('\n').trim()){
      blocks.push(current.join('\n').trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  const tail = current.join('\n').trim();
  if (tail) blocks.push(tail);
  return blocks.length ? blocks : (String(text || '').trim() ? [String(text).trim()] : []);
}

function chunkStudentFilterBlocks(blocks, maxChars = 12000){
  const chunks = [];
  let current = [];
  let size = 0;
  blocks.forEach((text, index) => {
    const item = { id: index + 1, text };
    const itemSize = String(text || '').length + 80;
    if (current.length && size + itemSize > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += itemSize;
  });
  if (current.length) chunks.push(current);
  return chunks;
}

function buildStudentFilterPrompt(items){
  return `请判断以下学工备忘条目是否应保留为“学生事项”。

判定标准：
1. 保留：学生、毕业生、研究生、本科生、同学、全校师生等是最终参与对象或受益对象。
2. 保留：学生需要报名、申请、提交材料、填报信息、预约、领取、参加、考试确认、作品投稿、设计征集、宣讲会/招聘会参与等。
3. 保留：即使文字写成“请各院系通知/组织/汇总/以院系为单位提交”，只要最终事项是学生参与、学生提交或面向学生/师生征集，也应保留。
4. 不保留：仅要求院系、副书记、辅导员、老师、党委、行政人员执行的内部事项。
5. 不保留：辅导员培训、老师培训、工作群通知、院系报送工作进展、统计审核归档、纯内部提醒。
6. 不保留：“本周无备忘”“暂无备忘”等无具体事项内容。

只输出合法 JSON 数组，不要输出解释、Markdown 或额外文字。数组中每项格式固定为：
{"id": 1, "keep": true}

待判断条目：
${JSON.stringify(items, null, 2)}`;
}

function extractJsonTextFromModel(content){
  let s = String(content || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const firstArray = s.indexOf('[');
  const lastArray = s.lastIndexOf(']');
  if (firstArray >= 0 && lastArray > firstArray) {
    return s.slice(firstArray, lastArray + 1);
  }
  const firstObject = s.indexOf('{');
  const lastObject = s.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    return s.slice(firstObject, lastObject + 1);
  }
  return s;
}

function normalizeAiBoolean(value){
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const s = String(value || '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1', '是', '保留', '学生事项'].includes(s)) return true;
  if (['false', 'no', 'n', '0', '不是', '否', '不保留', '非学生事项'].includes(s)) return false;
  return null;
}

function parseStudentFilterDecisions(content){
  const jsonText = extractJsonTextFromModel(content);
  const parsed = JSON.parse(jsonText);
  const arr = Array.isArray(parsed)
    ? parsed
    : (parsed.results || parsed.items || parsed.decisions || parsed.data || []);
  if (!Array.isArray(arr)) throw new Error('模型返回的分类结果不是数组');
  const decisions = new Map();
  arr.forEach(item => {
    const id = Number(item.id ?? item.index ?? item.no ?? item.编号);
    const keep = normalizeAiBoolean(item.keep ?? item.isStudentItem ?? item.student ?? item.保留 ?? item.是否学生事项);
    if (Number.isFinite(id) && keep !== null) decisions.set(id, keep);
  });
  return decisions;
}

async function filterStudentBlocksWithAi(blocks){
  const chunks = chunkStudentFilterBlocks(blocks);
  const finalDecisions = new Map();
  const model = getStudentFilterModel();
  for (let i = 0; i < chunks.length; i++) {
    setWordTextStatus(`AI 正在判断学生事项（${i + 1}/${chunks.length} 批）...`);
    const result = await callChatCompletion(buildStudentFilterPrompt(chunks[i]), {
      model,
      temperature: 0,
      timeout: 120000
    });
    const decisions = parseStudentFilterDecisions(result);
    for (const item of chunks[i]) {
      if (!decisions.has(item.id)) {
        throw new Error(`模型结果缺少第 ${item.id} 个条目的判断，请重试`);
      }
      finalDecisions.set(item.id, decisions.get(item.id));
    }
  }
  return blocks.filter((_, index) => finalDecisions.get(index + 1));
}

function removeSectionByHeading(text, startTitle, endTitle){
  const s = String(text || '');
  const startRe = new RegExp(`(^|\\n)\\s*(?:[一二三四五六七八九十百千]+、|\\d+[、\\.．\\)）])?\\s*${escapeRegExp(startTitle)}\\s*(?=\\n|$)`);
  const start = s.search(startRe);
  if (start < 0) return null;
  let end = s.length;
  if (endTitle) {
    const rest = s.slice(start + 1);
    const endRe = new RegExp(`(^|\\n)\\s*(?:[一二三四五六七八九十百千]+、|\\d+[、\\.．\\)）])?\\s*${escapeRegExp(endTitle)}\\s*(?=\\n|$)`);
    const m = rest.search(endRe);
    if (m >= 0) end = start + 1 + m;
  }
  return normalizeExtractedWordText(s.slice(0, start) + '\n\n' + s.slice(end));
}

async function applyWordTextFilter(filterType){
  if (!wordContentEditor) return;
  const current = wordContentEditor.value || '';
  if (filterType === 'restore') {
    if (!originalWordText) {
      setWordTextStatus('暂无可恢复的原文。', 'error');
      return;
    }
    wordContentEditor.value = originalWordText;
    updateWordContentStats();
    setWordTextStatus(`已恢复原文，约 ${originalWordText.length} 字。`, 'success');
    return;
  }

  if (!current.trim()) {
    setWordTextStatus('请先提取 Word 内容，或直接粘贴需要处理的内容。', 'error');
    return;
  }

  if (filterType === 'removeMaterials') {
    const next = removeSectionByHeading(current, '发放材料', null);
    if (!next || next === normalizeExtractedWordText(current)) {
      setWordTextStatus('未找到“发放材料”。', 'error');
      return;
    }
    wordContentEditor.value = next;
    updateWordContentStats();
    setWordTextStatus(`已删除“发放材料”及之后内容，当前约 ${next.length} 字。`, 'success');
    return;
  }

  if (filterType === 'removeReminders') {
    const next = removeSectionByHeading(current, '工作提醒', '发放材料');
    if (!next || next === normalizeExtractedWordText(current)) {
      setWordTextStatus('未找到“工作提醒”。', 'error');
      return;
    }
    wordContentEditor.value = next;
    updateWordContentStats();
    setWordTextStatus(`已删除“工作提醒”相关内容，当前约 ${next.length} 字。`, 'success');
    return;
  }

  if (filterType === 'student') {
    if (!isApiConfigured()) {
      setWordTextStatus('学生事项 AI 筛选需要先配置 js/config.js 中的 baseUrl、apiKey、model。', 'error');
      return;
    }
    const blocks = splitWordTextBlocks(current);
    if (!blocks.length) {
      setWordTextStatus('未找到可筛选的条目块', 'error');
      return;
    }
    try {
      setWordFilterButtonsDisabled(true, filterType);
      const kept = await filterStudentBlocksWithAi(blocks);
      if (!kept.length) {
        setWordTextStatus('AI 未筛选到学生事项', 'error');
        return;
      }
      const next = normalizeExtractedWordText(kept.join('\n\n'));
      wordContentEditor.value = next;
      updateWordContentStats();
      setWordTextStatus(`AI 已筛选学生事项：${blocks.length} 个条目块中保留 ${kept.length} 个，当前约 ${next.length} 字。`, 'success');
    } catch (e) {
      console.error('学生事项 AI 筛选失败:', e);
      setWordTextStatus('学生事项 AI 筛选失败：' + (e?.message || e), 'error');
      alert('学生事项 AI 筛选失败：' + (e?.message || e));
    } finally {
      setWordFilterButtonsDisabled(false, filterType);
    }
    return;
  }

  const keywords = getFilterKeywords(filterType);
  const blocks = splitWordTextBlocks(current);
  const kept = blocks.filter(block => keywords.some(k => block.includes(k)));
  if (!kept.length) {
    setWordTextStatus('未筛选到匹配内容', 'error');
    return;
  }
  const next = normalizeExtractedWordText(kept.join('\n\n'));
  wordContentEditor.value = next;
  updateWordContentStats();
  setWordTextStatus(`已筛选：${blocks.length} 个条目块中保留 ${kept.length} 个，当前约 ${next.length} 字。`, 'success');
}

function buildFilteredGenerationPrompt({ filteredText, userPrompt, header, footer, contactMode, itemCount, retryMissingIds }){
  const itemRules = itemCount
    ? `
逐条改写规则：
1. “筛选后的原文内容”已经完成筛选，里面的 ${itemCount} 个 [ITEM_n] 都视为必须保留的白名单事项。
2. 你的任务是逐条改写为学生可读备忘，不得再次筛选，不得擅自删除、跳过或合并任何 [ITEM_n]。
3. 输出中必须保留每个 [ITEM_n] 标记，且每个标记只能出现一次；标记应放在对应事项正文前。前端会在展示前把这些内部标记转换为 1.、2.、3. 编号。
4. 即使条目看起来包含院系、辅导员、领取整改单、反馈、审核、汇总等内部动作，只要学生需要知道、配合、签字、整改、参加、报名、提交、领取、关注后果或存在宿舍管理/违规/警示/退宿风险，都必须改写并保留。
5. 面向全校师生、学生、毕业生、相关同学的征集、活动、报名、讲座、检查通报、整改提醒均必须保留。
6. 对内部动作可改写为学生视角，例如“相关同学需配合院系完成整改签字和反馈”，不要因此删除整条。
7. 每个 [ITEM_n] 必须独立成段，不要把多个事项写成一个连续段落。`
    : '';
  const retryRule = Array.isArray(retryMissingIds) && retryMissingIds.length
    ? `
重要纠错：上一次生成遗漏了 ${retryMissingIds.map(id => `[${id}]`).join('、')}。本次必须重新生成完整备忘，覆盖全部 ${itemCount || ''} 个 [ITEM_n]，不要只补充遗漏项。`
    : '';
  return `你是高校学工备忘处理助手。请严格依据“筛选后的原文内容”和“辅导员处理要求”生成结果。

硬性规则：
1. 不得虚构原文没有的信息。
2. 不确定的信息标注“未明确”。
3. 保留重要时间、地点、对象、链接、材料要求。
4. 如果 contactMode=remove，删除联系人和联系电话。
5. 如果用户填写了开头和结尾，请自然合并，不要重复。
6. 输出应适合直接复制使用。
7. 不要解释你的处理过程，只输出最终结果。
8. 只输出纯文本，不使用 Markdown、HTML 或富文本标记。
9. 禁止输出 **加粗**、# 标题、- 列表、代码块、Markdown 链接等语法。
10. 不要输出“通知开头：”“通知结尾：”“辅导员处理要求：”等字段名；开头和结尾只保留其正文内容。
${itemRules}
${retryRule}

contactMode=${contactMode || 'keep'}

辅导员处理要求：
${userPrompt || ''}

通知开头：
${header || ''}

通知结尾：
${footer || ''}

===== 筛选后的原文内容开始 =====
${filteredText || ''}
===== 筛选后的原文内容结束 =====`;
}

async function callChatCompletion(prompt, options){
  const cfg = window.APP_CONFIG || {};
  const baseUrl = String(options?.baseUrl || cfg.baseUrl || '').replace(/\/$/, '');
  const apiKey = String(options?.apiKey || cfg.apiKey || '');
  const model = String(options?.model || cfg.model || '');
  const temperature = typeof options?.temperature === 'number'
    ? options.temperature
    : (typeof cfg.temperature === 'number' ? cfg.temperature : 0.5);
  if (!baseUrl || !apiKey || !model) {
    throw new Error('转换服务未配置：请在 js/config.js 中填写 baseUrl、apiKey、model');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options?.timeout || 120000);
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是高校学工备忘处理助手，严格依据用户提供的原文内容生成结果。' },
          { role: 'user', content: String(prompt || '') }
        ],
        temperature
      }),
      signal: controller.signal
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`服务错误(${resp.status})：${errText || '请稍后重试'}`);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('转换结果为空或格式异常');
    return content;
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('请求超时，请检查网络或稍后重试');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildMissingItemsSupplementPrompt({ missingItems, userPrompt, contactMode }){
  return `你是高校学工备忘处理助手。上一版备忘遗漏了部分已经筛选通过的事项。请只根据下面缺失的原文条目补写学生可读备忘。

要求：
1. 缺失条目全部必须输出，不得删除、跳过或合并。
2. 每条输出前必须保留对应 [ITEM_n] 标记，且标记只能出现一次；每个 [ITEM_n] 独立成段。
3. 不要写通知开头和结尾，不要解释原因。
4. 只输出纯文本，不使用 Markdown、HTML、**加粗**、# 标题、- 列表或代码块。
5. 如果 contactMode=remove，删除联系人和联系电话。
6. 即使条目包含院系、辅导员、整改、反馈、审核、汇总等内部动作，只要学生需要知道、配合、签字、整改、参加、报名、提交、关注后果或存在宿舍管理/违规/警示/退宿风险，都必须保留并改写为学生视角。

contactMode=${contactMode || 'keep'}

辅导员处理要求：
${userPrompt || ''}

===== 缺失原文条目开始 =====
${formatGenerationItemsForPrompt(missingItems || [])}
===== 缺失原文条目结束 =====`;
}

async function generateFilteredNoticeWithCoverage({ filteredText, userPrompt, header, footer, contactMode }){
  const items = buildGenerationItemsFromFilteredText(filteredText);
  const itemizedText = items.length ? formatGenerationItemsForPrompt(items) : filteredText;
  const baseArgs = {
    filteredText: itemizedText,
    userPrompt,
    header,
    footer,
    contactMode,
    itemCount: items.length
  };

  let result = await callChatCompletion(buildFilteredGenerationPrompt(baseArgs));
  let missingIds = getMissingGeneratedItemIds(result, items);

  if (missingIds.length) {
    setWordTextStatus(`AI 遗漏 ${missingIds.length} 个筛选条目，正在重新生成完整备忘...`);
    result = await callChatCompletion(buildFilteredGenerationPrompt({
      ...baseArgs,
      retryMissingIds: missingIds
    }));
    missingIds = getMissingGeneratedItemIds(result, items);
  }

  if (missingIds.length) {
    setWordTextStatus(`AI 仍遗漏 ${missingIds.length} 个筛选条目，正在补写遗漏事项...`);
    const missingItems = items.filter(item => missingIds.includes(item.id));
    const supplement = await callChatCompletion(buildMissingItemsSupplementPrompt({
      missingItems,
      userPrompt,
      contactMode
    }));
    result = `${result}\n\n${supplement}`;
  }

  return sanitizeGeneratedNoticeText(stripInternalItemMarkers(result));
}

async function onExtractWordTextClick(){
  try {
    const f = getCurrentDocxFile();
    if (!f) {
      setWordTextStatus('请先选择 Word 文档，或直接在文本框粘贴需要处理的内容。', 'error');
      return;
    }
    if (extractWordTextBtn) {
      extractWordTextBtn.disabled = true;
      extractWordTextBtn.textContent = '提取中…';
    }
    setWordTextStatus('正在提取 Word 正文和表格文本…');
    const text = await extractDocxFullText(f);
    if (!text) throw new Error('未提取到可用文本');
    originalWordText = text;
    if (wordContentEditor) wordContentEditor.value = text;
    updateWordContentStats();
    setWordTextStatus(`提取完成，约 ${text.length} 字。请先筛选后再生成。`, 'success');
  } catch (e) {
    console.error(e);
    setWordTextStatus('提取失败：' + (e?.message || e), 'error');
    alert('提取 Word 内容失败：' + (e?.message || e));
  } finally {
    if (extractWordTextBtn) {
      extractWordTextBtn.disabled = false;
      extractWordTextBtn.textContent = '提取 Word 内容';
    }
  }
}

async function onGenerateFromFilteredTextClick(){
  const btn = generateFromFilteredTextBtn;
  const output = finalNoticeOutput;
  try {
    const rawText = wordContentEditor ? wordContentEditor.value.trim() : '';
    if (!rawText) {
      alert('请先提取 Word 内容，或直接粘贴需要处理的内容。');
      setWordTextStatus('请先提取 Word 内容，或直接粘贴需要处理的内容。', 'error');
      return;
    }

    let filteredText = rawText;
    if (filteredText.length > 60000) {
      alert(`当前筛选内容约 ${filteredText.length} 字，超过 60000 字符。将只发送前 60000 字符，请继续筛选以获得更准确结果。`);
      filteredText = filteredText.slice(0, 60000);
      setWordTextStatus('内容超过 60000 字符，本次只发送前 60000 字符。', 'error');
    } else if (filteredText.length > 30000) {
      alert(`当前筛选内容约 ${filteredText.length} 字，建议先删除无关部分后再生成。`);
      setWordTextStatus(`当前筛选内容约 ${filteredText.length} 字，建议继续筛选。`);
    }

    const userPrompt = counselorPromptInput ? counselorPromptInput.value.trim() : '';
    const header = noticeHeader ? noticeHeader.value.trim() : '';
    const footer = noticeFooter ? noticeFooter.value.trim() : '';
    const contactMode = document.querySelector('input[name="contactMode"]:checked')?.value || 'keep';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '生成中…';
    }
    if (output) output.textContent = '生成中…请稍候';
    setWordTextStatus('正在逐条改写筛选区内容，生成前会检查是否漏项…');

    const result = await generateFilteredNoticeWithCoverage({ filteredText, userPrompt, header, footer, contactMode });
    setGeneratedPlainTextOutput(output, result);
    setWordTextStatus('生成完成。发送给 AI 的内容来自筛选区文本。', 'success');
    scrollToResultOutput();
  } catch (e) {
    console.error('筛选文本生成失败:', e);
    const msg = e?.message || e;
    alert('根据筛选内容生成备忘失败：' + msg);
    if (output) output.textContent = '生成失败：' + msg;
    setWordTextStatus('生成失败：' + msg, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '根据筛选内容生成备忘';
    }
  }
}

function initFilteredWordTextFeature(){
  initWorkflowTabs();
  initPromptTemplates();
  updateWordContentStats();
  if (wordContentEditor) wordContentEditor.addEventListener('input', updateWordContentStats);
  if (extractWordTextBtn) extractWordTextBtn.addEventListener('click', onExtractWordTextClick);
  document.querySelectorAll('[data-word-filter]').forEach(btn => {
    btn.addEventListener('click', () => applyWordTextFilter(btn.getAttribute('data-word-filter')));
  });
  if (savePromptBtn) {
    savePromptBtn.addEventListener('click', () => {
      const id = promptTemplateSelect ? promptTemplateSelect.value : 'studentNotice';
      localStorage.setItem(getSavedPromptKey(id), counselorPromptInput ? counselorPromptInput.value : '');
      setWordTextStatus('当前提示词已保存。', 'success');
    });
  }
  if (resetPromptBtn) {
    resetPromptBtn.addEventListener('click', () => {
      const templates = getPromptTemplates();
      const id = promptTemplateSelect ? promptTemplateSelect.value : 'studentNotice';
      const template = templates.find(t => t.id === id) || templates[0];
      localStorage.removeItem(getSavedPromptKey(id));
      if (counselorPromptInput) counselorPromptInput.value = template.prompt;
      setWordTextStatus('已恢复默认提示词。', 'success');
    });
  }
  if (generateFromFilteredTextBtn) {
    generateFromFilteredTextBtn.disabled = !isApiConfigured();
    generateFromFilteredTextBtn.title = isApiConfigured() ? '根据筛选区文本生成备忘' : '请配置 js/config.js 中的 API 信息后使用';
    generateFromFilteredTextBtn.addEventListener('click', onGenerateFromFilteredTextClick);
  }
}

initFilteredWordTextFeature();


// 生成通知按钮逻辑
// 新增：面向学生通知生成（调用后端 Python API）
async function studentNoticeGenerator(currentText, tableMap){
  const output = document.getElementById('finalNoticeOutput');
  const btn = document.getElementById('generateNoticeBtn');
  if (!output) return;
  // 前端直接调用远程 OpenAI 兼容接口（无需本地后端）
  const cfg = window.APP_CONFIG || {};
  const baseUrl = String(cfg.baseUrl || '').replace(/\/$/, '');
  const apiKey = String(cfg.apiKey || '');
  const model = String(cfg.model || '');
  const temperature = typeof cfg.temperature === 'number' ? cfg.temperature : 0.5;
  if (!baseUrl || !apiKey || !model){
    alert('转换服务未配置：请在 js/config.js 中填写 baseUrl、apiKey、model');
    output.textContent = '未配置转换服务';
    return;
  }
  const API_URL = `${baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s 超时

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = '生成中…';
    }
    output.textContent = '转换中…请稍候';

    // 复用后端的提示词规范 + 表格占位符说明
    const prompt = `请将以下内部的工作备忘通知文本转化为面向学生的通知，具体要求如下：\n
    第一步：删除面向院系的相关内容，只保留面向学生的部分。\n
    示例：【面向院系的相关内容】如：”院系学工首要负责人及学研工组长可以登录BI数据平台，实时查询本院系学生参保情况。“  
    如：”请相关院系于11月28日（周五）17:00前领取整改单，由学生、辅导员、学工首要负责人签字盖章“，需要删除。
    【面向学生的部分】如：“请各院系通知新任心理委员参加”、”请院系通知符合条件的学生“
    第二步：将面向学生的部分，通知对象改为学生，注意：不是简单的将主语宾语改为：各位同学”\n
1. 格式保留：尽量保留原文的标点和段落结构\n
2. 符号保留：尽量保留符号不变\n
3. 内容调整：只改变与口吻转化相关的部分，其他信息保持不变，不需要添加开头问候语\n
4. 语气调整：保留原文本语言风格\n
5. 重要：文本中可能包含形如 <!--TABLE_PLACEHOLDER_1--> 的占位符，它们代表原文中的表格位置。请务必原样保留这些占位符，不要移动、删除或修改，以便后续还原表格。\n
6. 格式要求：只输出纯文本，不使用 Markdown、HTML 或富文本标记。禁止输出 **加粗**、# 标题、- 列表、代码块、Markdown 链接等语法。\n
7. 不要输出“通知开头：”“通知结尾：”等字段名；如原文包含开头或结尾内容，请自然保留正文。\n
\n请转化以下文本：\n${String(currentText || '')}`;

    const payload = {
      model,
      messages: [
        { role: 'system', content: '你是一个文本改写助手，请根据指令进行口吻转换，严格保留段落结构与符号，并保留 <!--TABLE_PLACEHOLDER_n--> 占位符不变。输出必须为可直接复制使用的纯文本，不要使用 Markdown。' },
        { role: 'user', content: prompt }
      ],
      temperature,
    };

    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text().catch(()=> '');
      throw new Error(`服务错误(${resp.status})：${errText || '请稍后重试'}`);
    }
    const data = await resp.json();
    let result = data?.choices?.[0]?.message?.content || data?.result || data?.message || '';
    if (!result) {
      throw new Error('转换结果为空或格式异常');
    }
    result = sanitizeGeneratedNoticeText(result);
    // 若包含表格占位符，则按占位符顺序还原表格 HTML
    let hasTables = Array.isArray(tableMap) && tableMap.length > 0;
    if (hasTables) {
      const placeholderRe = /<!--TABLE_PLACEHOLDER_(\d+)-->/g;
      let replacedCount = 0;
      result = result.replace(placeholderRe, (full, n) => {
        const idx = Number(n) - 1;
        const html = tableMap[idx];
        if (!html) {
          console.warn('占位符无对应表格：', full);
          return full; // 保留占位符，供后续人工处理
        }
        replacedCount++;
        return html;
      });
      // 完整性检查
      const expected = tableMap.length;
      if (replacedCount !== expected) {
        console.warn(`表格还原数量不一致：期望 ${expected}，实际 ${replacedCount}`);
        alert(`注意：有 ${expected - replacedCount} 个表格未能自动还原，占位符已保留，可手动修复。`);
      }
      // 输出含表格 HTML；表格外文本已在上方清洗为纯文本
      output.innerHTML = result;
    } else {
      // 无表格时保持纯文本展示，不渲染 Markdown 或 HTML
      setGeneratedPlainTextOutput(output, result);
    }
    // 生成成功后，根据是否存在表格启用“复制表格”按钮
    const cbtn = document.getElementById('copyNoticeBtn');
    const cstatus = document.getElementById('copyStatus');
    if (cbtn) {
      const hasTable = !!output.querySelector('table, .docx-table');
      cbtn.disabled = !hasTable;
      cbtn.title = hasTable ? '复制表格到剪贴板' : '无表格可复制';
    }
    if (cstatus) {
      cstatus.textContent = '';
    }
    scrollToResultOutput();
  } catch (e) {
    console.error('学生版通知生成失败:', e);
    const msg = e?.name === 'AbortError' ? '请求超时，请检查网络或稍后重试' : (e?.message || e);
    alert('生成通知失败：' + msg);
    output.textContent = '生成失败：' + msg;
  } finally {
    clearTimeout(timeoutId);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '生成通知';
    }
  }
}

// 新增：HTML onclick 触发器，组装“当前卡片文本”并调用 studentNoticeGenerator
function onGenerateNoticeClick(){
  try {
    const headerInput = document.getElementById('noticeHeader');
    const footerInput = document.getElementById('noticeFooter');
    const output = document.getElementById('finalNoticeOutput');
    if (!headerInput || !footerInput || !output) return;

    // 使用已合并的 HTML（包含表格）作为基础；如无则以当前勾选项合并为纯文本
    const selectedEl = document.getElementById('selectedOutput');
    const selectedHtml = selectedEl ? String(selectedEl.innerHTML || '') : '';
    let bodyHtmlOrText = selectedHtml.trim() ? selectedHtml : getSelectedContents().join('\n\n');
    if (!String(bodyHtmlOrText).trim()) {
      output.textContent = '';
      alert('请在表格中勾选需要生成通知的内容');
      return;
    }

    // 头尾（以纯文本参与 AI 转换；表格仅存在于正文 HTML 中）
    const header = headerInput.value.trim();
    const footer = footerInput.value.trim();

    // 将正文中的所有 <table> 提取为占位符，保留顺序
    const tableMap = [];
    let htmlWithPlaceholders = String(bodyHtmlOrText);
    const tblRe = /<table[\s\S]*?<\/table>/gi;
    htmlWithPlaceholders = htmlWithPlaceholders.replace(tblRe, (m) => {
      const id = tableMap.push(m); // 1-based 索引
      return `<!--TABLE_PLACEHOLDER_${id}-->`;
    });

    // 去除其他 HTML 标签（保留注释占位符），得到给 AI 的纯文本
    let textForAI = htmlWithPlaceholders.replace(/<(?!!--)[^>]+>/g, '');

    // 联系人处理（仅对发送给 AI 的文本做处理）
    const contactMode = document.querySelector('input[name="contactMode"]:checked')?.value || 'keep';
    if (contactMode === 'remove') {
      textForAI = removeContactClauses(textForAI);
    }

    // 拼装最终发送文本：头 + 正文(含占位符) + 尾
    const parts = [];
    if (header) parts.push(header);
    parts.push(textForAI);
    if (footer) parts.push(footer);
    const finalTextForAI = parts.join('\n\n');

  // 调用转换并在返回后按占位符还原表格
  studentNoticeGenerator(finalTextForAI, tableMap);
  } catch (e) {
    console.error(e);
    alert('生成通知失败：' + (e?.message || e));
  }
}

// 工具：合并内联样式字符串（简易版）
function mergeInlineStyle(existing, addition){
  const base = (existing || '').trim();
  const add = (addition || '').trim();
  if (!base) return add;
  if (!add) return base;
  return base.endsWith(';') ? base + ' ' + add : base + '; ' + add;
}

// 构造用于剪贴板的 HTML：将表格样式内联，确保粘贴到富文本编辑器时保留边框与结构
function buildClipboardHtml(outputEl){
  const clone = outputEl.cloneNode(true);
  clone.querySelectorAll('.category-title').forEach(el => {
    el.setAttribute('style', mergeInlineStyle(el.getAttribute('style'), 'font-weight:600; color:#1F2937; margin:12px 0 6px; letter-spacing:0.5px;'));
    el.appendChild(document.createElement('br'));
    el.appendChild(document.createElement('br'));
  });
  clone.querySelectorAll('.subcategory-title').forEach(el => {
    el.setAttribute('style', mergeInlineStyle(el.getAttribute('style'), 'font-weight:600; color:#374151; margin:8px 0 4px;'));
    el.appendChild(document.createElement('br'));
  });
  clone.querySelectorAll('.item-row').forEach(el => {
    const styled = mergeInlineStyle(el.getAttribute('style'), 'margin-left:16px; line-height:1.7; font-weight:400;');
    el.setAttribute('style', styled);
    const html = el.innerHTML || '';
    if (!/^\s*[•]/.test(html)) {
      el.innerHTML = `• <span style="font-weight:400">${html}</span>`;
    }
  });
  const tables = clone.querySelectorAll('table');
  tables.forEach(tbl => {
    tbl.setAttribute('style', mergeInlineStyle(tbl.getAttribute('style'), 'border-collapse:collapse; width:100%; margin:14px 0; background:#FFFFFF; table-layout:auto;'));
    tbl.querySelectorAll('th').forEach(th => {
      th.setAttribute('style', mergeInlineStyle(th.getAttribute('style'), 'border:1px solid #D1D5DB; padding:10px 12px; font-size:14px; vertical-align:middle; text-align:left;'));
    });
    tbl.querySelectorAll('td').forEach(td => {
      td.setAttribute('style', mergeInlineStyle(td.getAttribute('style'), 'border:1px solid #D1D5DB; padding:10px 12px; font-size:14px; vertical-align:top; font-weight:400;'));
    });
    tbl.querySelectorAll('caption').forEach(c => {
      c.setAttribute('style', mergeInlineStyle(c.getAttribute('style'), 'caption-side:top; text-align:left; font-weight:600; color:#6B7280; padding:6px 0 8px;'));
    });
  });
  // 返回片段 HTML（保留链接等富文本）
  return clone.innerHTML;
}

function formatPlainTextForClipboard(outputEl){
  const lines = [];
  const addBlank = () => { if (!lines.length || lines[lines.length-1] !== '') lines.push(''); };

  function padToWidth(str, target){
    const s = String(str||'');
    const w = measureTextWidth(s);
    const need = Math.max(0, target - w);
    return s + ' '.repeat(need);
  }

  function tableToPlain(tbl){
    const rows = Array.from(tbl.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => (td.innerText || td.textContent || '').trim()));
    if (!rows.length) return [];
    const cols = Math.max(...rows.map(r=>r.length));
    const colWidths = new Array(cols).fill(0);
    rows.forEach(r => r.forEach((cell, idx) => { colWidths[idx] = Math.max(colWidths[idx], measureTextWidth(cell)); }));
    const rendered = rows.map(r => r.map((cell, idx) => padToWidth(cell, colWidths[idx] + 2)).join(''));
    return rendered;
  }

  const root = outputEl;
  if (!root) return '';
  root.querySelectorAll('.category-title').forEach(el => {
    addBlank();
    lines.push((el.innerText || el.textContent || '').trim());
    addBlank();
  });
  root.querySelectorAll('.subcategory-title').forEach(el => {
    lines.push((el.innerText || el.textContent || '').trim());
  });
  root.querySelectorAll('.item-row').forEach(el => {
    const t = (el.innerText || el.textContent || '').replace(/^\s*[•]\s*/,'').trim();
    lines.push(`  • ${t}`);
  });
  root.querySelectorAll('table').forEach(tbl => {
    addBlank();
    const rendered = tableToPlain(tbl);
    lines.push(...rendered);
    addBlank();
  });
  return lines.join('\n');
}

// 新增：富文本复制到剪贴板（优先 text/html，带回退）
copyNoticeBtn && copyNoticeBtn.addEventListener('click', async () => {
  try {
    const output = document.getElementById('finalNoticeOutput');
    if (!output) return;
    const tables = output.querySelectorAll('table, .docx-table');
    if (!tables || tables.length === 0) {
      if (copyStatusEl) copyStatusEl.textContent = '未检测到表格';
      alert('没有表格可复制');
      return;
    }

    // 构造仅包含表格的容器并注入样式，确保结构与样式完整
    const container = document.createElement('div');
    tables.forEach(t => container.appendChild(t.cloneNode(true)));
    const fragmentHtml = buildClipboardHtml(container);

  // 优先使用 ClipboardItem 写入 text/html 和 text/plain
  if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([fragmentHtml], { type: 'text/html' });
      const formattedPlain = formatPlainTextForClipboard(container);
      const textBlob = new Blob([formattedPlain], { type: 'text/plain' });
      const item = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });
      await navigator.clipboard.write([item]);
      if (copyStatusEl) copyStatusEl.textContent = '复制成功（表格富文本）';
      return;
  }

    // 回退一：仅写入纯文本（在不支持 ClipboardItem 的环境）
  if (navigator.clipboard && navigator.clipboard.writeText) {
      const formattedPlain = formatPlainTextForClipboard(container);
      await navigator.clipboard.writeText(formattedPlain);
      if (copyStatusEl) copyStatusEl.textContent = '复制成功（表格纯文本）';
      return;
  }

    // 回退二：使用 contenteditable 承载 HTML，选择后 execCommand('copy')
    const temp = document.createElement('div');
    temp.contentEditable = 'true';
    temp.style.position = 'fixed';
    temp.style.left = '-10000px';
    temp.style.top = '0';
    temp.innerHTML = fragmentHtml;
    document.body.appendChild(temp);
    const range = document.createRange();
    range.selectNodeContents(temp);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const ok = document.execCommand('copy');
    sel.removeAllRanges();
    document.body.removeChild(temp);
    if (ok) {
      if (copyStatusEl) copyStatusEl.textContent = '复制成功（表格富文本回退）';
    } else {
      if (copyStatusEl) copyStatusEl.textContent = '复制失败';
      alert('复制失败，请手动选择并复制内容');
    }
  } catch (err) {
    console.error('复制失败:', err);
    if (copyStatusEl) copyStatusEl.textContent = '复制失败：' + (err?.message || err);
    alert('复制失败：' + (err?.message || err));
  }
});

// 事件绑定：提取层级内容并进行三层重编号，输出为清晰层级的纯文本
collectBtn && collectBtn.addEventListener('click', () => {
  try{
    if (!parsedStructure || !Array.isArray(parsedStructure.markers) || !Array.isArray(parsedStructure.items)){
      alert('请先解析文档并生成预览表格');
      return;
    }

    const boxes = Array.from(tableWrap.querySelectorAll('.row-select:checked'));
    const selectedUids = boxes.map(b=>b.getAttribute('data-uid')).filter(Boolean);
    if (!selectedUids.length){
      alert('请至少选择一条记录');
      if (selectedOutput) selectedOutput.textContent = '';
      return;
    }

    const sortType = getCurrentSortType();

    // 工具：数字序号 -> 中文数字（支持到999，简易）
    const digitsMap = ['零','一','二','三','四','五','六','七','八','九'];
    function toChineseNumber(n){
      n = Math.max(0, Math.floor(n));
      if (n === 0) return '零';
      if (n === 10) return '十';
      if (n > 10 && n < 20) return '十' + digitsMap[n-10];
      const units = ['', '十', '百', '千'];
      const parts = [];
      const s = String(n);
      for (let i=0; i<s.length; i++){
        const d = Number(s[s.length - 1 - i]);
        if (d === 0){
          if (!parts[0] || parts[0] !== '零') parts.unshift('零');
        } else {
          const unit = units[i] || '';
          parts.unshift(digitsMap[d] + unit);
        }
      }
      while (parts.length && parts[parts.length-1] === '零') parts.pop();
      return parts.join('').replace(/零+/g,'零').replace(/零$/,'');
    }

    function stripItemPrefix(s){ return String(s||'').replace(/^\s*(（\s*\d+\s*）|\(\s*\d+\s*\))\s*/, ''); }

    if (sortType === 'time' || sortType === 'custom'){
      const set = new Set(selectedUids);
      const chosen = records.filter(r => set.has(r.uid));
      const lines = [];
      let num = 0;
      chosen.forEach(rec => {
        num++;
        let html = String(rec['提取的内容_html'] || '').trim();
        const bodyHtml = html.replace(/^\s*(（\s*\d+\s*）|\(\s*\d+\s*\))\s*/, '');
        lines.push(`<div class="item-row">(${num}) ${bodyHtml}</div>`);
      });
      const outHtml = lines.join('\n');
      if (selectedOutput) selectedOutput.innerHTML = outHtml;
      if (statusEl){
        statusEl.textContent = `提取完成：${chosen.length} 条`;
        setTimeout(()=>{ statusEl.textContent = `解析完成，共 ${records.length} 条`; }, 2000);
      }
      return;
    }

    const markers = [...parsedStructure.markers].sort((a,b)=>a.pos-b.pos);
    const items = [...parsedStructure.items].sort((a,b)=>a.pos-b.pos);
    const topCats = markers.filter(m => m.level === 1);
    if (!topCats.length){
      alert('未识别到一级分类');
      if (selectedOutput) selectedOutput.textContent = '';
      return;
    }

    function stripCatTitle(t){ return String(t||'').replace(/^\s*[一二三四五六七八九十百千]+、\s*/, '').trim(); }
    function stripSubTitle(t){ return String(t||'').replace(/^\s*\d+[、\.．\)）]\s*/, '').trim(); }

    const posToRecord = new Map();
    records.forEach(r => {
      const p = (typeof r.rawPos === 'number' ? r.rawPos : -1);
      if (p >= 0) posToRecord.set(p, r);
    });

    const outLines = [];
    let catCounter = 0;
    for (let ci=0; ci<topCats.length; ci++){
      const cat = topCats[ci];
      const catStart = cat.pos;
      const catEnd = (ci+1 < topCats.length) ? topCats[ci+1].pos : Number.MAX_SAFE_INTEGER;
      const subcats = markers.filter(m => m.level === 2 && m.pos >= catStart && m.pos < catEnd).sort((a,b)=>a.pos-b.pos);
      const subOut = [];
      let subCounter = 0;
      for (let si=0; si<subcats.length; si++){
        const sub = subcats[si];
        const subStart = sub.pos;
        const subEndCandidate = markers.find(m => (m.level === 2 || m.level === 1) && m.pos > subStart && m.pos < catEnd);
        const subEnd = subEndCandidate ? subEndCandidate.pos : catEnd;
        const selectedItems = items.filter(it => it.pos >= subStart && it.pos < subEnd).filter(it => {
          const rec = posToRecord.get(it.pos);
          return rec && selectedUids.includes(rec.uid);
        });
        if (!selectedItems.length) continue;
        subCounter++;
        const subName = stripSubTitle(sub.title);
        subOut.push(`<div class="subcategory-title">${subCounter}、${escapeHtml(subName)}</div>`);
        let itemCounter = 0;
        selectedItems.forEach(it => {
          itemCounter++;
          const rec = posToRecord.get(it.pos);
          let html = String(rec?.['提取的内容_html'] || '').trim();
          const bodyHtml = html.replace(/^\s*(（\s*\d+\s*）|\(\s*\d+\s*\))\s*/, '');
          subOut.push(`<div class="item-row">(${itemCounter}) ${bodyHtml}</div>`);
        });
      }
      if (!subOut.length) continue;
      catCounter++;
      const catName = stripCatTitle(cat.title);
      outLines.push(`<div class="category-title">${escapeHtml(`${toChineseNumber(catCounter)}、${catName}`)}</div>`);
      outLines.push(...subOut);
    }

    const outHtml = outLines.join('\n');
    if (selectedOutput) selectedOutput.innerHTML = outHtml;
  }catch(e){
    console.error(e);
    alert('提取内容失败：' + (e?.message || e));
  }
});
