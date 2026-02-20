import { createRouter, createWebHistory } from "vue-router";
import InboxView from "../views/InboxView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "inbox", component: InboxView },
    { path: "/chat/:waId", name: "chat", component: InboxView, props: true }
  ]
});

export default router;
