# ScreenShare Rooms

ScreenShare Rooms is a small, self-hostable WebRTC application for anonymous
real-time screen sharing. Anyone can create a room, share its link, and join
with a nickname—no account required.

## Features

- Browser-based screen sharing with quality presets up to 1080p60.
- Optional screen-share audio when the browser and operating system provide it.
- LiveKit WebRTC transport for low-latency video, audio, and chat.
- Room chat and participant list.
- Sender diagnostics for capture, encoder, bitrate, transport, and frame rate.
- Fullscreen playback and responsive desktop/mobile layout.
- Automatic cleanup of inactive rooms.

## Technology

- Next.js, React, and TypeScript
- Tailwind CSS
- LiveKit / WebRTC
- PostgreSQL and Prisma
- Docker Compose for local services

## Run locally

### Prerequisites

- Node.js 20 or newer
- Docker and Docker Compose
- A browser that supports `getDisplayMedia()`

Screen sharing works only from `https://` or `http://localhost`.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the local environment

Create a `.env` file in the project root. These values match the development
PostgreSQL and LiveKit services in `docker-compose.yml` and `livekit.yaml`:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/screenshare"
DATABASE_URL_UNPOOLED="postgresql://postgres:postgres@localhost:5432/screenshare"
LIVEKIT_URL="ws://localhost:7880"
LIVEKIT_API_KEY="devkey"
LIVEKIT_API_SECRET="devsecret-key-change-me"
ROOM_INACTIVITY_TTL_SEC="3600"
```

If you use a hosted Neon database instead, populate the database variables
with that project’s connection strings (the Neon CLI can also run
`neon env pull`).

### 3. Start the services and database

```bash
docker compose up -d postgres livekit
npm run db:deploy
```

### 4. Start the application

```bash
npm run dev
```

Open <http://localhost:3000>, create a room, and share the generated link.

## Useful commands

```bash
npm run dev        # start the development server
npm run build      # create a production build
npm run start      # serve the production build
npm run lint       # run ESLint
npm run typecheck  # run TypeScript checks
npm test           # run automated tests
npm run check      # lint + typecheck + tests + build

npm run db:deploy  # apply existing Prisma migrations
npm run db:studio  # open Prisma Studio
npm run db:push    # synchronize the schema without a migration
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL connection used by Prisma |
| `DATABASE_URL_UNPOOLED` | Direct PostgreSQL connection used for migrations |
| `LIVEKIT_URL` | LiveKit WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `ROOM_INACTIVITY_TTL_SEC` | Seconds before an inactive room is cleaned up |
| `CRON_SECRET` | Protects the cleanup endpoint in production |
| `DEV_ALLOWED_ORIGINS` | Optional comma-separated origins for LAN development |

Never commit `.env` files or real credentials.

## Screen-share quality

`1080p60` is the default high-motion target and can use up to approximately
8 Mbps for the single video stream. `720p60`, `1080p30`, and `720p30` are
available for slower hardware or constrained networks.

The selected resolution and frame rate are targets, not guarantees. The source
surface, operating-system compositor, encoder, network, and receiver can all
reduce the delivered frame rate or resolution. Use **Sender diagnostics** from
the quality menu to see the live limitation reason.

Screen-share audio is also controlled by the browser and operating system. The
application keeps the video share active when no audio track is available.

## Production notes

`livekit.yaml` is for local development only. Use
`livekit.prod.example.yaml` as a starting point for production and provide
secrets through your deployment platform.

For reliable high-quality sharing:

- Deploy the LiveKit server close to your users.
- Prefer direct UDP media and configure TURN/UDP or TURN/TLS fallbacks.
- Use `wss://` for browser signaling in production.
- Reserve at least 12 Mbps of stable upload and download per active 1080p60
  share when validating capacity.
- Run load tests before increasing the number of viewers per room.

## Current scope

This is an anonymous MVP. Authentication, moderation, recording, and persistent
room history are not included yet.

## License

MIT
