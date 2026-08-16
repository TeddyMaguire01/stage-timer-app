import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { createRoomStore, currentRemaining } from "./lib/roomStore";
import type { ClientToServerEvents, ServerToClientEvents } from "./types/room";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();
const store = createRoomStore();

/** Pending "auto-start the linked next timer" timeouts, keyed by `${code}:${id}`. */
const autoChainTimers = new Map<string, ReturnType<typeof setTimeout>>();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
  });

  const broadcast = (code: string) => {
    io.to(code).emit("room:state", { ...store.getState(code), now: Date.now() });
  };

  const cancelAutoChain = (code: string, id: string) => {
    const key = `${code}:${id}`;
    const pending = autoChainTimers.get(key);
    if (pending) {
      clearTimeout(pending);
      autoChainTimers.delete(key);
    }
  };

  const scheduleAutoChain = (code: string, id: string) => {
    cancelAutoChain(code, id);
    const timer = store.getTimer(code, id);
    if (!timer || !timer.linkedNextId || timer.status !== "running") return;

    const remainingMs = currentRemaining(timer) * 1000;
    const pending = setTimeout(() => {
      autoChainTimers.delete(`${code}:${id}`);
      const current = store.getTimer(code, id);
      const nextId = current?.linkedNextId;
      if (!nextId || !store.getTimer(code, nextId)) return;
      store.start(code, nextId);
      store.selectTimer(code, nextId);
      broadcast(code);
      scheduleAutoChain(code, nextId);
    }, Math.max(0, remainingMs));

    autoChainTimers.set(`${code}:${id}`, pending);
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
      cancelAutoChain(code, id);
      store.deleteTimer(code, id);
      broadcast(code);
    });

    socket.on("timer:select", ({ code, id }) => {
      store.selectTimer(code, id);
      broadcast(code);
    });

    socket.on("timer:start", ({ code, id }) => {
      store.start(code, id);
      scheduleAutoChain(code, id);
      broadcast(code);
    });

    socket.on("timer:pause", ({ code, id }) => {
      store.pause(code, id);
      cancelAutoChain(code, id);
      broadcast(code);
    });

    socket.on("timer:reset", ({ code, id }) => {
      store.reset(code, id);
      cancelAutoChain(code, id);
      broadcast(code);
    });

    socket.on("timer:adjust", ({ code, id, deltaSec }) => {
      store.adjust(code, id, deltaSec);
      scheduleAutoChain(code, id);
      broadcast(code);
    });

    socket.on("timer:rename", ({ code, id, name }) => {
      store.rename(code, id, name);
      broadcast(code);
    });

    socket.on("timer:setDuration", ({ code, id, durationSec }) => {
      store.setDuration(code, id, durationSec);
      scheduleAutoChain(code, id);
      broadcast(code);
    });

    socket.on("timer:setFinishTime", ({ code, id, finishAt }) => {
      store.setFinishTime(code, id, finishAt);
      scheduleAutoChain(code, id);
      broadcast(code);
    });

    socket.on("timer:link", ({ code, id, nextId }) => {
      store.setLink(code, id, nextId);
      scheduleAutoChain(code, id);
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
