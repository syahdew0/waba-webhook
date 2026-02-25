import { createRouter, createWebHistory } from "vue-router";
import InboxView from "../views/InboxView.vue";
import LoginView from "../views/LoginView.vue";
import { hasAuthSession } from "../services/authSession";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView, meta: { public: true } },
    { path: "/", name: "inbox", component: InboxView },
    { path: "/chat/:waId", name: "chat", component: InboxView, props: true }
  ]
});

router.beforeEach((to) => {
  const authed = hasAuthSession();
  const isPublic = Boolean(to.meta?.public);

  if (!authed && !isPublic) {
    return {
      name: "login",
      query: to.fullPath && to.fullPath !== "/" ? { redirect: to.fullPath } : undefined
    };
  }

  if (authed && to.name === "login") {
    return { name: "inbox" };
  }

  return true;
});

export default router;
