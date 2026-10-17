import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { initTheme } from "./lib/theme";
import "./index.css";

initTheme();

// Replace the HTML splash with React only when the app is ready to paint.
const rootEl = document.getElementById("root")!;
rootEl.replaceChildren();

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
