import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'

function stubBackendHealth(aiConfigured: boolean) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    status: 'ok',
    environment: 'test',
    ai_configured: aiConfigured,
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App workspace', () => {
  it('keeps upload controls without exposing developer service status', async () => {
    stubBackendHealth(true)
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('上传 Word')
    expect(wrapper.text()).not.toContain('后端在线')
    expect(wrapper.text()).not.toContain('AI 已就绪')

    wrapper.unmount()
  })

  it('starts both work columns with the usage guide and general settings', async () => {
    stubBackendHealth(true)
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('插件使用说明')
    expect(wrapper.text()).not.toContain('先设置生成口径，再处理当前文档')

    const main = wrapper.get('main').element
    const usageColumn = main.children.item(0)
    const settingsColumn = main.children.item(1)
    expect(usageColumn?.firstElementChild?.textContent).toContain('插件使用说明')
    expect(settingsColumn?.firstElementChild?.textContent).toContain('通用生成设置')

    wrapper.unmount()
  })

  it('enables AI generation when the health response reports AI configured', async () => {
    stubBackendHealth(true)
    const wrapper = mount(App)
    await flushPromises()

    const generateButton = wrapper.findAll('button').find((button) => button.text().includes('根据筛选内容生成备忘'))
    expect(generateButton).toBeDefined()
    expect(generateButton?.attributes('disabled')).toBeUndefined()

    wrapper.unmount()
  })

  it('disables AI generation when the health response reports AI unavailable', async () => {
    stubBackendHealth(false)
    const wrapper = mount(App)
    await flushPromises()

    const generateButton = wrapper.findAll('button').find((button) => button.text().includes('根据筛选内容生成备忘'))
    expect(generateButton).toBeDefined()
    expect(generateButton?.attributes('disabled')).toBeDefined()

    wrapper.unmount()
  })

  it('keeps AI generation disabled when the health request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Network unavailable')
    }))
    const wrapper = mount(App)
    await flushPromises()

    const generateButton = wrapper.findAll('button').find((button) => button.text().includes('根据筛选内容生成备忘'))
    expect(generateButton).toBeDefined()
    expect(generateButton?.attributes('disabled')).toBeDefined()

    wrapper.unmount()
  })
})
