<script setup>
import { computed, ref, watch } from "vue";
import { TEMPLATE_PRESETS as FALLBACK_TEMPLATE_PRESETS } from "../config/templatePresets";

const emit = defineEmits(["reply", "send-text", "send-template", "clear-reply"]);

const props = defineProps({
  waId: {
    type: String,
    default: null
  },
  messages: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  replyTo: {
    type: Object,
    default: null
  },
  sending: {
    type: Boolean,
    default: false
  },
  sendError: {
    type: String,
    default: ""
  },
  templatePresets: {
    type: Array,
    default: () => []
  }
});

const draft = ref("");
const mode = ref("text");
const templateName = ref("welcome");
const templateLanguage = ref("en");
const templateBodyParamsRaw = ref("");
const presets = computed(() => (props.templatePresets?.length ? props.templatePresets : FALLBACK_TEMPLATE_PRESETS));
const selectedPresetKey = ref("custom");
const canSend = computed(() => draft.value.trim().length > 0);
const canSendTemplate = computed(() => templateName.value.trim().length > 0);
const statusClassMap = {
  sent: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  delivered: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  read: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};
const messageById = computed(() => {
  const map = new Map();
  for (const msg of props.messages) {
    map.set(msg.message_id, msg);
  }
  return map;
});

function applyPreset(preset) {
  if (!preset) return;
  templateName.value = preset.templateName;
  templateLanguage.value = preset.languageCode;
}

watch(
  () => presets.value,
  (list) => {
    if (!Array.isArray(list) || list.length === 0) return;
    const current = list.find((x) => x.key === selectedPresetKey.value) || list[0];
    selectedPresetKey.value = current.key;
    applyPreset(current);
  },
  { immediate: true }
);

function findReplySource(msg) {
  const sourceId = msg.context_message_id || msg.raw_message?.context?.id || null;
  if (!sourceId) return null;
  const src = messageById.value.get(sourceId);
  if (!src) {
    return {
      id: sourceId,
      text: `[${sourceId}]`
    };
  }
  return {
    id: sourceId,
    text: src.text || src.interactive_title || `[${sourceId}]`
  };
}

function onSend() {
  if (mode.value === "text") {
    if (!canSend.value) return;
    emit("send-text", draft.value.trim());
    draft.value = "";
    return;
  }

  if (!canSendTemplate.value) return;
  const bodyParams = templateBodyParamsRaw.value
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  emit("send-template", {
    templateName: templateName.value.trim(),
    languageCode: templateLanguage.value.trim() || "en",
    bodyParams,
  });
}

function onTemplatePresetChange() {
  if (selectedPresetKey.value === "custom") return;
  const preset = presets.value.find((x) => x.key === selectedPresetKey.value);
  if (!preset) return;
  applyPreset(preset);
}

function onTemplateNameManualInput() {
  selectedPresetKey.value = "custom";
}

function onTemplateLanguageManualInput() {
  selectedPresetKey.value = "custom";
}

function onReply(msg) {
  emit("reply", msg);
}

function onClearReply() {
  emit("clear-reply");
}

