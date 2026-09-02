<script setup lang="ts">
import { FileText, LogOut, Upload, UserRound, X } from '@lucide/vue'

import UiButton from './ui/UiButton.vue'
import type { AuthUser } from '../types'

defineProps<{
  file: File | null
  user: AuthUser
  logoutUrl: string
}>()

const emit = defineEmits<{
  fileChange: [file: File | null]
}>()

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  emit('fileChange', input.files?.[0] || null)
  input.value = ''
}
</script>

<template>
  <header class="border-b border-slate-200/90 bg-white/95 backdrop-blur">
    <div class="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between xl:px-8">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-700 text-white shadow-sm shadow-blue-900/20">
          <FileText :size="22" :stroke-width="1.9" aria-hidden="true" />
        </div>
        <div class="min-w-0">
          <p class="m-0 text-[11px] font-bold tracking-[0.18em] text-blue-700">STUDENT AFFAIRS DESK</p>
          <h1 class="m-0 truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">学工备忘工作台</h1>
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div class="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
          <UserRound :size="16" class="shrink-0 text-blue-700" aria-hidden="true" />
          <div class="min-w-0 leading-tight">
            <p class="m-0 truncate text-sm font-semibold text-slate-900">{{ user.user_name }}</p>
            <p class="m-0 truncate text-xs text-slate-500">{{ user.user_type }}</p>
          </div>
          <form :action="logoutUrl" method="post" class="ml-1">
            <UiButton variant="ghost" size="sm" type="submit" aria-label="退出登录">
              <LogOut :size="15" aria-hidden="true" />
              退出
            </UiButton>
          </form>
        </div>
        <div class="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
          <div v-if="file" class="flex min-w-0 items-center gap-2 px-2 text-sm text-slate-700">
            <FileText :size="16" class="shrink-0 text-blue-700" aria-hidden="true" />
            <span class="max-w-52 truncate" :title="file.name">{{ file.name }}</span>
            <UiButton variant="ghost" size="icon" class="size-7 rounded-lg" aria-label="移除当前文档" @click="emit('fileChange', null)">
              <X :size="15" aria-hidden="true" />
            </UiButton>
          </div>
          <label class="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2">
            <Upload :size="16" aria-hidden="true" />
            {{ file ? '更换文档' : '上传 Word' }}
            <input class="sr-only" type="file" accept=".docx" @change="onFileChange" />
          </label>
        </div>
      </div>
    </div>
  </header>
</template>
