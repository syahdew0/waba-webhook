import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { setupAxiosAuthInterceptors } from "./services/axiosAuth";
import "./styles.css";

setupAxiosAuthInterceptors();

createApp(App).use(createPinia()).use(router).mount("#app");
