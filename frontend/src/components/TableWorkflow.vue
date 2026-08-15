<script setup lang="ts">
import { computed, ref } from 'vue'

import { classifyItems, exportWorkbook, generateNotice, parseDocument } from '../services/api'
import type { FilterType, GeneratedResult, GenerationSettings, ParsedItem, SortType } from '../types'
import { monthDayValue } from '../utils/text'

const props = defineProps<{
  file: File | null
  settings: GenerationSettings
  aiConfigured: boolean
}>()
const emit = defineEmits<{ result: [value: GeneratedResult] }>()

const open = ref(true)
const loading = ref(false)
const status = ref('请先上传 Word 并解析预览。')
const items = ref<ParsedItem[]>([])
const selected = ref<Set<string>>(new Set())
const aiSuggested = ref<Set<string>>(new Set())
const sortType = ref<SortType>('original')
const customOrder = ref<string[]>([])
const dragIndex = ref<number | null>(null)
const previewOpen = ref(false)

const outputFilename = computed(() => {
  const sourceFilename = props.file?.name.trim()
  if (!sourceFilename) return '通知整理.xlsx'
  return /\.docx$/i.test(sourceFilename)
    ? sourceFilename.replace(/\.docx$/i, '.xlsx')
    : `${sourceFilename}.xlsx`
})

const displayedItems = computed(() => {
  if (sortType.value === 'time') {
    return [...items.value].sort((a, b) => monthDayValue(a.time) - monthDayValue(b.time))
  }
  if (sortType.value === 'custom') {
    const map = new Map(items.value.map((item) => [item.uid, item]))
    return customOrder.value.map((uid) => map.get(uid)).filter((item): item is ParsedItem => Boolean(item))
  }
  return [...items.value].sort((a, b) => a.raw_position - b.raw_position)
})

const selectedItems = computed(() => displayedItems.value.filter((item) => selected.value.has(item.uid)))