function statusClass(status) {
  return statusClassMap[status] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function displayStatus(msg) {
  if (msg.direction !== "outbound") return null;
  if (msg.status === "sent" || msg.status === "delivered" || msg.status === "read") return msg.status;
  return null;
}
</script>

<template>
  <div class="crm-card flex h-[calc(100vh-2.5rem)] min-h-[560px] flex-col p-4 sm:p-5">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Thread</h2>
      <span class="font-mono text-sm text-slate-500 dark:text-slate-400">{{ waId || '-' }}</span>
    </div>

    <div
      v-if="!waId"
      class="rounded-xl border border-dashed border-[#e6d8c8] bg-[#fffdfa] px-4 py-4 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
    >
      Select conversation to view messages.
    </div>

    <div
      v-else-if="loading"
      class="rounded-xl border border-dashed border-[#e6d8c8] bg-[#fffdfa] px-4 py-4 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
    >
      Loading messages...
    </div>

    <div v-else class="soft-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div
        v-for="msg in messages"
        :key="msg.message_id"
        class="w-full md:w-auto md:max-w-[78%]"
        :class="msg.direction === 'inbound' ? 'self-start' : 'self-end'"
      >
        <div
          class="rounded-2xl border px-4 py-3"
          :class="
            msg.direction === 'inbound'
              ? 'border-[#e7dbcd] bg-white dark:border-slate-700 dark:bg-slate-900'
              : 'border-[#bfded6] bg-[#e9f9f4] dark:border-emerald-900 dark:bg-emerald-950/40'
          "
        >
          <div class="mb-2 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
            <span>{{ msg.direction }}</span>
            <span>{{ msg.message_type }}</span>
            <span
              v-if="displayStatus(msg)"
              class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="statusClass(displayStatus(msg))"
            >
              {{ displayStatus(msg) }}
            </span>
          </div>

          <div class="text-base leading-relaxed text-slate-900 dark:text-slate-100">
            <div
              v-if="findReplySource(msg)"
              class="mb-2 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
            >
              Reply to: {{ findReplySource(msg).text }}
            </div>
            {{ msg.text || msg.interactive_title || '[non-text message]' }}
          </div>

          <div class="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
            {{ msg.ts ? new Date(msg.ts).toLocaleString() : '-' }}
          </div>

          <div v-if="msg.direction === 'inbound'" class="mt-3">
            <button
              type="button"
              class="rounded-full border border-[#dbcab7] bg-white px-3 py-1 text-xs font-semibold text-slate-800 transition hover:border-orange-300 hover:bg-orange-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              @click="onReply(msg)"
            >
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="waId" class="mt-4 border-t border-[#eadccb] pt-3 dark:border-slate-700">
      <div
        v-if="sendError"
        class="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
      >
        {{ sendError }}
      </div>
      <div
        v-if="replyTo"
        class="mb-2 flex items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
      >
        <span class="truncate">Replying to: {{ replyTo.text || replyTo.interactive_title || replyTo.message_id }}</span>
        <button
          type="button"
          class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-orange-300 bg-white text-xs font-bold text-orange-700 dark:border-orange-800 dark:bg-slate-900 dark:text-orange-300"
          @click="onClearReply"
        >
          x
        </button>
      </div>

      <div class="mb-2 flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border px-3 py-1 text-xs font-semibold"
          :class="mode === 'text' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-[#dccbb8] text-slate-600 dark:border-slate-700 dark:text-slate-300'"
          @click="mode = 'text'"
        >
          Text
        </button>
        <button
          type="button"
          class="rounded-lg border px-3 py-1 text-xs font-semibold"
          :class="mode === 'template' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-[#dccbb8] text-slate-600 dark:border-slate-700 dark:text-slate-300'"
          @click="mode = 'template'"
        >
          Template
        </button>
      </div>

      <textarea
        v-if="mode === 'text'"
        v-model="draft"
        class="h-28 w-full resize-y rounded-xl border border-[#dccbb8] bg-white px-3 py-2 text-sm outline-none ring-orange-300 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        :disabled="sending"
        placeholder="Type message..."
      />

      <div v-else class="space-y-2">
        <div>
          <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Template preset
          </label>
          <select
            v-model="selectedPresetKey"
            class="w-full rounded-xl border border-[#dccbb8] bg-white px-3 py-2 text-sm outline-none ring-orange-300 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            :disabled="sending"
            @change="onTemplatePresetChange"
          >
            <option v-for="preset in presets" :key="preset.key" :value="preset.key">
              {{ preset.label }}
            </option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            v-model="templateName"
            class="w-full rounded-xl border border-[#dccbb8] bg-white px-3 py-2 text-sm outline-none ring-orange-300 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            :disabled="sending"
            placeholder="Template name (e.g. welcome)"
            @input="onTemplateNameManualInput"
          />
          <input
            v-model="templateLanguage"
            class="w-full rounded-xl border border-[#dccbb8] bg-white px-3 py-2 text-sm outline-none ring-orange-300 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            :disabled="sending"
            placeholder="Language code (e.g. en)"
            @input="onTemplateLanguageManualInput"
          />
        </div>
        <textarea
          v-model="templateBodyParamsRaw"
          class="h-24 w-full resize-y rounded-xl border border-[#dccbb8] bg-white px-3 py-2 text-sm outline-none ring-orange-300 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          :disabled="sending"
          placeholder="Body params (optional, one per line)"
        />
      </div>

      <div class="mt-2 flex justify-end">
        <button
          type="button"
          class="rounded-xl bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="sending || (mode === 'text' ? !canSend : !canSendTemplate)"
          @click="onSend"
        >
          {{ sending ? 'Sending...' : mode === 'text' ? 'Send' : 'Send Template' }}
        </button>
      </div>
    </div>
  </div>
</template>
