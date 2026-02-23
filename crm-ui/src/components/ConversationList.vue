<script setup>
const statusClassMap = {
  sent: "text-amber-600 dark:text-amber-400",
  delivered: "text-cyan-700 dark:text-cyan-400",
  read: "text-emerald-600 dark:text-emerald-400",
};

defineProps({
  conversations: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  selectedWaId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(["select"]);

function onSelect(item) {
  emit("select", item.wa_id);
}

function statusClass(status) {
  return statusClassMap[status] || "text-slate-500 dark:text-slate-400";
}

function displayStatus(status) {
  if (status === "sent" || status === "delivered" || status === "read") return status;
  return null;
}
</script>

<template>
  <div class="crm-card flex min-h-0 flex-1 flex-col p-4">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Conversations</h2>
      <span class="rounded-full bg-orange-500 px-3 py-0.5 text-sm font-semibold text-white">
        {{ conversations.length }}
      </span>
    </div>

    <div
      v-if="loading"
      class="rounded-xl border border-dashed border-[#e8ddcf] bg-[#fffdfa] px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
    >
      Loading conversations...
    </div>

    <div class="soft-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <button
        v-for="item in conversations"
        :key="item.wa_id"
        type="button"
        class="rounded-xl border px-3 py-3 text-left transition"
        :class="
          selectedWaId === item.wa_id
            ? 'border-orange-400 bg-orange-50 shadow-[0_0_0_2px_rgba(249,115,22,0.12)]'
            : 'border-[#e7dbcd] bg-white hover:border-orange-200 hover:bg-orange-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800/70'
        "
        @click="onSelect(item)"
      >
        <div class="flex items-start justify-between gap-3">
          <p class="truncate text-base font-semibold text-slate-900 dark:text-slate-400">{{ item.profile_name || item.wa_id }}</p>
          <p class="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-800">
            {{ item.last_message_at ? new Date(item.last_message_at).toLocaleString() : '-' }}
          </p>
        </div>

        <p class="mt-1 truncate text-sm text-slate-700 dark:text-slate-300">{{ item.last_message?.text || '(no message text)' }}</p>

        <div class="mt-2 flex items-center justify-between">
          <p class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ item.wa_id }}</p>
          <p
            v-if="displayStatus(item.latest_status)"
            class="text-sm font-semibold"
            :class="statusClass(displayStatus(item.latest_status))"
          >
            {{ displayStatus(item.latest_status) }}
          </p>
        </div>
      </button>
    </div>
  </div>
</template>
