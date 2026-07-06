import * as Sentry from "@sentry/react";
import { browserTracingIntegration, replayIntegration } from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAnalytics } from "@/lib/analytics";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_APP_VERSION,
  environment: import.meta.env.MODE,
  integrations: [
    browserTracingIntegration(),
    replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  tracePropagationTargets: [import.meta.env.VITE_API_URL ?? "http://localhost:3000"],
});

initAnalytics();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>Algo deu errado. Recarregue a página.</p>}>
    <App />
  </Sentry.ErrorBoundary>
);
