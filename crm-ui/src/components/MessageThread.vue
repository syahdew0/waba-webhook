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
const templateParamValues = ref([]);
const presets = computed(() => (props.templatePresets?.length ? props.templatePresets : FALLBACK_TEMPLATE_PRESETS));
function normalizeLangCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function langBase(value) {
  return normalizeLangCode(value).split("-")[0] || "";
}

const templatePresetMap = computed(() => {
  const map = new Map();
  for (const preset of presets.value) {
    const name = String(preset?.templateName || "").trim();
    const lang = normalizeLangCode(preset?.languageCode);
    if (!name) continue;
    if (lang) map.set(`${name}:${lang}`, preset);
    if (!map.has(name)) map.set(name, preset);
  }
  return map;
});
const selectedPresetKey = ref("custom");
const canSend = computed(() => draft.value.trim().length > 0);
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
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

const latestInboundMessage = computed(() => {
  let latest = null;
  for (const msg of props.messages) {
    if (msg.direction !== "inbound") continue;
    const ts = msg.ts ? new Date(msg.ts) : null;
    if (!ts || Number.isNaN(ts.getTime())) continue;
    if (!latest || ts.getTime() > latest.ts.getTime()) {
      latest = { msg, ts };
    }
  }
  return latest;
});

const textWindow = computed(() => {
  if (!props.waId) {
    return { canSendText: false, reason: null };
  }

  const latestInbound = latestInboundMessage.value;
  if (!latestInbound) {
    return {
      canSendText: false,
      reason: "Belum ada pesan inbound. Gunakan template message untuk memulai percakapan."
    };
  }

  const diffMs = Date.now() - latestInbound.ts.getTime();
  if (diffMs > WINDOW_24H_MS) {
    return {
      canSendText: false,
      reason: "Conversation window 24 jam sudah tutup. Gunakan template message untuk memulai percakapan."
    };
  }

  return { canSendText: true, reason: null };
});

const textModeBlocked = computed(() => !textWindow.value.canSendText);
const selectedPreset = computed(() =>
  presets.value.find((x) => x.key === selectedPresetKey.value) || null
);
const templateParamSchema = computed(() => {
  const preset = selectedPreset.value;
  if (!preset) return [];

  const indexes = Array.isArray(preset.bodyParamIndexes) ? preset.bodyParamIndexes : [];
  const keys = Array.isArray(preset.bodyParamKeys) ? preset.bodyParamKeys : [];
  const count = Number(preset.bodyParamCount || 0);

  if (indexes.length > 0) {
    return indexes.map((n, idx) => ({
      index: n,
      key: keys[idx] || `{{${n}}}`,
      label: `Param ${n}`,
      placeholder: keys[idx] || `{{${n}}}`,
      sample: Array.isArray(preset.bodyParamExampleValues) ? preset.bodyParamExampleValues[idx] || "" : "",
    }));
  }

  if (count > 0) {
    return Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      key: `{{${i + 1}}}`,
      label: `Param ${i + 1}`,
      placeholder: `{{${i + 1}}}`,
      sample: "",
    }));
  }

  return [];
});
const useAutoTemplateParams = computed(
  () => mode.value === "template" && selectedPresetKey.value !== "custom" && templateParamSchema.value.length > 0
);
const canSendTemplate = computed(() => {
  if (!templateName.value.trim()) return false;
  if (!useAutoTemplateParams.value) return true;
  return templateParamSchema.value.every((_, idx) => String(templateParamValues.value[idx] || "").trim().length > 0);
});

function applyPreset(preset) {
  if (!preset) return;
  templateName.value = preset.templateName;
  templateLanguage.value = preset.languageCode;
}

