# Stage Timer



## Tech stack

- Next.js 14 (App Router) + TypeScript
- Socket.io, on a custom Node.js server (`server.ts`) — required because
  Socket.io needs a long-lived connection, which plain Next.js API routes /
  serverless functions don't support
- In-memory per-room state on the server (no database — state resets if the
  server restarts; fine for v1 / single-instance use)
- Tailwind CSS, JetBrains Mono (digits) + Inter (UI) via `next/font/google`

## Getting a GitHub account (skip if you already have one)

You only need this to clone/push this repo — running the app locally doesn't
require an account (cloning a *public* repo like this one works without
being logged in at all).

1. Go to [github.com/signup](https://github.com/signup).
2. Enter an email, create a password, and pick a username. GitHub will ask
   you to verify a short puzzle and confirm your email via a code it sends
   you.
3. Free tier is all you need — no payment info required.
4. Install Git itself (the command-line tool, separate from the GitHub
   account) if it's not already on your machine: download from
   [git-scm.com/downloads](https://git-scm.com/downloads) and run the
   installer with default options.
5. Confirm both are working from a terminal:
   ```bash
   git --version
   ```
6. To push your *own* changes (not just clone this repo), tell git who you
   are once per machine:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```
   The first time you `git push` to GitHub, it'll prompt you to sign in
   through the browser (or ask for a personal access token instead of a
   password, if you're using HTTPS remotes) — follow the prompt, it only
   happens once per machine.

## Local dev setup

**Prerequisite: Node.js 18.18+ and npm.** This machine didn't have Node
installed when this project was scaffolded — install it first from
[nodejs.org](https://nodejs.org/) (LTS build) or via a version manager
(`nvm`, `fnm`, etc.), then confirm with:

```bash
node -v
npm -v
```

Then, from this project folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Create a new
room** to get a room code and land on the Controller view. Copy the display
link from the Controller header and open it in a second tab/device (or paste
the room code into the "or view a room" box on the home page) to see the
Display view update live as you control timers.

`npm run build` + `npm run start` runs the same custom server in production
mode.

## How a room works

- A room is just a 6-character code in the URL: `/room/ABC123/controller` and
  `/room/ABC123/display`.
- The first client to touch a room code creates it server-side (in memory) —
  there's no separate "create" API call, so a Display can technically be
  opened before a Controller (it'll just show "Waiting for timer…").
- All timers, the active/selected timer, and the current flag message live in
  a `Map<roomCode, RoomState>` on the server (see `lib/roomStore.ts`). Any
  controller action is applied to that state and the full room state is
  re-broadcast to every socket in the room (`server.ts`).
- Countdown math happens on each client from a shared anchor (`remainingAtChange`
  + `changedAt` + the server's clock, reconciled against the client's own
  clock on every state update). That keeps countdowns smooth and in sync
  without the server needing to tick every 100ms.

## Deploying (Railway or Render — not Vercel)

This app needs a **persistent Node.js process** with a real, long-lived
WebSocket connection. Vercel's serverless functions don't support that (they
spin up per-request and don't hold connections open), so deploy to a host
that runs your app as a normal server instead: **Railway** or **Render** both
work well and this section covers both.

### Railway

1. Push this repo to GitHub (or another git host Railway can pull from).
2. In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
3. Railway auto-detects Node from `package.json`. Set (or confirm) these in
   the service's **Settings**:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
4. Railway sets `PORT` automatically — `server.ts` already reads
   `process.env.PORT`, so no config needed there.
5. Deploy. Railway gives you a public `*.up.railway.app` URL — that's your
   base URL for both `/room/<code>/controller` and `/room/<code>/display`.

### Render

1. Push this repo to GitHub.
2. In Render: **New → Web Service**, connect the repo.
3. Environment: **Node**.
4. Build command: `npm install && npm run build`
5. Start command: `npm run start`
6. Render also injects `PORT` automatically — no extra env vars required.
7. Deploy and use the `*.onrender.com` URL Render gives you.

### Notes for either host

- No database or persistent volume needed for v1 — state is in memory.
- Because state is in memory on a single process, don't scale this service
  to multiple replicas/instances without adding shared state (e.g. Redis) and
  sticky sessions — a client could otherwise land on an instance that's never
  heard of its room code.
- If you redeploy or the process restarts, all rooms/timers are lost. That's
  expected for v1; add persistence later if you need timers to survive
  restarts.

## Project structure

```
server.ts                          # custom Node server: Next.js + Socket.io
lib/roomStore.ts                   # in-memory room/timer state + mutations
lib/socketClient.ts                # client hook: connects, joins room, tracks state
lib/timerMath.ts                   # remaining-time calc + mm:ss / +overtime formatting
lib/useTick.ts                     # re-render tick so countdowns animate
types/room.ts                      # shared types + socket event contracts
app/page.tsx                       # home: create or join a room
app/room/[code]/controller/        # operator view
app/room/[code]/display/           # audience/speaker view (read-only)
```

## Known limitations (v1)

- No auth on rooms — anyone with the code can control it. Fine for internal
  event use; add a controller-only token/password before exposing this
  publicly.
- No persistence — restarting the server clears all rooms.
- Clock sync between controller/display relies on each client reconciling
  against the server's clock on every update; this is robust in practice but
  not cryptographically synced NTP-grade timing.


  Once Node.js is installed, here's the full sequence:

1. Get the code onto the machine (only need this once):

2. Install the project's dependencies (downloads everything into a node_modules folder — takes a minute or two):

If you hit the "running scripts is disabled" error, use npm.cmd install instead of npm install.

3. Start the app:

Wait for it to print "Stage Timer ready on http://localhost:3000". This window now stays busy running the server — leave it open.

4. Open it in a browser:

Click Create a new room, and you're in the Controller. Copy the display link into a second tab to see the Display view.

Later, to get updates (whenever I've pushed changes): open a different, non-busy terminal window, cd into the folder, run git pull, then go back to the server window, Ctrl+C to stop it, and npm.cmd run dev again to restart with the new code.

That's the whole loop: clone once → install once → then it's just start/stop/pull as needed.

