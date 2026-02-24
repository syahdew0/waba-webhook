<script setup>
import { ref } from "vue";

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

const emit = defineEmits(["select", "open-wa"]);
const newWaId = ref("");
const newWaIdError = ref("");

function onSelect(item) {
  emit("select", item.wa_id);
}

function normalizeWaId(value) {
  return String(value || "").replace(/\D/g, "");
}

function openNewChat() {
  const waId = normalizeWaId(newWaId.value);
  if (!waId || waId.length < 8) {
    newWaIdError.value = "Nomor WA tidak valid. Gunakan format negara, contoh: 628123...";
    return;
  }

  newWaIdError.value = "";
  emit("open-wa", waId);
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

    <div class="mb-3 rounded-xl border border-[#e7dbcd] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        New Chat
      </p>
      <div class="flex items-center gap-2">
        <input
          v-model.trim="newWaId"
          type="text"
          inputmode="numeric"
          class="w-full rounded-lg border border-[#dccbb8] bg-white px-3 py-2 text-sm outline-none ring-orange-300 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="6281234567890"
          @keyup.enter="openNewChat"
        />
        <button
          type="button"
          class="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
          @click="openNewChat"
        >
          Open
        </button>
      </div>
      <p v-if="newWaIdError" class="mt-2 text-xs text-rose-600 dark:text-rose-400">
        {{ newWaIdError }}
      </p>
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
