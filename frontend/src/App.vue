<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, FileInput, FileText, ListFilter, Table2 } from '@lucide/vue'

import AppHeader from './components/AppHeader.vue'
import ContentWorkflow from './components/ContentWorkflow.vue'
import GenerationSettingsPanel from './components/GenerationSettings.vue'
import ResultPanel from './components/ResultPanel.vue'
import TableWorkflow from './components/TableWorkflow.vue'
import { getHealth } from './services/api'
import type { GeneratedResult, GenerationSettings } from './types'

const file = ref<File | null>(null)
const activeWorkflow = ref<'content' | 'table'>('content')
const aiConfigured = ref(false)
const result = ref<GeneratedResult | null>(null)
const settings = reactive<GenerationSettings>({
  userPrompt: '',
  header: '本周学工备忘如下：',
  footer: '请同学们注意查收。',
  contactMode: 'keep',
})

const taskStage = computed(() => result.value ? 3 : file.value ? 2 : 1)

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

    <main class="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[220px_minmax(0,1fr)_340px] xl:px-8">
      <aside class="self-start xl:sticky xl:top-5">
        <section class="overflow-hidden rounded-2xl border border-slate-200 bg-[#102447] text-white shadow-sm">
          <div class="border-b border-white/10 px-5 py-5">
            <p class="m-0 text-[11px] font-bold tracking-[0.18em] text-cyan-300">插件使用说明</p>
            <p class="mt-2 mb-0 text-sm leading-6 text-blue-100">从原始 Word 到可发送通知，当前进度会在这里同步。</p>
          </div>
          <ol class="m-0 grid list-none gap-0 p-3" aria-label="处理进度">
            <li v-for="(stage, index) in [
              { title: '装载文档', detail: file?.name || '等待上传 Word', icon: FileInput },
              { title: '筛选与复核', detail: activeWorkflow === 'content' ? '内容筛选模式' : '表格选择模式', icon: ListFilter },
              { title: '生成通知', detail: result ? '结果已生成' : '等待生成结果', icon: FileText },
            ]" :key="stage.title" class="relative flex gap-3 rounded-xl px-3 py-3" :class="taskStage === index + 1 ? 'bg-white/10' : ''">
              <div class="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border" :class="taskStage > index + 1 ? 'border-cyan-300 bg-cyan-300 text-[#102447]' : taskStage === index + 1 ? 'border-white bg-white text-blue-800' : 'border-blue-300/40 bg-blue-950/30 text-blue-200'">
                <Check v-if="taskStage > index + 1" :size="15" :stroke-width="2.5" aria-hidden="true" />
                <component :is="stage.icon" v-else :size="15" aria-hidden="true" />
              </div>
              <div class="min-w-0 pt-0.5">
                <strong class="block text-sm">{{ stage.title }}</strong>
                <span class="mt-0.5 block truncate text-xs text-blue-200" :title="stage.detail">{{ stage.detail }}</span>
              </div>
            </li>
          </ol>
        </section>

        <nav class="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm xl:grid-cols-1" aria-label="生成方式">
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
            <span class="min-w-0"><strong class="block truncate text-sm">内容筛选</strong><small class="mt-0.5 hidden text-xs font-normal text-slate-500 xl:block">全文校对与通知生成</small></span>
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
            <span class="min-w-0"><strong class="block truncate text-sm">表格选择</strong><small class="mt-0.5 hidden text-xs font-normal text-slate-500 xl:block">逐条勾选与 Excel 导出</small></span>
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
