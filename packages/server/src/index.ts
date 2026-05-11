import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Server } from "socket.io";
import { SHARED_VERSION } from "@wyr/shared";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@wyr/shared";

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = new Hono();

app.use("*", cors({ origin: CLIENT_ORIGIN }));

app.get("/health", (c) => {
  return c.json({ status: "ok", sharedVersion: SHARED_VERSION });
});

// serve() returns the underlying Node http.Server,
// which Socket.IO needs to attach to for WebSocket upgrades.
const httpServer = serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`[server] listening on http://localhost:${info.port}`);
    console.log(`[server] CORS origin: ${CLIENT_ORIGIN}`);
  },
);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: { origin: CLIENT_ORIGIN },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

// Graceful shutdown for Render's deploy lifecycle
process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received, shutting down");
  httpServer.close(() => process.exit(0));
});
