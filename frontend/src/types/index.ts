export type ContactMode = 'keep' | 'remove'
export type FilterType = 'student' | 'graduate' | 'nonGraduate' | 'departmentRecruitment'
export type SortType = 'original' | 'time' | 'custom'

export interface GenerationSettings {
  userPrompt: string
  header: string
  footer: string
  contactMode: ContactMode
}

export interface TableReport {
  found: number
  converted: number
  failed: number
}

export interface CategoryMarker {
  title: string
  position: number
  level: number
}

export interface ParsedItem {
  uid: string
  number: number
  time: string
  weekday: string
  contact_name: string
  contact_phone: string
  summary: string
  content: string
  content_html: string
  tables_html: string[]
  raw_position: number
  category: string
  subcategory: string
  notes: string
}

export interface ExtractedDocumentTable {
  marker: string
  html: string
  plain_text: string
}

export interface ExtractDocumentResponse {
  filename: string
  text: string
  character_count: number
  tables: ExtractedDocumentTable[]
  table_report: TableReport
}

export interface ParseDocumentResponse {
  filename: string
  items: ParsedItem[]
  categories: CategoryMarker[]
  cut_info: {
    keyword: string | null
    paragraph_index: number | null
    offset: number | null
  }
  table_report: TableReport
}

export interface NoticeResponse {
  text: string
  html: string
  missing_item_ids: string[]
}

export interface GeneratedResult extends NoticeResponse {
  source: 'content' | 'table'
}

export interface HealthResponse {
  status: string
  environment: string
  ai_configured: boolean
}

export interface AuthUser {
  user_id: string
  user_name: string
  user_type: string
}

export interface AuthMeResponse {
  authenticated: boolean
  user: AuthUser | null
}