async function parse() {
  if (!props.file) {
    status.value = '请先选择 DOCX 文件。'
    return
  }
  loading.value = true
  status.value = '后端正在解析 Word 结构和表格…'
  try {
    const response = await parseDocument(props.file)
    items.value = response.items
    selected.value = new Set(response.items.map((item) => item.uid))
    customOrder.value = response.items.map((item) => item.uid)
    const cut = response.cut_info.keyword
      ? `；在第 ${response.cut_info.paragraph_index} 段检测到“${response.cut_info.keyword}”并截断`
      : ''
    status.value = `解析完成：${response.items.length} 条，表格 ${response.table_report.converted}/${response.table_report.found}${cut}。`
  } catch (error) {
    status.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

function toggle(uid: string, checked: boolean) {
  const next = new Set(selected.value)
  checked ? next.add(uid) : next.delete(uid)
  selected.value = next
}

function clearSelection() {
  selected.value = new Set()
}

function selectAll() {
  selected.value = new Set(displayedItems.value.map((item) => item.uid))
}

async function aiFilter(filterType: FilterType) {
  if (!items.value.length || !props.aiConfigured) return
  loading.value = true
  status.value = 'AI 正在判断事项对象…'
  try {
    const response = await classifyItems(items.value, filterType)
    selected.value = new Set(response.kept_ids)
    aiSuggested.value = new Set(response.kept_ids)
    status.value = `AI 从 ${items.value.length} 条中推荐 ${response.kept_ids.length} 条，请人工复核。`
  } catch (error) {
    status.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

function drop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex || sortType.value !== 'custom') return
  const next = [...customOrder.value]
  const [moved] = next.splice(dragIndex.value, 1)
  next.splice(targetIndex, 0, moved)
  customOrder.value = next
  dragIndex.value = null
}

function showCategory(index: number): boolean {
  if (sortType.value !== 'original') return false
  const current = displayedItems.value[index]
  const previous = displayedItems.value[index - 1]
  return index === 0 || current.category !== previous?.category || current.subcategory !== previous?.subcategory
}

async function exportExcel() {
  if (!displayedItems.value.length) return
  loading.value = true
  try {
    await exportWorkbook(displayedItems.value, outputFilename.value, props.file?.name || '', sortType.value)
    status.value = 'Excel 已导出。'
  } catch (error) {
    status.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

async function generate() {
  if (!selectedItems.value.length) {
    status.value = '请至少勾选一条事项。'
    return
  }
  loading.value = true
  status.value = '后端正在生成通知并保留原表格…'
  try {
    const response = await generateNotice(selectedItems.value, props.settings, 'table')
    emit('result', { ...response, source: 'table' })
    status.value = '通知生成完成。'
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
      <span><strong>表格选择生成</strong><small>逐条复核、排序、AI 辅助选择并导出 Excel</small></span>
      <span>{{ open ? '收起' : '展开' }}</span>
    </button>
    <div v-if="open" class="section-body form-stack">
      <div class="button-row">
        <button class="btn primary" type="button" :disabled="loading" @click="parse">解析预览</button>
      </div>
      <div class="button-row wrap">
        <button class="btn secondary" type="button" :disabled="loading || !aiConfigured || !items.length" @click="aiFilter('student')">学生事项</button>
        <button class="btn secondary" type="button" :disabled="loading || !aiConfigured || !items.length" @click="aiFilter('graduate')">毕业班</button>
        <button class="btn secondary" type="button" :disabled="loading || !aiConfigured || !items.length" @click="aiFilter('nonGraduate')">非毕业班</button>
        <button class="btn secondary" type="button" :disabled="loading || !aiConfigured || !items.length" @click="aiFilter('departmentRecruitment')">院系招募/汇总</button>
        <button class="btn ghost" type="button" :disabled="!items.length" @click="selectAll">全选</button>
        <button class="btn ghost" type="button" :disabled="!items.length" @click="clearSelection">取消全选</button>
      </div>
      <div class="button-row between">
        <label class="inline">排序
          <select v-model="sortType">
            <option value="original">原文档顺序</option>
            <option value="time">时间顺序</option>
            <option value="custom">自定义拖拽</option>
          </select>
        </label>
        <span class="muted">已选择 {{ selectedItems.length }} / {{ items.length }} 条</span>
      </div>
      <p class="status-line">{{ status }}</p>

      <div v-if="items.length" class="table-scroll">
        <table class="data-table">
          <thead><tr><th>选择</th><th>编号</th><th>时间</th><th>对象分类</th><th>工作概述</th><th>内容</th></tr></thead>
          <tbody>
            <template v-for="(item, index) in displayedItems" :key="item.uid">
              <tr v-if="showCategory(index)" class="category-row">
                <td colspan="6">{{ item.category }}<span v-if="item.subcategory"> / {{ item.subcategory }}</span></td>
              </tr>
              <tr
                :class="{ suggested: aiSuggested.has(item.uid), draggable: sortType === 'custom' }"
                :draggable="sortType === 'custom'"
                @dragstart="dragIndex = index"
                @dragover.prevent
                @drop="drop(index)"
              >
                <td><input type="checkbox" :checked="selected.has(item.uid)" @change="toggle(item.uid, ($event.target as HTMLInputElement).checked)" /></td>
                <td>{{ item.number }}</td>
                <td>{{ item.time || '未明确' }}</td>
                <td>{{ item.category || '未分类' }}</td>
                <td>{{ item.summary }}</td>
                <td class="content-cell" v-html="item.content_html" />
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="items.length" class="button-row wrap">
        <button class="btn secondary" type="button" :disabled="loading" @click="previewOpen = !previewOpen">{{ previewOpen ? '关闭预览' : '预览勾选内容' }}</button>
        <button class="btn secondary" type="button" :disabled="loading" @click="exportExcel">导出 Excel</button>
        <button class="btn primary" type="button" :disabled="loading || !aiConfigured" @click="generate">根据勾选事项生成通知</button>
      </div>
      <div v-if="previewOpen" class="selection-preview">
        <article v-for="item in selectedItems" :key="item.uid">
          <strong>{{ item.number }}. {{ item.summary }}</strong>
          <div v-html="item.content_html" />
        </article>
      </div>
    </div>
  </section>
</template>
