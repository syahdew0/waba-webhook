import { defineStore } from "pinia";
import axios from "axios";
import { TEMPLATE_PRESETS as FALLBACK_TEMPLATE_PRESETS } from "../config/templatePresets";

export const useInboxStore = defineStore("inbox", {
  state: () => ({
    loadingConversations: false,
    loadingMessages: false,
    conversations: [],
    messages: [],
    dbHealth: null,
    selectedWaId: null,
    search: "",
    sendingMessage: false,
    sendError: "",
    templatePresets: [...FALLBACK_TEMPLATE_PRESETS],
    templatesSource: "fallback"
  }),
  actions: {
    clearSendError() {
      this.sendError = "";
    },
    areTemplateListsEqual(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i += 1) {
        const x = a[i];
        const y = b[i];
        if (
          x?.key !== y?.key ||
          x?.label !== y?.label ||
          x?.templateName !== y?.templateName ||
          x?.languageCode !== y?.languageCode ||
          x?.status !== y?.status ||
          x?.category !== y?.category
        ) {
          return false;
        }
      }
      return true;
    },
    async fetchDbHealth() {
      const { data } = await axios.get("/health/db");
      this.dbHealth = data;
    },
    async fetchConversations(options = {}) {
      const silent = Boolean(options.silent);
      if (!silent) this.loadingConversations = true;
      try {
        const { data } = await axios.get("/api/conversations", {
          params: {
            limit: 200,
            q: this.search || undefined
          }
        });
        this.conversations = data.data || [];
      } finally {
        if (!silent) this.loadingConversations = false;
      }
    },
    async fetchMessages(waId, options = {}) {
      if (!waId) {
        this.messages = [];
        return;
      }
      const silent = Boolean(options.silent);
      if (!silent) this.loadingMessages = true;
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
        if (!silent) this.loadingMessages = false;
      }
    },
    async sendTextMessage({ to, text, replyToMessageId }) {
      this.sendError = "";
      this.sendingMessage = true;
      try {
        const { data } = await axios.post("/api/messages/send", {
          to,
          type: "text",
          text,
          reply_to_message_id: replyToMessageId || undefined
        });
        return data;
      } catch (err) {
        this.sendError =
          err?.response?.data?.error || err?.message || "Failed to send message";
        throw err;
      } finally {
        this.sendingMessage = false;
      }
    },
    async sendTemplateMessage({ to, templateName, languageCode, bodyParams }) {
      this.sendError = "";
      this.sendingMessage = true;
      try {
        const { data } = await axios.post("/api/messages/send-template", {
          to,
          template_name: templateName,
          language_code: languageCode,
          body_params: Array.isArray(bodyParams) ? bodyParams : []
        });
        return data;
      } catch (err) {
        this.sendError =
          err?.response?.data?.error || err?.message || "Failed to send template";
        throw err;
      } finally {
        this.sendingMessage = false;
      }
    },
    async fetchTemplatePresets(options = {}) {
      const force = Boolean(options.force);
      try {
        const { data } = await axios.get("/api/templates", {
          params: {
            force: force ? 1 : undefined
          }
        });
        const list = Array.isArray(data?.data) ? data.data : [];
        if (list.length > 0) {
          if (!this.areTemplateListsEqual(this.templatePresets, list)) {
            this.templatePresets = list;
          }
          this.templatesSource = data.source || "meta";
        } else if (this.templatePresets.length === 0) {
          this.templatePresets = [...FALLBACK_TEMPLATE_PRESETS];
          this.templatesSource = "fallback";
        }
      } catch (err) {
        if (this.templatePresets.length === 0) {
          this.templatePresets = [...FALLBACK_TEMPLATE_PRESETS];
          this.templatesSource = "fallback";
        }
      }
    }
  }
});
