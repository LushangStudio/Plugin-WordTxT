<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronDown, Contact, MessageSquareText, RotateCcw, Save, Settings2, TextQuote } from '@lucide/vue'

import type { GenerationSettings } from '../types'
import UiButton from './ui/UiButton.vue'

const props = defineProps<{ modelValue: GenerationSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: GenerationSettings] }>()

type SettingsPanel = 'prompt' | 'header' | 'output'

const open = ref(true)
const activePanel = ref<SettingsPanel>('prompt')
const selectedTemplate = ref('student')

const templates: Record<string, { name: string; prompt: string }> = {
  student: {
    name: '面向学生通知',
    prompt: '生成可直接发送给学生的通知。保留学生需要参加、报名、提交、办理或知晓的事项，删除纯内部行政说明，不虚构信息。',
  },
  counselor: {
    name: '辅导员待办',
    prompt: '生成辅导员内部待办清单，突出截止时间、对象、具体动作、提交方式、联系人和备注，不要改成学生通知口吻。',
  },
  timeline: {
    name: '事务时间线',
    prompt: '按日期和时间排列学生事务；没有明确时间的事项放在最后，保留地点、方式、材料、链接和注意事项。',
  },
  application: {
    name: '报名与提交',
    prompt: '只整理需要主动报名、申请、提交、填报、预约、领取、缴费或确认的事项，保留适用对象、截止时间、方式和材料。',
  },
  custom: {
    name: '自定义',
    prompt: '严格按照我输入的要求处理，必须依据原文，不得虚构；缺失信息标注“未明确”。',
  },
}

const settings = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

function update<K extends keyof GenerationSettings>(key: K, value: GenerationSettings[K]) {
  settings.value = { ...settings.value, [key]: value }
}

function loadTemplate() {
  const saved = localStorage.getItem(`memo_prompt_${selectedTemplate.value}`)
  update('userPrompt', saved || templates[selectedTemplate.value].prompt)
}

function savePrompt() {
  localStorage.setItem(`memo_prompt_${selectedTemplate.value}`, settings.value.userPrompt)
}

function resetPrompt() {
  localStorage.removeItem(`memo_prompt_${selectedTemplate.value}`)
  update('userPrompt', templates[selectedTemplate.value].prompt)
}

watch(selectedTemplate, loadTemplate)
onMounted(loadTemplate)
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:px-6" type="button" :aria-expanded="open" aria-controls="generation-settings" @click="open = !open">
      <span class="flex min-w-0 items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Settings2 :size="19" aria-hidden="true" /></span>
        <span class="min-w-0"><strong class="block text-base font-bold text-slate-950">通用生成设置</strong><small class="mt-0.5 block text-xs leading-5 font-normal text-slate-500 sm:text-sm">每次只编辑一个区域，切换时内容会自动保留</small></span>
      </span>
      <span class="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
        {{ open ? '收起' : '展开' }}
        <ChevronDown :size="17" class="transition-transform duration-200" :class="open ? 'rotate-180' : ''" aria-hidden="true" />
      </span>
    </button>
    <div v-if="open" id="generation-settings" class="border-t border-slate-100 px-5 py-5 sm:px-6">
      <nav class="grid grid-cols-1 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3" role="tablist" aria-label="通用生成设置区域">
        <button
          type="button"
          role="tab"
          aria-controls="settings-prompt"
          class="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          :class="activePanel === 'prompt' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
          :aria-selected="activePanel === 'prompt'"
          @click="activePanel = 'prompt'"
        ><MessageSquareText :size="16" aria-hidden="true" />提示词模板</button>
        <button
          type="button"
          role="tab"
          aria-controls="settings-header"
          class="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          :class="activePanel === 'header' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
          :aria-selected="activePanel === 'header'"
          @click="activePanel = 'header'"
        ><TextQuote :size="16" aria-hidden="true" />通知开头</button>
        <button
          type="button"
          role="tab"
          aria-controls="settings-output"
          class="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          :class="activePanel === 'output' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
          :aria-selected="activePanel === 'output'"
          @click="activePanel = 'output'"
        ><Contact :size="16" aria-hidden="true" />通知输出设置</button>
      </nav>

      <div v-if="activePanel === 'prompt'" id="settings-prompt" role="tabpanel" class="mt-5 grid gap-4">
        <label class="grid gap-2 text-sm font-semibold text-slate-700">提示词模板
          <select v-model="selectedTemplate" class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            <option v-for="(template, key) in templates" :key="key" :value="key">{{ template.name }}</option>
          </select>
        </label>
        <label class="grid gap-2 text-sm font-semibold text-slate-700">处理要求
          <textarea
            :value="settings.userPrompt"
            rows="7"
            class="min-h-36 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-7 font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            @input="update('userPrompt', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <div class="flex flex-wrap gap-2">
          <UiButton variant="secondary" @click="savePrompt"><Save :size="16" aria-hidden="true" />保存提示词</UiButton>
          <UiButton variant="ghost" @click="resetPrompt"><RotateCcw :size="16" aria-hidden="true" />恢复默认</UiButton>
        </div>
      </div>

      <div v-else-if="activePanel === 'header'" id="settings-header" role="tabpanel" class="mt-5 min-h-40">
        <label class="grid gap-2 text-sm font-semibold text-slate-700">通知开头
          <input class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" :value="settings.header" @input="update('header', ($event.target as HTMLInputElement).value)" />
        </label>
        <p class="mt-3 text-xs leading-5 text-slate-500">这段文字会放在所有生成内容之前，可直接填写称呼或导语。</p>
      </div>

      <div v-else id="settings-output" role="tabpanel" class="mt-5 grid gap-5">
        <label class="grid gap-2 text-sm font-semibold text-slate-700">通知结尾
          <input class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" :value="settings.footer" @input="update('footer', ($event.target as HTMLInputElement).value)" />
        </label>
        <fieldset class="rounded-xl border border-slate-200 p-4">
          <legend class="px-1 text-sm font-semibold text-slate-700">联系人处理</legend>
          <div class="grid gap-2 sm:grid-cols-2">
            <label class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition-colors" :class="settings.contactMode === 'keep' ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"><input class="size-4 accent-blue-700" type="radio" value="keep" :checked="settings.contactMode === 'keep'" @change="update('contactMode', 'keep')" />保留原文联系人</label>
            <label class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold transition-colors" :class="settings.contactMode === 'remove' ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'"><input class="size-4 accent-blue-700" type="radio" value="remove" :checked="settings.contactMode === 'remove'" @change="update('contactMode', 'remove')" />删除联系人信息</label>
          </div>
        </fieldset>
      </div>
    </div>
  </section>
</template>
