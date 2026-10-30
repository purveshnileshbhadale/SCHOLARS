import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary, { reloadOnce } from "./components/ErrorBoundary";
import { AuthProvider } from "./lib/auth";
import { initTheme } from "./lib/theme";
import "./index.css";

initTheme();

// A lazy chunk that 404s after a redeploy would otherwise leave a dead screen.
// Vite emits this event when a dynamic import fails; reload once to pick up
// the new bundle (reloadOnce guards against loops).
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnce();
});

const rootEl = document.getElementById("root")!;

// The HTML splash stays visible until React's first paint replaces it, so a
// slow auth check shows the branded spinner instead of a blank screen.
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
