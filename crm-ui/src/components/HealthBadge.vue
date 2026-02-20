<script setup>
defineProps({
  dbHealth: {
    type: Object,
    default: null
  }
});
</script>

<template>
  <div class="health-card">
    <p class="health-title">DB Health</p>
    <p class="health-state" :class="dbHealth?.ok ? 'up' : 'down'">
      {{ dbHealth?.ok ? 'UP' : 'DOWN' }}
    </p>
    <p v-if="dbHealth?.stats" class="health-meta">
      Events: {{ dbHealth.stats.webhook_events_total }} | Messages: {{ dbHealth.stats.wa_messages_total }}
    </p>
  </div>
</template>
