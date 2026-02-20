<script setup>
defineProps({
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
  }
});
</script>

<template>
  <div class="panel thread-panel">
    <div class="panel-head">
      <h2>Thread</h2>
      <span class="mono">{{ waId || '-' }}</span>
    </div>

    <div v-if="!waId" class="muted">Select conversation to view messages.</div>
    <div v-else-if="loading" class="muted">Loading messages...</div>

    <div v-else class="thread-list">
      <div
        v-for="msg in messages"
        :key="msg.message_id"
        class="bubble"
        :class="msg.direction === 'inbound' ? 'inbound' : 'outbound'"
      >
        <div class="bubble-meta">
          <span>{{ msg.direction }}</span>
          <span>{{ msg.message_type }}</span>
          <span>{{ msg.status || '-' }}</span>
        </div>
        <div class="bubble-text">
          {{ msg.text || msg.interactive_title || '[non-text message]' }}
        </div>
        <div class="bubble-time">
          {{ msg.ts ? new Date(msg.ts).toLocaleString() : '-' }}
        </div>
      </div>
    </div>
  </div>
</template>