function syncTemplateParamValuesFromPreset(preset) {
  if (!preset) {
    templateParamValues.value = [];
    return;
  }
  const schemaCount = templateParamSchema.value.length;
  if (!schemaCount) {
    templateParamValues.value = [];
    return;
  }
  const examples = Array.isArray(preset.bodyParamExampleValues) ? preset.bodyParamExampleValues : [];
  templateParamValues.value = templateParamSchema.value.map((_, idx) => examples[idx] || "");
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

watch(
  () => selectedPreset.value,
  (preset) => {
    if (selectedPresetKey.value === "custom") return;
    syncTemplateParamValuesFromPreset(preset);
  },
  { immediate: true }
);

watch(
  () => [props.waId, props.messages, textModeBlocked.value],
  () => {
    if (textModeBlocked.value && mode.value === "text") {
      mode.value = "template";
    }
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
    text: getMessagePreviewText(src) || `[${sourceId}]`
  };
}

function getRawMessageObject(msg) {
  const raw = msg?.raw_message;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function renderTemplateBody(bodyText, bodyParams) {
  if (!bodyText) return "";
  return String(bodyText).replace(/{{\s*(\d+)\s*}}/g, (_, n) => {
    const idx = Number(n) - 1;
    const value = Array.isArray(bodyParams) ? bodyParams[idx] : "";
    return String(value ?? "").trim() || `{{${n}}}`;
  });
}

function getTemplatePresetForMessage(raw) {
  const name = String(raw?.template?.name || "").trim();
  const lang = normalizeLangCode(raw?.template?.language?.code);
  if (!name) return null;

  if (lang) {
    const exact = templatePresetMap.value.get(`${name}:${lang}`);
    if (exact) return exact;

    const base = langBase(lang);
    if (base && base !== lang) {
      const byBaseKey = templatePresetMap.value.get(`${name}:${base}`);
      if (byBaseKey) return byBaseKey;
    }
  }

  const direct = templatePresetMap.value.get(name);
  if (direct) return direct;

  const msgLangBase = langBase(lang);
  return (
    presets.value.find((preset) => {
      if (String(preset?.templateName || "").trim() !== name) return false;
      if (!lang) return true;
      const presetLang = normalizeLangCode(preset?.languageCode);
      return presetLang === lang || (msgLangBase && langBase(presetLang) === msgLangBase);
    }) || null
  );
}

function getTemplateBodyParams(raw) {
  const direct = raw?.template?.body_params;
  if (Array.isArray(direct)) return direct.map((x) => String(x ?? ""));

  const components = Array.isArray(raw?.template?.components) ? raw.template.components : [];
  const bodyComp = components.find((c) => String(c?.type || "").toUpperCase() === "BODY");
  const params = Array.isArray(bodyComp?.parameters) ? bodyComp.parameters : [];
  return params.map((p) => String(p?.text ?? ""));
}

function getMessagePreviewText(msg) {
  const raw = getRawMessageObject(msg);

  if (msg?.message_type === "template" && raw) {
    const templateName = String(raw?.template?.name || "").trim();
    const preset = getTemplatePresetForMessage(raw);
    const bodyText = String(preset?.bodyText || "").trim();
    if (bodyText) {
      return renderTemplateBody(bodyText, getTemplateBodyParams(raw));
    }
    if (templateName) return `[template:${templateName}]`;
  }

  if (msg?.text) return msg.text;
  if (msg?.interactive_title) return msg.interactive_title;
  if (!raw) return "";

  if (msg?.message_type === "button") {
    return String(raw?.button?.text || raw?.button?.payload || "").trim();
  }

  if (msg?.message_type === "interactive") {
    const title =
      raw?.interactive?.button_reply?.title ||
      raw?.interactive?.list_reply?.title ||
      raw?.interactive?.nfm_reply?.name ||
      "";
    if (String(title).trim()) return String(title).trim();
  }

  return "";
}

function onSend() {
  if (mode.value === "text") {
    if (textModeBlocked.value) {
      mode.value = "template";
      return;
    }
    if (!canSend.value) return;
    emit("send-text", draft.value.trim());
    draft.value = "";
    return;
  }

  if (!canSendTemplate.value) return;
  const bodyParams = useAutoTemplateParams.value
    ? templateParamValues.value.map((x) => String(x || "").trim())
    : templateBodyParamsRaw.value
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
  syncTemplateParamValuesFromPreset(preset);
}

function onTemplateNameManualInput() {
  selectedPresetKey.value = "custom";
  templateParamValues.value = [];
}

function onTemplateLanguageManualInput() {
  selectedPresetKey.value = "custom";
  templateParamValues.value = [];
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

          <div class="text-base leading-relaxed whitespace-pre-wrap text-slate-900 dark:text-slate-100">
            <div
              v-if="findReplySource(msg)"
              class="mb-2 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300"
            >
              Reply to: {{ findReplySource(msg).text }}
            </div>
            {{ getMessagePreviewText(msg) || `[${msg.message_type || "non-text"} message]` }}
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
        v-if="textModeBlocked && textWindow.reason"
        class="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
      >
        {{ textWindow.reason }}
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
          :disabled="textModeBlocked"
          :class="[
            mode === 'text'
              ? 'border-orange-400 bg-orange-50 text-orange-700'
              : 'border-[#dccbb8] text-slate-600 dark:border-slate-700 dark:text-slate-300',
            textModeBlocked ? 'cursor-not-allowed opacity-50' : ''
          ]"
          @click="!textModeBlocked && (mode = 'text')"
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
        :disabled="sending || textModeBlocked"
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
        <div
          v-if="selectedPreset && selectedPreset.bodyText"
          class="rounded-xl border border-[#eadccb] bg-[#fffdfa] px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Template Body Preview
          </p>
          <pre class="whitespace-pre-wrap break-words font-mono text-xs">{{ selectedPreset.bodyText }}</pre>
        </div>
        <div v-if="useAutoTemplateParams" class="space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Body Parameters ({{ templateParamSchema.length }})
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Auto-detected from template placeholder
            </p>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div v-for="(field, idx) in templateParamSchema" :key="field.key" class="space-y-1">
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                {{ field.placeholder }}
              </label>
              <input
                v-model="templateParamValues[idx]"
                class="w-full rounded-xl border border-[#dccbb8] bg-white px-3 py-2 text-sm outline-none ring-orange-300 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                :disabled="sending"
                :placeholder="field.sample || field.label"
              />
            </div>
          </div>
        </div>
        <textarea
          v-else
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
          :disabled="sending || (mode === 'text' ? (textModeBlocked || !canSend) : !canSendTemplate)"
          @click="onSend"
        >
          {{ sending ? 'Sending...' : mode === 'text' ? 'Send' : 'Send Template' }}
        </button>
      </div>
    </div>
  </div>
</template>
