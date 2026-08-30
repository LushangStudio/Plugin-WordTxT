<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpDown, Building2, CheckCheck, ChevronDown, Eye, FileSearch, FileSpreadsheet, GraduationCap, Sparkles, UserRound, WandSparkles, X } from '@lucide/vue'

import { classifyItems, exportWorkbook, generateNotice, parseDocument } from '../services/api'
import type { FilterType, GeneratedResult, GenerationSettings, ParsedItem, SortType } from '../types'
import { monthDayValue } from '../utils/text'
import UiButton from './ui/UiButton.vue'

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
  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:px-6" type="button" :aria-expanded="open" aria-controls="table-workflow" @click="open = !open">
      <span class="flex min-w-0 items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-white"><FileSpreadsheet :size="19" aria-hidden="true" /></span>
        <strong class="block min-w-0 truncate text-base leading-6 font-bold text-slate-950">表格选择生成</strong>
      </span>
      <ChevronDown :size="18" class="shrink-0 text-slate-500 transition-transform duration-200" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
    </button>
    <div v-if="open" id="table-workflow" class="grid gap-5 border-t border-slate-100 px-5 py-5 sm:px-6">
      <div class="flex flex-wrap gap-2">
        <UiButton variant="primary" :disabled="loading" @click="parse"><FileSearch :size="16" aria-hidden="true" />解析预览</UiButton>
        <UiButton variant="secondary" :disabled="loading || !aiConfigured || !items.length" @click="aiFilter('student')"><Sparkles :size="16" aria-hidden="true" />学生事项</UiButton>
        <UiButton variant="secondary" :disabled="loading || !aiConfigured || !items.length" @click="aiFilter('graduate')"><GraduationCap :size="16" aria-hidden="true" />毕业班</UiButton>
        <UiButton variant="secondary" :disabled="loading || !aiConfigured || !items.length" @click="aiFilter('nonGraduate')"><UserRound :size="16" aria-hidden="true" />非毕业班</UiButton>
        <UiButton variant="secondary" :disabled="loading || !aiConfigured || !items.length" @click="aiFilter('departmentRecruitment')"><Building2 :size="16" aria-hidden="true" />院系招募/汇总</UiButton>
      </div>
      <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <label class="flex items-center gap-2 text-sm font-semibold text-slate-700"><ArrowUpDown :size="16" aria-hidden="true" />排序
            <select v-model="sortType" class="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="original">原文档顺序</option>
              <option value="time">时间顺序</option>
              <option value="custom">自定义拖拽</option>
            </select>
          </label>
          <UiButton variant="ghost" size="sm" :disabled="!items.length" @click="selectAll"><CheckCheck :size="15" aria-hidden="true" />全选</UiButton>
          <UiButton variant="ghost" size="sm" :disabled="!items.length" @click="clearSelection"><X :size="15" aria-hidden="true" />取消全选</UiButton>
        </div>
        <span class="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">已选择 {{ selectedItems.length }} / {{ items.length }} 条</span>
      </div>
      <p class="m-0 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">{{ status }}</p>

      <div v-if="items.length" class="max-h-[660px] overflow-auto rounded-xl border border-slate-200">
        <table class="data-table w-full border-separate border-spacing-0 text-left text-xs text-slate-700">
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
                <td><input class="size-4 accent-blue-700" type="checkbox" :aria-label="`选择事项 ${item.number}`" :checked="selected.has(item.uid)" @change="toggle(item.uid, ($event.target as HTMLInputElement).checked)" /></td>
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

      <div v-if="items.length" class="flex flex-wrap gap-2">
        <UiButton variant="outline" :disabled="loading" @click="previewOpen = !previewOpen"><Eye :size="16" aria-hidden="true" />{{ previewOpen ? '关闭预览' : '预览勾选内容' }}</UiButton>
        <UiButton variant="secondary" :disabled="loading" @click="exportExcel"><FileSpreadsheet :size="16" aria-hidden="true" />导出 Excel</UiButton>
        <UiButton variant="primary" :disabled="loading || !aiConfigured" @click="generate"><WandSparkles :size="16" aria-hidden="true" />根据勾选事项生成通知</UiButton>
      </div>
      <div v-if="previewOpen" class="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <article v-for="item in selectedItems" :key="item.uid" class="border-b border-blue-100 pb-3 text-sm leading-7 last:border-0 last:pb-0">
          <strong class="text-slate-900">{{ item.number }}. {{ item.summary }}</strong>
          <div class="mt-1 text-slate-600" v-html="item.content_html" />
        </article>
      </div>
    </div>
  </section>
</template>
