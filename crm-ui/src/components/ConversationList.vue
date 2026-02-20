<script setup>
const props = defineProps({
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
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <h2>Conversations</h2>
      <span class="pill">{{ conversations.length }}</span>
    </div>

    <div v-if="loading" class="muted">Loading conversations...</div>

    <button
      v-for="item in conversations"
      :key="item.wa_id"
      type="button"
      class="conversation-item"
      :class="{ active: selectedWaId === item.wa_id }"
      @click="onSelect(item)"
    >
      <div class="row-1">
        <strong>{{ item.profile_name || item.wa_id }}</strong>
        <small>{{ item.last_message_at ? new Date(item.last_message_at).toLocaleString() : '-' }}</small>
      </div>
      <div class="row-2">
        <span>{{ item.last_message?.text || '(no message text)' }}</span>
      </div>
      <div class="row-3">
        <small>{{ item.wa_id }}</small>
        <small class="status">{{ item.latest_status || 'unknown' }}</small>
      </div>
    </button>
  </div>
</template>
