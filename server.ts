import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { createRoomStore } from "./lib/roomStore";
import type { ClientToServerEvents, ServerToClientEvents } from "./types/room";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();
const store = createRoomStore();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
  });

  const broadcast = (code: string) => {
    io.to(code).emit("room:state", { ...store.getState(code), now: Date.now() });
  };

  io.on("connection", (socket) => {
    socket.on("room:join", (code) => {
      socket.join(code);
      socket.emit("room:state", { ...store.getState(code), now: Date.now() });
    });

    socket.on("timer:create", ({ code, name, durationSec }) => {
      store.createTimer(code, name, durationSec);
      broadcast(code);
    });

    socket.on("timer:delete", ({ code, id }) => {
      store.deleteTimer(code, id);
      broadcast(code);
    });

    socket.on("timer:select", ({ code, id }) => {
      store.selectTimer(code, id);
      broadcast(code);
    });

    socket.on("timer:start", ({ code, id }) => {
      store.start(code, id);
      broadcast(code);
    });

    socket.on("timer:pause", ({ code, id }) => {
      store.pause(code, id);
      broadcast(code);
    });

    socket.on("timer:reset", ({ code, id }) => {
      store.reset(code, id);
      broadcast(code);
    });

    socket.on("timer:adjust", ({ code, id, deltaSec }) => {
      store.adjust(code, id, deltaSec);
      broadcast(code);
    });

    socket.on("timer:rename", ({ code, id, name }) => {
      store.rename(code, id, name);
      broadcast(code);
    });

    socket.on("flag:send", ({ code, message }) => {
      store.setFlag(code, message);
      broadcast(code);
    });

    socket.on("flag:clear", ({ code }) => {
      store.clearFlag(code);
      broadcast(code);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Stage Timer ready on http://localhost:${port}`);
  });
});
