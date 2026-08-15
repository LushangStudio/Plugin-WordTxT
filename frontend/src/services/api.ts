import type {
  ExtractDocumentResponse,
  FilterType,
  GenerationSettings,
  HealthResponse,
  NoticeResponse,
  ParseDocumentResponse,
  ParsedItem,
  SortType,
} from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function parseError(response: Response): Promise<Error> {
  try {
    const data = (await response.json()) as { detail?: string }
    return new Error(data.detail || `请求失败（${response.status}）`)
  } catch {
    return new Error(`请求失败（${response.status}）`)
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (!response.ok) throw await parseError(response)
  return (await response.json()) as T
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson('/health')
}

export async function extractDocument(file: File): Promise<ExtractDocumentResponse> {
  const body = new FormData()
  body.append('file', file)
  return requestJson('/documents/extract', { method: 'POST', body })
}

export async function parseDocument(file: File, startNumber = 1): Promise<ParseDocumentResponse> {
  const body = new FormData()
  body.append('file', file)
  body.append('start_number', String(startNumber))
  return requestJson('/documents/parse', { method: 'POST', body })
}

export async function classifyItems(items: ParsedItem[] | Array<{ uid: string; content: string }>, filterType: FilterType) {
  return requestJson<{ kept_ids: string[] }>('/filters/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter_type: filterType,
      items: items.map((item) => ({ id: item.uid, content: item.content })),
    }),
  })
}

export function generateNotice(
  items: Array<{ uid: string; content: string; tables_html?: string[] }>,
  settings: GenerationSettings,
  workflow: 'content' | 'table',
): Promise<NoticeResponse> {
  return requestJson('/notices/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: items.map((item) => ({
        id: item.uid,
        content: item.content,
        tables_html: item.tables_html || [],
      })),
      user_prompt: settings.userPrompt,
      header: settings.header,
      footer: settings.footer,
      contact_mode: settings.contactMode,
      workflow,
    }),
  })
}

export async function exportWorkbook(
  items: ParsedItem[],
  filename: string,
  sourceDocument: string,
  sortType: SortType,
): Promise<void> {
  const response = await fetch(`${API_BASE}/exports/xlsx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename,
      source_document: sourceDocument,
      sort_type: sortType,
      items: items.map((item) => ({
        number: item.number,
        time: item.time,
        weekday: item.weekday,
        contact_name: item.contact_name,
        contact_phone: item.contact_phone,
        summary: item.summary,
        content: item.content,
        notes: item.notes,
      })),
    }),
  })
  if (!response.ok) throw await parseError(response)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
