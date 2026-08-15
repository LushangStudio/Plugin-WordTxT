<script setup lang="ts">
defineProps<{
  file: File | null
  backendOnline: boolean
  aiConfigured: boolean
}>()

const emit = defineEmits<{
  fileChange: [file: File | null]
}>()

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  emit('fileChange', input.files?.[0] || null)
}
</script>

<template>
  <section class="card hero-card">
    <div>
      <p class="eyebrow">STUDENT AFFAIRS MEMO</p>
      <h1>学工备忘工作台</h1>
      <p class="hero-copy">上传 Word，复核筛选结果，再生成可直接发送的通知。</p>
    </div>
    <div class="steps" aria-label="使用步骤">
      <div><span>1</span><strong>上传 DOCX</strong></div>
      <div><span>2</span><strong>识别与筛选</strong></div>
      <div><span>3</span><strong>生成通知</strong></div>
    </div>
    <div class="upload-row">
      <label class="file-picker">
        <span>{{ file ? '更换 Word' : '选择 Word' }}</span>
        <input type="file" accept=".docx" @change="onFileChange" />
      </label>
      <div class="file-name">{{ file?.name || '尚未选择文档' }}</div>
      <div class="service-badges">
        <span :class="['badge', backendOnline ? 'success' : 'error']">
          {{ backendOnline ? '后端在线' : '后端离线' }}
        </span>
        <span :class="['badge', aiConfigured ? 'success' : 'warning']">
          {{ aiConfigured ? 'AI 已配置' : 'AI 未配置' }}
        </span>
      </div>
    </div>
  </section>
</template>

