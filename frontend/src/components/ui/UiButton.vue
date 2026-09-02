<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils'

defineOptions({ inheritAttrs: false })

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'border border-blue-700 bg-blue-700 text-white shadow-sm hover:bg-blue-800',
        secondary: 'border border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300 hover:bg-blue-100',
        outline: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50',
        ghost: 'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950',
        danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-sm',
        icon: 'size-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'md',
    },
  },
)

type ButtonVariants = VariantProps<typeof buttonVariants>

const props = withDefaults(defineProps<{
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'outline',
  size: 'md',
  type: 'button',
})

const attrs = useAttrs()
const classes = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), attrs.class as string))
</script>

<template>
  <button v-bind="$attrs" :type="type" :class="classes">
    <slot />
  </button>
</template>
