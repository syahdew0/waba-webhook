<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { saveAuthSession } from "../services/authSession";

const router = useRouter();
const route = useRoute();

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

function getRedirectPath() {
  const raw = typeof route.query.redirect === "string" ? route.query.redirect : "";
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("/login")) return "/";
  return raw;
}

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    const { data } = await axios.post("/auth/login", {
      email: email.value,
      password: password.value
    });

    const payload = data?.data || {};
    const session = saveAuthSession({
      token: payload.token,
      workspaceId: payload.default_workspace_id,
      user: payload.user,
      workspaces: payload.workspaces
    });

    if (!session?.token) {
      throw new Error("Login succeeded but token is missing");
    }

    await router.replace(getRedirectPath());
  } catch (err) {
    error.value = err?.response?.data?.error || err?.message || "Login failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen p-4 sm:p-6">
    <div class="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section class="crm-card relative overflow-hidden p-6 sm:p-8">
        <div class="absolute -left-10 -top-14 h-40 w-40 rounded-full bg-orange-200/60 blur-2xl dark:bg-orange-400/10" />
        <div class="absolute -bottom-10 right-0 h-36 w-36 rounded-full bg-emerald-200/70 blur-2xl dark:bg-emerald-400/10" />
        <div class="relative space-y-4">
          <p class="inline-flex rounded-full border border-[#ead9c4] bg-[#fff7ec] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a5a2b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            PSG CRM
          </p>
          <h1 class="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Login Workspace
          </h1>
          <p class="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            Masuk untuk mengaktifkan kembali CRM UI lama dengan header `Authorization` dan `X-Workspace-Id`
            otomatis ke endpoint backend.
          </p>
        </div>
      </section>

      <section class="crm-card p-5 sm:p-6">
        <form class="space-y-4" @submit.prevent="onSubmit">
          <div>
            <label class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200" for="email">
              Email
            </label>
            <input
              id="email"
              v-model.trim="email"
              type="email"
              autocomplete="email"
              required
              class="w-full rounded-xl border border-[#ddccbb] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-orange-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="admin@mail.com"
            />
          </div>

          <div>
            <label
              class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              for="password"
            >
              Password
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full rounded-xl border border-[#ddccbb] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-orange-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Masukkan password"
            />
          </div>

          <p v-if="error" class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            {{ error }}
          </p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-orange-500 dark:text-slate-950 dark:hover:bg-orange-400"
          >
            {{ loading ? "Logging in..." : "Login" }}
          </button>
        </form>
      </section>
    </div>
  </main>
</template>

