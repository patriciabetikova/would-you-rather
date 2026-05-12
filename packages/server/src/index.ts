import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Server } from "socket.io";
import { SHARED_VERSION } from "@wyr/shared";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@wyr/shared";
import { registerSocketHandlers } from "./handlers";
import { rooms } from "./room-store";

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = new Hono();
app.use("*", cors({ origin: CLIENT_ORIGIN }));

app.get("/health", (c) =>
  c.json({
    status: "ok",
    sharedVersion: SHARED_VERSION,
    activeRooms: rooms.size,
  }),
);

const httpServer = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`);
  console.log(`[server] CORS origin: ${CLIENT_ORIGIN}`);
});

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, { cors: { origin: CLIENT_ORIGIN } });

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  registerSocketHandlers(io, socket);
});

process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received, shutting down");
  io.close();
  httpServer.close(() => process.exit(0));
});
