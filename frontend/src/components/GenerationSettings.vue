<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import type { GenerationSettings } from '../types'

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
  <section class="card collapsible">
    <button class="section-trigger" type="button" @click="open = !open">
      <span><strong>通用生成设置</strong><small>提示词模板、通知开头、通知结尾与联系人规则</small></span>
      <span>{{ open ? '收起' : '展开' }}</span>
    </button>
    <div v-if="open" class="section-body">
      <nav class="settings-tabs" aria-label="通用生成设置区域">
        <button
          type="button"
          :class="{ active: activePanel === 'prompt' }"
          :aria-selected="activePanel === 'prompt'"
          @click="activePanel = 'prompt'"
        >提示词模板</button>
        <button
          type="button"
          :class="{ active: activePanel === 'header' }"
          :aria-selected="activePanel === 'header'"
          @click="activePanel = 'header'"
        >通知开头</button>
        <button
          type="button"
          :class="{ active: activePanel === 'output' }"
          :aria-selected="activePanel === 'output'"
          @click="activePanel = 'output'"
        >通知输出设置</button>
      </nav>

      <div v-if="activePanel === 'prompt'" class="form-stack settings-panel">
        <label>提示词模板
          <select v-model="selectedTemplate">
            <option v-for="(template, key) in templates" :key="key" :value="key">{{ template.name }}</option>
          </select>
        </label>
        <label>处理要求
          <textarea
            :value="settings.userPrompt"
            rows="7"
            @input="update('userPrompt', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
        <div class="button-row">
          <button class="btn secondary" type="button" @click="savePrompt">保存提示词</button>
          <button class="btn ghost" type="button" @click="resetPrompt">恢复默认</button>
        </div>
      </div>

      <div v-else-if="activePanel === 'header'" class="form-stack settings-panel">
        <label>通知开头
          <input :value="settings.header" @input="update('header', ($event.target as HTMLInputElement).value)" />
        </label>
      </div>

      <div v-else class="form-stack settings-panel">
        <label>通知结尾
          <input :value="settings.footer" @input="update('footer', ($event.target as HTMLInputElement).value)" />
        </label>
        <fieldset>
          <legend>联系人处理</legend>
          <label class="inline"><input type="radio" value="keep" :checked="settings.contactMode === 'keep'" @change="update('contactMode', 'keep')" />保留联系人</label>
          <label class="inline"><input type="radio" value="remove" :checked="settings.contactMode === 'remove'" @change="update('contactMode', 'remove')" />删除联系人</label>
        </fieldset>
      </div>
    </div>
  </section>
</template>
