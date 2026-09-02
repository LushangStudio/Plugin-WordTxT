<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, ClipboardCopy, Copy, FileCheck2, Sparkles } from '@lucide/vue'

import type { GeneratedResult } from '../types'
import UiButton from './ui/UiButton.vue'

const props = defineProps<{ result: GeneratedResult | null }>()
const copyStatus = ref('')

watch(() => props.result, () => {
  copyStatus.value = ''
})

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
  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div class="border-b border-slate-100 px-5 py-5">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><FileCheck2 :size="19" aria-hidden="true" /></span>
          <div><strong class="block text-base font-bold text-slate-950">生成结果</strong><small class="mt-0.5 block text-xs leading-5 font-normal text-slate-500">{{ result ? `来自${result.source === 'content' ? '内容' : '表格'}工作流` : '完成处理后会自动出现在这里' }}</small></div>
        </div>
        <span v-if="result" class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700"><Check :size="12" aria-hidden="true" />已生成</span>
      </div>
    </div>
    <div class="p-5">
      <div v-if="result" class="grid gap-4">
        <div class="flex flex-wrap gap-2">
          <UiButton variant="outline" size="sm" @click="copyText"><Copy :size="15" aria-hidden="true" />复制文本</UiButton>
          <UiButton variant="secondary" size="sm" @click="copyRichText"><ClipboardCopy :size="15" aria-hidden="true" />复制富文本</UiButton>
        </div>
        <p v-if="copyStatus" class="m-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><Check :size="14" aria-hidden="true" />{{ copyStatus }}</p>
        <div class="notice-output max-h-[calc(100vh-230px)] min-h-48 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-8 text-slate-800" v-html="result.html" />
      </div>
      <div v-else class="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
        <div>
          <span class="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"><Sparkles :size="21" aria-hidden="true" /></span>
          <strong class="mt-4 block text-sm text-slate-800">等待生成通知</strong>
          <p class="mt-2 mb-0 text-xs leading-6 text-slate-500">上传 Word，完成筛选与复核后，生成结果会固定显示在这个抽屉中。</p>
        </div>
      </div>
    </div>
  </section>
</template>
