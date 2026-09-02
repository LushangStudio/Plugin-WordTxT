import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  exportWorkbook,
  getHealth,
  setUnauthorizedHandler,
  UnauthorizedError,
} from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(null)
})

describe('API requests', () => {
  it('sends cookies with ordinary JSON requests', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      status: 'ok',
      environment: 'test',
      ai_configured: true,
    }), {
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await getHealth()

    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({
      credentials: 'include',
    }))
  })

  it('sends cookies with Excel downloads', async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(['xlsx']), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:workbook'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await exportWorkbook([], 'memo', 'source.docx', 'original')

    expect(fetchMock).toHaveBeenCalledWith('/api/exports/xlsx', expect.objectContaining({
      credentials: 'include',
    }))
  })

  it('notifies the application and rejects with UnauthorizedError on a 401 response', async () => {
    const onUnauthorized = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: 'Not authenticated' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    })))
    setUnauthorizedHandler(onUnauthorized)

    await expect(getHealth()).rejects.toBeInstanceOf(UnauthorizedError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
