<script setup lang="ts">
import { onMounted, reactive, ref, type Component } from 'vue'
import { Columns2, FileInput, FileText, ListFilter, Settings2, Table2 } from '@lucide/vue'

import AppHeader from './components/AppHeader.vue'
import ContentWorkflow from './components/ContentWorkflow.vue'
import GenerationSettingsPanel from './components/GenerationSettings.vue'
import ResultPanel from './components/ResultPanel.vue'
import TableWorkflow from './components/TableWorkflow.vue'
import { getHealth } from './services/api'
import type { GeneratedResult, GenerationSettings } from './types'

const file = ref<File | null>(null)
const activeWorkflow = ref<'content' | 'table'>('table')
const aiConfigured = ref(false)
const result = ref<GeneratedResult | null>(null)
const settings = reactive<GenerationSettings>({
  userPrompt: '',
  header: '本周学工备忘如下：',
  footer: '请同学们注意查收。',
  contactMode: 'keep',
})

interface UsageStep {
  title: string
  description: string
  icon: Component
  choices?: Array<{
    label: string
    description: string
  }>
}

const usageSteps: UsageStep[] = [
  {
    title: '上传 Word 文档',
    description: '点击页面顶端“上传 Word”，选择需要处理的学工备忘文件。',
    icon: FileInput,
  },
  {
    title: '设置生成要求',
    description: '在“通用生成设置”中撰写提示词，并配置通知开头、结尾和联系人保留方式。',
    icon: Settings2,
  },
  {
    title: '选择提取方式',
    description: '在页面左侧的卡片选择“提取为表格”或“提取为文本”。两者区别如下：',
    icon: Columns2,
    choices: [
      {
        label: '提取为表格（推荐）',
        description: '按事项拆成简单直观的条目，适合大部分场景。',
      },
      {
        label: '提取为文本',
        description: '保留全文和原始表格，可人工逐字删改，适用于需要细节修改的场景。',
      },
    ],
  },
  {
    title: '筛选与复核',
    description: '根据需要选择内容，复核后进入通知生成环节。',
    icon: ListFilter,
  },
  {
    title: '生成通知文本',
    description: '点击“根据筛选内容生成通知”按钮，即可使用前面配置的提示词生成不同的通知。',
    icon: FileText,
  },
]

function setFile(value: File | null) {
  file.value = value
  result.value = null
}

function setSettings(value: GenerationSettings) {
  Object.assign(settings, value)
}

function showResult(value: GeneratedResult) {
  result.value = value
  requestAnimationFrame(() => document.querySelector('#result-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

onMounted(async () => {
  try {
    const health = await getHealth()
    aiConfigured.value = health.ai_configured
  } catch {
    aiConfigured.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#f4f7fb] text-slate-900">
    <AppHeader :file="file" @file-change="setFile" />

    <main class="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[260px_minmax(0,1fr)_340px] xl:px-8">
      <aside class="self-start xl:sticky xl:top-5">
        <section class="overflow-x-hidden rounded-2xl border border-blue-100 bg-white text-slate-900 shadow-sm xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto">
          <div class="border-b border-blue-100 bg-blue-50 px-5 py-4 xl:sticky xl:top-0 xl:z-10">
            <p class="m-0 text-sm font-bold tracking-wide text-blue-900">插件使用说明</p>
          </div>
          <ol class="m-0 grid list-none divide-y divide-slate-100 p-2" aria-label="插件使用步骤">
            <li v-for="(step, index) in usageSteps" :key="step.title" class="flex gap-3 px-2 py-3.5">
              <div class="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <component :is="step.icon" :size="16" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <div class="flex items-baseline gap-2">
                  <span class="text-[10px] font-bold tracking-wider text-blue-500">0{{ index + 1 }}</span>
                  <h3 class="m-0 text-sm font-bold text-slate-900">{{ step.title }}</h3>
                </div>
                <p class="mt-1.5 mb-0 text-xs leading-5 text-slate-600">{{ step.description }}</p>
                <div v-if="step.choices" class="mt-2 grid gap-2">
                  <p v-for="choice in step.choices" :key="choice.label" class="m-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-600">
                    <strong class="text-slate-800">{{ choice.label }}：</strong>{{ choice.description }}
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </section>

        <nav class="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm xl:grid-cols-1 xl:shrink-0" aria-label="提取方式">
          <button
            type="button"
            class="group flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            :class="activeWorkflow === 'content' ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'"
            :aria-current="activeWorkflow === 'content' ? 'page' : undefined"
            @click="activeWorkflow = 'content'"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-lg" :class="activeWorkflow === 'content' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-slate-800'">
              <ListFilter :size="18" aria-hidden="true" />
            </span>
            <span class="min-w-0"><strong class="block truncate text-sm">提取为文本</strong></span>
          </button>
          <button
            type="button"
            class="group flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            :class="activeWorkflow === 'table' ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'"
            :aria-current="activeWorkflow === 'table' ? 'page' : undefined"
            @click="activeWorkflow = 'table'"
          >
            <span class="grid size-9 shrink-0 place-items-center rounded-lg" :class="activeWorkflow === 'table' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-slate-800'">
              <Table2 :size="18" aria-hidden="true" />
            </span>
            <span class="min-w-0"><strong class="block truncate text-sm">提取为表格</strong></span>
          </button>
        </nav>
      </aside>

      <div class="min-w-0 space-y-5">
        <GenerationSettingsPanel :model-value="settings" @update:model-value="setSettings" />
        <ContentWorkflow
          v-if="activeWorkflow === 'content'"
          :file="file"
          :settings="settings"
          :ai-configured="aiConfigured"
          @result="showResult"
        />
        <TableWorkflow
          v-else
          :file="file"
          :settings="settings"
          :ai-configured="aiConfigured"
          @result="showResult"
        />
      </div>

      <aside id="result-panel" class="min-w-0 self-start scroll-mt-5 xl:sticky xl:top-5">
        <ResultPanel :result="result" />
      </aside>
    </main>
  </div>
</template>
