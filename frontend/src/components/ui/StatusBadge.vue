<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
}>(), {
  tone: 'neutral',
})

const toneClass = computed(() => ({
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
}[props.tone]))
</script>

<template>
  <span :class="['inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', toneClass]">
    <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
    <slot />
  </span>
</template>
