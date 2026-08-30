import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'

function stubHealthyBackend() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    status: 'ok',
    environment: 'test',
    ai_configured: true,
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
    stubHealthyBackend()
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('上传 Word')
    expect(wrapper.text()).not.toContain('后端在线')
    expect(wrapper.text()).not.toContain('AI 已就绪')

    wrapper.unmount()
  })

  it('starts both work columns with the usage guide and general settings', async () => {
    stubHealthyBackend()
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('插件使用说明')
    expect(wrapper.text()).not.toContain('先设置生成口径，再处理当前文档')

    const main = wrapper.get('main').element
    const settingsColumn = main.children.item(1)
    expect(settingsColumn?.firstElementChild?.textContent).toContain('通用生成设置')

    wrapper.unmount()
  })
})
