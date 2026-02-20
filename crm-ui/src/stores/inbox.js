import { defineStore } from "pinia";
import axios from "axios";

export const useInboxStore = defineStore("inbox", {
  state: () => ({
    loadingConversations: false,
    loadingMessages: false,
    conversations: [],
    messages: [],
    dbHealth: null,
    selectedWaId: null,
    search: ""
  }),
  actions: {
    async fetchDbHealth() {
      const { data } = await axios.get("/health/db");
      this.dbHealth = data;
    },
    async fetchConversations() {
      this.loadingConversations = true;
      try {
        const { data } = await axios.get("/api/conversations", {
          params: {
            limit: 200,
            q: this.search || undefined
          }
        });
        this.conversations = data.data || [];
      } finally {
        this.loadingConversations = false;
      }
    },
    async fetchMessages(waId) {
      if (!waId) {
        this.messages = [];
        return;
      }
      this.loadingMessages = true;
      this.selectedWaId = waId;
      try {
        const { data } = await axios.get("/api/messages", {
          params: {
            wa_id: waId,
            limit: 300
          }
        });
        this.messages = data.data || [];
      } finally {
        this.loadingMessages = false;
      }
    }
  }
});
