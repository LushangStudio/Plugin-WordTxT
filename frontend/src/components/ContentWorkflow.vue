<script setup lang="ts">
import { computed, ref } from 'vue'

import { classifyItems, extractDocument, generateNotice } from '../services/api'
import type { ExtractedDocumentTable, GeneratedResult, GenerationSettings } from '../types'
import { removeSection, splitTextBlocks } from '../utils/text'

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
  <section class="card collapsible">
    <button class="section-trigger" type="button" @click="open = !open">
      <span><strong>内容筛选生成</strong><small>提取或粘贴 Word 内容，确认后生成通知</small></span>
      <span>{{ open ? '收起' : '展开' }}</span>
    </button>
    <div v-if="open" class="section-body form-stack">
      <div class="button-row wrap">
        <button class="btn primary" type="button" :disabled="loading" @click="extract">提取 Word 内容</button>
        <button class="btn ghost" type="button" :disabled="loading" @click="applyFilter('restore')">恢复原文</button>
        <button class="btn ghost" type="button" :disabled="loading" @click="applyFilter('removeReminders')">删除工作提醒</button>
        <button class="btn ghost" type="button" :disabled="loading" @click="applyFilter('removeMaterials')">删除发放材料</button>
      </div>
      <div class="button-row wrap">
        <button class="btn secondary" type="button" :disabled="loading" @click="applyFilter('student')">AI：仅学生事项</button>
      </div>
      <div class="content-workspace">
        <div class="content-pane editor-pane">
          <div class="pane-heading">
            <span><strong>可编辑文本</strong><small>表格占位符代表原文位置，请勿修改占位符文字。</small></span>
          </div>
          <textarea
            v-model="text"
            class="content-editor"
            rows="18"
            placeholder="请先提取 Word 内容，也可以直接粘贴文本。"
          />
        </div>
        <div class="content-pane preview-pane">
          <div class="pane-heading">
            <span><strong>格式预览</strong><small>文本修改会实时同步，原表格保持 Word 中的行列结构。</small></span>
            <span class="table-count">表格 {{ activeTableCount }} / {{ tables.length }}</span>
          </div>
          <div v-if="text.trim()" class="document-preview" v-html="previewHtml" />
          <div v-else class="document-preview preview-empty">提取内容后在这里核对表格格式。</div>
        </div>
      </div>
      <div class="status-line">
        <span>{{ status }}</span><span>当前约 {{ characterCount }} 字</span>
      </div>
      <button class="btn primary wide" type="button" :disabled="loading || !aiConfigured" @click="generate">
        {{ loading ? '处理中…' : '根据筛选内容生成备忘' }}
      </button>
    </div>
  </section>
</template>
