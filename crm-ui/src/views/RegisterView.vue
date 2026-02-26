<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { saveAuthSession } from "../services/authSession";

const router = useRouter();
const route = useRoute();

const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const fullName = ref("");
const workspaceName = ref("");
const loading = ref(false);
const error = ref("");

const canSubmit = computed(() => {
  return (
    email.value.trim() &&
    password.value &&
    confirmPassword.value &&
    fullName.value.trim() &&
    workspaceName.value.trim() &&
    !loading.value
  );
});

function getRedirectPath() {
  const raw = typeof route.query.redirect === "string" ? route.query.redirect : "";
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("/login") || raw.startsWith("/register")) return "/";
  return raw;
}

async function onSubmit() {
  error.value = "";

  if (password.value !== confirmPassword.value) {
    error.value = "Password dan konfirmasi password tidak sama";
    return;
  }

  loading.value = true;
  try {
    const { data } = await axios.post("/auth/register", {
      email: email.value.trim(),
      password: password.value,
      full_name: fullName.value.trim(),
      workspace_name: workspaceName.value.trim()
    });

    const payload = data?.data || {};
    const session = saveAuthSession({
      token: payload.token,
      workspaceId: payload.default_workspace_id,
      user: payload.user,
      workspaces: payload.workspaces
    });

    if (!session?.token) {
      throw new Error("Register succeeded but token is missing");
    }

    await router.replace(getRedirectPath());
  } catch (err) {
    error.value = err?.response?.data?.error || err?.message || "Register failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen p-4 sm:p-6">
    <div class="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section class="crm-card relative overflow-hidden p-6 sm:p-8">
        <div class="absolute -left-10 -top-14 h-40 w-40 rounded-full bg-emerald-200/60 blur-2xl dark:bg-emerald-400/10" />
        <div class="absolute -bottom-12 right-2 h-40 w-40 rounded-full bg-orange-200/60 blur-2xl dark:bg-orange-400/10" />
        <div class="relative space-y-4">
          <p class="inline-flex rounded-full border border-[#d8eadb] bg-[#eefcf1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f6a43] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            PSG CRM
          </p>
          <h1 class="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Register Workspace
          </h1>
          <p class="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            Buat user baru dan workspace default langsung dari CRM UI. Setelah register berhasil, sesi login
            disimpan otomatis dan Anda akan masuk ke inbox.
          </p>
          <div class="rounded-xl border border-[#e7dbcd] bg-white/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
            Endpoint yang dipakai: <code>/auth/register</code>
          </div>
        </div>
      </section>

      <section class="crm-card p-5 sm:p-6">
        <form class="space-y-4" @submit.prevent="onSubmit">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200" for="reg_email">
                Email
              </label>
              <input
                id="reg_email"
                v-model.trim="email"
                type="email"
                autocomplete="email"
                required
                class="w-full rounded-xl border border-[#ddccbb] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="admin@mail.com"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200" for="reg_full_name">
                Full Name
              </label>
              <input
                id="reg_full_name"
                v-model.trim="fullName"
                type="text"
                autocomplete="name"
                required
                class="w-full rounded-xl border border-[#ddccbb] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Admin"
              />
            </div>

            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200" for="reg_workspace">
                Workspace Name
              </label>
              <input
                id="reg_workspace"
                v-model.trim="workspaceName"
                type="text"
                required
                class="w-full rounded-xl border border-[#ddccbb] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="PSG CRM"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200" for="reg_password">
                Password
              </label>
              <input
                id="reg_password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                required
                class="w-full rounded-xl border border-[#ddccbb] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200" for="reg_confirm_password">
                Confirm Password
              </label>
              <input
                id="reg_confirm_password"
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                required
                class="w-full rounded-xl border border-[#ddccbb] bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Ulangi password"
              />
            </div>
          </div>

          <p
            v-if="error"
            class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {{ error }}
          </p>

          <button
            type="submit"
            :disabled="!canSubmit"
            class="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            {{ loading ? "Registering..." : "Create Account & Workspace" }}
          </button>

          <p class="text-center text-sm text-slate-600 dark:text-slate-300">
            Sudah punya akun?
            <RouterLink class="font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400" :to="{ name: 'login' }">
              Login
            </RouterLink>
          </p>
        </form>
      </section>
    </div>
  </main>
</template>

