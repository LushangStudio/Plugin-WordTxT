const BLOCK_BOUNDARY = /^\s*(?:[一二三四五六七八九十百千]+、|\d+[、\.．\)）]|（\s*\d+\s*）|\(\s*\d+\s*\))/

export function splitTextBlocks(text: string): string[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: string[] = []
  let current: string[] = []
  for (const line of lines) {
    if (BLOCK_BOUNDARY.test(line) && current.join('\n').trim()) {
      blocks.push(current.join('\n').trim())
      current = [line]
    } else {
      current.push(line)
    }
  }
  const tail = current.join('\n').trim()
  if (tail) blocks.push(tail)
  return blocks.length ? blocks : text.trim() ? [text.trim()] : []
}

export function removeSection(text: string, startTitle: string, endTitle?: string): string | null {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headingPrefix = '(?:[一二三四五六七八九十百千]+、|\\d+[、\\.．\\)）])?\\s*'
  const startRegex = new RegExp(`(^|\\n)\\s*${headingPrefix}${escape(startTitle)}\\s*(?=\\n|$)`)
  const start = text.search(startRegex)
  if (start < 0) return null
  let end = text.length
  if (endTitle) {
    const tail = text.slice(start + 1)
    const endRegex = new RegExp(`(^|\\n)\\s*${headingPrefix}${escape(endTitle)}\\s*(?=\\n|$)`)
    const match = tail.search(endRegex)
    if (match >= 0) end = start + 1 + match
  }
  return `${text.slice(0, start)}\n\n${text.slice(end)}`.replace(/\n{3,}/g, '\n\n').trim()
}

export function monthDayValue(value: string): number {
  const match = value.match(/(\d{1,2})月(\d{1,2})日/)
  return match ? Number(match[1]) * 100 + Number(match[2]) : Number.MAX_SAFE_INTEGER
}

