import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { fakeServer } from "./fake-socket";

if (import.meta.env.DEV) {
  (window as unknown as { fakeServer: typeof fakeServer }).fakeServer =
    fakeServer;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
