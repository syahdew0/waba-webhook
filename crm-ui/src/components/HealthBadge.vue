<script setup>
defineProps({
  dbHealth: {
    type: Object,
    default: null
  }
});
</script>

<template>
  <div class="crm-card p-4">
    <p class="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">DB Health</p>
    <div class="mt-2 flex items-center gap-2">
      <span
        class="inline-flex h-2.5 w-2.5 rounded-full"
        :class="dbHealth?.ok ? 'bg-emerald-500' : 'bg-rose-500'"
      />
      <p class="font-mono text-xl font-semibold" :class="dbHealth?.ok ? 'text-emerald-600' : 'text-rose-600'">
        {{ dbHealth?.ok ? 'UP' : 'DOWN' }}
      </p>
    </div>

    <div v-if="dbHealth?.stats" class="mt-4 grid grid-cols-2 gap-2 text-sm">
      <div class="rounded-lg bg-[#f8f2ea] px-3 py-2 dark:bg-slate-800">
        <p class="text-slate-500 dark:text-slate-400">Events</p>
        <p class="font-semibold text-slate-800 dark:text-slate-100">{{ dbHealth.stats.webhook_events_total }}</p>
      </div>
      <div class="rounded-lg bg-[#f8f2ea] px-3 py-2 dark:bg-slate-800">
        <p class="text-slate-500 dark:text-slate-400">Messages</p>
        <p class="font-semibold text-slate-800 dark:text-slate-100">{{ dbHealth.stats.wa_messages_total }}</p>
      </div>
    </div>
  </div>
</template>
