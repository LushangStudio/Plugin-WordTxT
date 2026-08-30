<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, Columns2, FileSearch, RotateCcw, Sparkles, Table2, Trash2, WandSparkles } from '@lucide/vue'

import { classifyItems, extractDocument, generateNotice } from '../services/api'
import type { ExtractedDocumentTable, GeneratedResult, GenerationSettings } from '../types'
import { removeSection, splitTextBlocks } from '../utils/text'
import UiButton from './ui/UiButton.vue'

const props = defineProps<{
  file: File | null
  settings: GenerationSettings
  aiConfigured: boolean
}>()
const emit = defineEmits<{ result: [value: GeneratedResult] }>()

const open = ref(true)
const loading = ref(false)
const status = ref('可从 Word 提取，也可直接粘贴文本。')
const text = ref('')
const originalText = ref('')
const tables = ref<ExtractedDocumentTable[]>([])
type ContentFilter = 'restore' | 'removeReminders' | 'removeMaterials' | 'student'

const characterCount = computed(() => text.value.trim().length)
const activeTableCount = computed(() => tables.value.filter((table) => text.value.includes(table.marker)).length)

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const previewHtml = computed(() => {
  let output = escapeHtml(text.value).replace(/\n/g, '<br>')
  tables.value.forEach((table, index) => {
    const tableBlock = [
      '<section class="embedded-table-block">',
      `<div class="embedded-table-label">原表格 ${index + 1}</div>`,
      table.html,
      '</section>',
    ].join('')
    output = output.split(escapeHtml(table.marker)).join(tableBlock)
  })
  return output
})

function replaceTableMarkersWithPlain(value: string): string {
  let output = value
  for (const table of tables.value) {
    output = output.split(table.marker).join(table.plain_text)
  }
  return output
}

function tablesInContent(value: string): ExtractedDocumentTable[] {
  return tables.value
    .map((table) => ({ table, position: value.indexOf(table.marker) }))
    .filter((entry) => entry.position >= 0)
    .sort((left, right) => left.position - right.position)
    .map((entry) => entry.table)
}

