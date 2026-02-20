<script setup>
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import ConversationList from "../components/ConversationList.vue";
import MessageThread from "../components/MessageThread.vue";
import HealthBadge from "../components/HealthBadge.vue";
import { useInboxStore } from "../stores/inbox";

const route = useRoute();
const router = useRouter();
const store = useInboxStore();

const { conversations, messages, dbHealth, selectedWaId, loadingConversations, loadingMessages } = storeToRefs(store);

const waIdFromRoute = computed(() => route.params.waId || null);

async function selectConversation(waId) {
  if (!waId) return;
  await router.push(`/chat/${waId}`);
}

async function refreshConversations() {
  await Promise.allSettled([store.fetchDbHealth(), store.fetchConversations()]);
}

watch(
  () => waIdFromRoute.value,
  async (waId) => {
    if (!waId) return;
    await store.fetchMessages(waId);
  },
  { immediate: true }
);

onMounted(async () => {
  await refreshConversations();
});
</script>

<template>
  <main class="layout">
    <section class="sidebar">
      <div class="sidebar-head">
        <h1>WA CRM</h1>
        <button class="refresh" type="button" @click="refreshConversations">Refresh</button>
      </div>
      <HealthBadge :db-health="dbHealth" />
      <ConversationList
        :conversations="conversations"
        :loading="loadingConversations"
        :selected-wa-id="selectedWaId || waIdFromRoute"
        @select="selectConversation"
      />
    </section>

    <section class="content">
      <MessageThread :wa-id="waIdFromRoute" :messages="messages" :loading="loadingMessages" />
    </section>
  </main>
</template>
