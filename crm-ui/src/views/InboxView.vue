<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import ConversationList from "../components/ConversationList.vue";
import MessageThread from "../components/MessageThread.vue";
import HealthBadge from "../components/HealthBadge.vue";
import { useInboxStore } from "../stores/inbox";
import { clearAuthSession, loadAuthSession } from "../services/authSession";

const route = useRoute();
const router = useRouter();
const store = useInboxStore();
const authSession = ref(loadAuthSession());

const {
  conversations,
  messages,
  dbHealth,
  selectedWaId,
  loadingConversations,
  loadingMessages,
  sendingMessage,
  sendError,
  templatePresets
} = storeToRefs(store);

const waIdFromRoute = computed(() => route.params.waId || null);
const replyTo = ref(null);
const isDark = ref(false);
let pollingTimer = null;
let templateSyncTimer = null;
const POLL_MS = 4000;
const TEMPLATE_SYNC_MS = 60 * 1000;

async function selectConversation(waId) {
  if (!waId) return;
  await router.push(`/chat/${waId}`);
}

async function openNewWaChat(waId) {
  if (!waId) return;
  await router.push(`/chat/${waId}`);
}

async function logout() {
  clearAuthSession();
  authSession.value = null;
  await router.replace("/login");
}

async function refreshConversations() {
  await Promise.allSettled([
    store.fetchDbHealth(),
    store.fetchConversations(),
    store.fetchTemplatePresets({ force: true })
  ]);
}

function applyTheme(nextDark) {
  isDark.value = nextDark;
  document.documentElement.classList.toggle("dark", nextDark);
  localStorage.setItem("crm_theme", nextDark ? "dark" : "light");
}

function toggleTheme() {
  applyTheme(!isDark.value);
}

function onReply(msg) {
  replyTo.value = msg;
}

function clearReply() {
  replyTo.value = null;
}

async function onSend(text) {
  const waId = waIdFromRoute.value;
  if (!waId) return;
  try {
    await store.sendTextMessage({
      to: waId,
      text,
      replyToMessageId: replyTo.value?.message_id || null
    });
    replyTo.value = null;
    await Promise.allSettled([store.fetchMessages(waId), store.fetchConversations()]);
  } catch (err) {
    // Error is already stored in sendError by store action.
  }
}

async function onSendTemplate(payload) {
  const waId = waIdFromRoute.value;
  if (!waId) return;
  try {
    await store.sendTemplateMessage({
      to: waId,
      templateName: payload.templateName,
      languageCode: payload.languageCode,
      bodyParams: payload.bodyParams,
    });
    await Promise.allSettled([store.fetchMessages(waId), store.fetchConversations()]);
  } catch (err) {
    // Error is already stored in sendError by store action.
  }
}

watch(
  () => waIdFromRoute.value,
  async (waId) => {
    clearReply();
    store.clearSendError();
    if (!waId) return;
    await store.fetchMessages(waId);
  },
  { immediate: true }
);

onMounted(async () => {
  const saved = localStorage.getItem("crm_theme");
  if (saved === "dark" || saved === "light") {
    applyTheme(saved === "dark");
  } else {
    applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  await refreshConversations();
  pollingTimer = setInterval(async () => {
    if (document.hidden) return;
    if (sendingMessage.value) return;
    const waId = waIdFromRoute.value;
    const jobs = [store.fetchConversations({ silent: true })];
    if (waId) jobs.push(store.fetchMessages(waId, { silent: true }));
    await Promise.allSettled(jobs);
  }, POLL_MS);
  templateSyncTimer = setInterval(async () => {
    if (document.hidden) return;
    await store.fetchTemplatePresets({ force: true });
  }, TEMPLATE_SYNC_MS);
});

onUnmounted(() => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  if (templateSyncTimer) {
    clearInterval(templateSyncTimer);
    templateSyncTimer = null;
  }
});
</script>

<template>
  <main class="grid min-h-screen grid-cols-1 gap-4 p-4 lg:grid-cols-[24rem_minmax(0,1fr)] lg:p-5">
    <section class="flex min-h-0 flex-col gap-3">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">WA CRM</h1>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ authSession?.user?.email || "Authenticated" }} · Workspace {{ authSession?.workspaceId || "-" }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-xl border border-[#dfcfbc] bg-[#fffdfa] px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            type="button"
            @click="logout"
          >
            Logout
          </button>
          <button
            class="rounded-xl border border-[#dfcfbc] bg-[#fffdfa] px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-orange-300 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            type="button"
            @click="toggleTheme"
          >
            {{ isDark ? 'Light' : 'Dark' }}
          </button>
          <button
            class="rounded-xl border border-[#dfcfbc] bg-[#fffdfa] px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-orange-300 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            type="button"
            @click="refreshConversations"
          >
            Refresh
          </button>
        </div>
      </div>

      <HealthBadge :db-health="dbHealth" />

      <ConversationList
        :conversations="conversations"
        :loading="loadingConversations"
        :selected-wa-id="selectedWaId || waIdFromRoute"
        @select="selectConversation"
        @open-wa="openNewWaChat"
      />
    </section>

    <section class="min-h-0">
      <MessageThread
        :wa-id="waIdFromRoute"
        :messages="messages"
        :loading="loadingMessages"
        :reply-to="replyTo"
        :sending="sendingMessage"
        :send-error="sendError"
        :template-presets="templatePresets"
        @reply="onReply"
        @clear-reply="clearReply"
        @send-text="onSend"
        @send-template="onSendTemplate"
      />
    </section>
  </main>
</template>
