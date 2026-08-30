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

  it('uses single-line accordion headers without secondary helper text', async () => {
    stubBackendHealth(true)
    const wrapper = mount(App)
    await flushPromises()

    const settingsHeader = wrapper.get('button[aria-controls="generation-settings"]')
    const tableHeader = wrapper.get('button[aria-controls="table-workflow"]')
    expect(settingsHeader.text()).toContain('通用生成设置')
    expect(tableHeader.text()).toContain('表格选择生成')
    expect(settingsHeader.find('small').exists()).toBe(false)
    expect(tableHeader.find('small').exists()).toBe(false)

    await wrapper.get('nav[aria-label="提取方式"] button:first-child').trigger('click')
    const contentHeader = wrapper.get('button[aria-controls="content-workflow"]')
    expect(contentHeader.text()).toContain('内容筛选生成')
    expect(contentHeader.find('small').exists()).toBe(false)

    wrapper.unmount()
  })

  it('keeps extraction controls reachable below a viewport-limited desktop guide', async () => {
    stubBackendHealth(true)
    const wrapper = mount(App)
    await flushPromises()

    const guide = wrapper.get('main aside section')
    const extractionNav = wrapper.get('main aside nav')
    expect(guide.classes()).toContain('xl:max-h-[calc(100vh-13rem)]')
    expect(guide.classes()).toContain('xl:overflow-y-auto')
    expect(extractionNav.classes()).toContain('xl:shrink-0')

    wrapper.unmount()
  })

  it('presents the final five-step static usage guide in order', async () => {
    stubBackendHealth(true)
    const wrapper = mount(App)
    await flushPromises()

    const guide = wrapper.get('main aside section')
    const stepTitles = guide.findAll('li h3').map((title) => title.text())
    expect(stepTitles).toEqual([
      '上传 Word 文档',
      '设置生成要求',
      '选择提取方式',
      '筛选与复核',
      '生成通知文本',
    ])
    expect(guide.text()).toContain('点击页面顶端“上传 Word”，选择需要处理的学工备忘文件。')
    expect(guide.text()).toContain('在“通用生成设置”中撰写提示词，并配置通知开头、结尾和联系人保留方式。')
    expect(guide.text()).toContain('在页面左侧的卡片选择“提取为表格”或“提取为文本”。两者区别如下：')
    expect(guide.text()).toContain('提取为表格（推荐）：按事项拆成简单直观的条目，适合大部分场景。')
    expect(guide.text()).toContain('提取为文本：保留全文和原始表格，可人工逐字删改，适用于需要细节修改的场景。')
    expect(guide.text()).toContain('根据需要选择内容，复核后进入通知生成环节。')
    expect(guide.text()).toContain('点击“根据筛选内容生成通知”按钮，即可使用前面配置的提示词生成不同的通知。')
    expect(guide.text()).not.toContain('从原始 Word 到可发送通知，当前进度会在这里同步。')
    expect(guide.text()).not.toContain('等待上传 Word')

    wrapper.unmount()
  })

  it('uses the table extraction workflow by default with concise extraction labels', async () => {
    stubBackendHealth(true)
    const wrapper = mount(App)
    await flushPromises()

    const textModeButton = wrapper.findAll('nav button').find((button) => button.text() === '提取为文本')
    const tableModeButton = wrapper.findAll('nav button').find((button) => button.text() === '提取为表格')
    expect(textModeButton).toBeDefined()
    expect(tableModeButton).toBeDefined()
    expect(textModeButton?.attributes('aria-current')).toBeUndefined()
    expect(tableModeButton?.attributes('aria-current')).toBe('page')
    expect(wrapper.text()).toContain('表格选择生成')

    wrapper.unmount()
  })

  it('enables AI generation when the health response reports AI configured', async () => {
    stubBackendHealth(true)
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('nav button:first-child').trigger('click')

    const generateButton = wrapper.findAll('button').find((button) => button.text().includes('根据筛选内容生成通知'))
    expect(generateButton).toBeDefined()
    expect(generateButton?.attributes('disabled')).toBeUndefined()

    wrapper.unmount()
  })

  it('disables AI generation when the health response reports AI unavailable', async () => {
    stubBackendHealth(false)
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('nav button:first-child').trigger('click')

    const generateButton = wrapper.findAll('button').find((button) => button.text().includes('根据筛选内容生成通知'))
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

    await wrapper.get('nav button:first-child').trigger('click')

    const generateButton = wrapper.findAll('button').find((button) => button.text().includes('根据筛选内容生成通知'))
    expect(generateButton).toBeDefined()
    expect(generateButton?.attributes('disabled')).toBeDefined()

    wrapper.unmount()
  })
})
