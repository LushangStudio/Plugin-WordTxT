<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import AppHeader from './components/AppHeader.vue'
import ContentWorkflow from './components/ContentWorkflow.vue'
import GenerationSettingsPanel from './components/GenerationSettings.vue'
import ResultPanel from './components/ResultPanel.vue'
import TableWorkflow from './components/TableWorkflow.vue'
import { getHealth } from './services/api'
import type { GeneratedResult, GenerationSettings } from './types'

const file = ref<File | null>(null)
const activeWorkflow = ref<'content' | 'table'>('content')
const backendOnline = ref(false)
const aiConfigured = ref(false)
const result = ref<GeneratedResult | null>(null)
const settings = reactive<GenerationSettings>({
  userPrompt: '',
  header: '本周学工备忘如下：',
  footer: '请同学们注意查收。',
  contactMode: 'keep',
})

function setFile(value: File | null) {
  file.value = value
  result.value = null
}

function setSettings(value: GenerationSettings) {
  Object.assign(settings, value)
}

function showResult(value: GeneratedResult) {
  result.value = value
  requestAnimationFrame(() => document.querySelector('.result-card')?.scrollIntoView({ behavior: 'smooth' }))
}

onMounted(async () => {
  try {
    const health = await getHealth()
    backendOnline.value = health.status === 'ok'
    aiConfigured.value = health.ai_configured
  } catch {
    backendOnline.value = false
  }
})
</script>

<template>
  <main class="app-shell">
    <AppHeader :file="file" :backend-online="backendOnline" :ai-configured="aiConfigured" @file-change="setFile" />
    <GenerationSettingsPanel :model-value="settings" @update:model-value="setSettings" />

    <nav class="workflow-tabs" aria-label="生成方式">
      <button :class="{ active: activeWorkflow === 'content' }" type="button" @click="activeWorkflow = 'content'">内容筛选生成</button>
      <button :class="{ active: activeWorkflow === 'table' }" type="button" @click="activeWorkflow = 'table'">表格选择生成</button>
    </nav>

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
    <ResultPanel :result="result" />
  </main>
</template>
