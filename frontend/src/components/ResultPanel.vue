<script setup lang="ts">
import { ref } from 'vue'

import type { GeneratedResult } from '../types'

const props = defineProps<{ result: GeneratedResult | null }>()
const copyStatus = ref('')

async function copyText() {
  if (!props.result?.text) return
  await navigator.clipboard.writeText(props.result.text)
  copyStatus.value = '文本复制成功'
}

async function copyRichText() {
  if (!props.result?.html) return
  if (window.ClipboardItem && navigator.clipboard.write) {
    const item = new ClipboardItem({
      'text/html': new Blob([props.result.html], { type: 'text/html' }),
      'text/plain': new Blob([props.result.text], { type: 'text/plain' }),
    })
    await navigator.clipboard.write([item])
    copyStatus.value = '富文本复制成功'
    return
  }
  await copyText()
}
</script>

<template>
  <section class="card result-card">
    <div class="result-heading">
      <div><strong>生成结果</strong><small>{{ result ? `来自${result.source === 'content' ? '内容' : '表格'}工作流` : '两个工作流共用此结果区' }}</small></div>
      <div class="button-row">
        <button class="btn secondary" type="button" :disabled="!result" @click="copyText">复制文本</button>
        <button class="btn secondary" type="button" :disabled="!result" @click="copyRichText">复制富文本</button>
      </div>
    </div>
    <p v-if="copyStatus" class="success-text">{{ copyStatus }}</p>
    <div v-if="result" class="notice-output" v-html="result.html" />
    <div v-else class="empty-state">生成后的通知会显示在这里。</div>
  </section>
</template>

