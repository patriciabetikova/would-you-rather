import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { SocketProvider } from "./socket";
import { fakeServer, createFakeSocket } from "./fake-socket";
import App from "./App";
import "./index.css";

if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.fakeServer = fakeServer;
  w.createFakeSocket = createFakeSocket;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <App />
      </SocketProvider>
    </BrowserRouter>
  </StrictMode>,
);