async function extract() {
  if (!props.file) {
    status.value = '请先选择 DOCX 文件。'
    return
  }
  loading.value = true
  status.value = '正在从后端提取 Word 内容…'
  try {
    const response = await extractDocument(props.file)
    text.value = response.text
    originalText.value = response.text
    tables.value = response.tables
    status.value = `提取完成，共 ${response.character_count} 字，保留 ${response.tables.length} 个原表格。`
  } catch (error) {
    status.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

async function applyFilter(type: ContentFilter) {
  if (type === 'restore') {
    text.value = originalText.value
    status.value = originalText.value ? '已恢复原文。' : '暂无原文可恢复。'
    return
  }
  if (!text.value.trim()) {
    status.value = '请先提取或粘贴内容。'
    return
  }
  if (type === 'removeReminders' || type === 'removeMaterials') {
    const result = removeSection(
      text.value,
      type === 'removeReminders' ? '工作提醒' : '发放材料',
      type === 'removeReminders' ? '发放材料' : undefined,
    )
    if (result === null) {
      status.value = '没有找到对应章节。'
      return
    }
    text.value = result
    status.value = '章节已删除。'
    return
  }

  const blocks = splitTextBlocks(text.value)
  if (type === 'student') {
    if (!props.aiConfigured) {
      status.value = '后端尚未配置 AI Key。'
      return
    }
    loading.value = true
    status.value = 'AI 正在筛选学生事项…'
    try {
      const candidates = blocks.map((content, index) => ({
        uid: String(index + 1),
        content: replaceTableMarkersWithPlain(content),
      }))
      const response = await classifyItems(candidates, 'student')
      const kept = blocks.filter((_, index) => response.kept_ids.includes(String(index + 1)))
      text.value = kept.join('\n\n')
      status.value = `AI 从 ${blocks.length} 个条目块中保留 ${kept.length} 个。`
    } catch (error) {
      status.value = (error as Error).message
    } finally {
      loading.value = false
    }
    return
  }

}

async function generate() {
  const blocks = splitTextBlocks(text.value)
  if (!blocks.length) {
    status.value = '请先准备需要生成的内容。'
    return
  }
  loading.value = true
  status.value = '后端正在逐条生成并检查漏项…'
  try {
    const response = await generateNotice(
      blocks.map((content, index) => ({
        uid: String(index + 1),
        content,
        tables_html: tablesInContent(content).map((table) => table.html),
      })),
      props.settings,
      'content',
    )
    emit('result', { ...response, source: 'content' })
    status.value = response.missing_item_ids.length
      ? `生成完成，但仍需复核 ${response.missing_item_ids.length} 个条目。`
      : '生成完成，未检测到漏项。'
  } catch (error) {
    status.value = (error as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:px-6" type="button" :aria-expanded="open" aria-controls="content-workflow" @click="open = !open">
      <span class="flex min-w-0 items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-white"><Columns2 :size="19" aria-hidden="true" /></span>
        <span class="min-w-0"><strong class="block text-base font-bold text-slate-950">内容筛选生成</strong><small class="mt-0.5 block text-xs leading-5 font-normal text-slate-500 sm:text-sm">提取全文，在文本和格式预览中交叉复核</small></span>
      </span>
      <ChevronDown :size="18" class="shrink-0 text-slate-500 transition-transform duration-200" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
    </button>
    <div v-if="open" id="content-workflow" class="grid gap-5 border-t border-slate-100 px-5 py-5 sm:px-6">
      <div class="flex flex-wrap gap-2">
        <UiButton variant="primary" :disabled="loading" @click="extract"><FileSearch :size="16" aria-hidden="true" />提取 Word 内容</UiButton>
        <UiButton variant="outline" :disabled="loading" @click="applyFilter('restore')"><RotateCcw :size="16" aria-hidden="true" />恢复原文</UiButton>
        <UiButton variant="outline" :disabled="loading" @click="applyFilter('removeReminders')"><Trash2 :size="16" aria-hidden="true" />删除工作提醒</UiButton>
        <UiButton variant="outline" :disabled="loading" @click="applyFilter('removeMaterials')"><Trash2 :size="16" aria-hidden="true" />删除发放材料</UiButton>
        <UiButton variant="secondary" :disabled="loading" @click="applyFilter('student')"><Sparkles :size="16" aria-hidden="true" />AI：仅学生事项</UiButton>
      </div>
      <div class="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-2">
        <div class="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div class="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <span><strong class="block text-sm text-slate-900">可编辑文本</strong><small class="mt-1 block text-xs font-normal text-slate-500">表格占位符代表原文位置，请勿修改。</small></span>
          </div>
          <textarea
            v-model="text"
            class="block min-h-[470px] w-full resize-y border-0 bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            rows="18"
            placeholder="请先提取 Word 内容，也可以直接粘贴文本。"
          />
        </div>
        <div class="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div class="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <span><strong class="block text-sm text-slate-900">格式预览</strong><small class="mt-1 block text-xs font-normal text-slate-500">文本实时同步，表格保留原始行列结构。</small></span>
            <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800"><Table2 :size="13" aria-hidden="true" />{{ activeTableCount }} / {{ tables.length }}</span>
          </div>
          <div v-if="text.trim()" class="document-preview min-h-[470px] max-h-[680px] overflow-auto bg-white p-5 text-sm leading-7 text-slate-700" v-html="previewHtml" />
          <div v-else class="grid min-h-[470px] place-items-center bg-white p-6 text-center text-sm text-slate-400">提取内容后在这里核对表格格式。</div>
        </div>
      </div>
      <div class="flex flex-col justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500 sm:flex-row">
        <span>{{ status }}</span><span class="shrink-0 font-semibold text-slate-600">当前约 {{ characterCount }} 字</span>
      </div>
      <UiButton variant="primary" size="lg" class="w-full" :disabled="loading || !aiConfigured" @click="generate">
        <WandSparkles :size="18" aria-hidden="true" />{{ loading ? '处理中…' : '根据筛选内容生成通知' }}
      </UiButton>
    </div>
  </section>
</template>
