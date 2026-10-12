<script setup lang="ts">
import { ArrowLeft, ChevronDown, FileText, LogOut, Upload, UserRound, X } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'

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

const accountMenu = ref(false)
const accountBlock = ref<HTMLElement | null>(null)
const accountButton = ref<HTMLButtonElement | null>(null)
const appListUrl = import.meta.env.VITE_APP_LIST_URL || '/'
function closeAccount(event: Event) {
  if (event instanceof KeyboardEvent && event.key === 'Escape') {
    accountMenu.value = false
    accountButton.value?.focus()
  } else if (event.type === 'pointerdown' && !accountBlock.value?.contains(event.target as Node)) {
    accountMenu.value = false
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', closeAccount)
  document.addEventListener('keydown', closeAccount)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeAccount)
  document.removeEventListener('keydown', closeAccount)
})

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
        <a :href="appListUrl" class="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
          <ArrowLeft :size="15" aria-hidden="true" />返回应用列表
        </a>
        <div ref="accountBlock" class="relative min-w-0">
        <button ref="accountButton" type="button" aria-label="用户菜单" aria-controls="wordtxt-account-menu" :aria-expanded="accountMenu" class="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" @click="accountMenu = !accountMenu">
          <UserRound :size="16" class="shrink-0 text-blue-700" aria-hidden="true" />
          <div class="min-w-0 leading-tight">
            <p class="m-0 truncate text-sm font-semibold text-slate-900">{{ user.user_name }}</p>
            <p class="m-0 truncate text-xs text-slate-500">{{ user.user_type }}</p>
          </div>
          <ChevronDown :size="15" class="ml-2 shrink-0 text-slate-500" aria-hidden="true" />
        </button>
          <form v-if="accountMenu" id="wordtxt-account-menu" :action="logoutUrl" method="post" class="absolute right-0 z-30 mt-2 min-w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/10">
            <UiButton variant="danger" size="md" type="submit" class="w-full" aria-label="退出复旦UIS">
              <LogOut :size="15" aria-hidden="true" />
              退出复旦UIS
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
