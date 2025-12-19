# Scrible_it Implementation Plan

## Overview
- **User Auth**: Anonymous only (UUID + random name)
- **Persistence**: Database snapshots (PostgreSQL)
- **Real-time**: Yjs CRDT over WebSocket

---

## 1. User Details Handling (Anonymous MVP)

### Frontend User Generation
```typescript
// src/lib/user.ts
interface AnonymousUser {
  id: string;        // UUID, persisted in localStorage
  name: string;      // Random friendly name
  color: string;     // Presence cursor color
  avatar?: string;   // Optional gravatar-style
}

// Generate or retrieve user from localStorage
const getOrCreateUser = (): AnonymousUser => {
  const stored = localStorage.getItem('scrible_user');
  if (stored) return JSON.parse(stored);
  
  const user = {
    id: crypto.randomUUID(),
    name: generateFunName(), // e.g., "Creative Penguin"
    color: getRandomPresenceColor()
  };
  localStorage.setItem('scrible_user', JSON.stringify(user));
  return user;
};
```

### User State Flow
```
┌─────────────────────────────────────────────────────────┐
│  App Load                                               │
│  ├─ Check localStorage for existing user                │
│  ├─ If none: generate UUID + random name + color        │
│  ├─ Store in localStorage                               │
│  └─ Store in Zustand for app-wide access                │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Room ID Storage & Management

### Data Model (PostgreSQL)

```sql
-- rooms table
CREATE TABLE rooms (
  id VARCHAR(8) PRIMARY KEY,           -- Short alphanumeric ID
  name VARCHAR(100) NOT NULL,          -- Display name
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  creator_id UUID,                     -- Anonymous user who created
  visibility VARCHAR(10) DEFAULT 'public'  -- public/private
);

-- room_snapshots table
CREATE TABLE room_snapshots (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(8) REFERENCES rooms(id) ON DELETE CASCADE,
  snapshot_data BYTEA NOT NULL,        -- Yjs encoded state
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_snapshots_room ON room_snapshots(room_id, created_at DESC);

-- room_participants (for tracking active sessions)
CREATE TABLE room_participants (
  room_id VARCHAR(8) REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name VARCHAR(50),
  user_color VARCHAR(7),
  joined_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);
```

### Room Lifecycle

```
┌─ CREATE ROOM ─────────────────────────────────────────┐
│  1. Frontend: Generate room ID (alphanumeric 8 chars) │
│  2. API: POST /api/rooms { id, name, creator_id }     │
│  3. Backend: Insert to PostgreSQL                     │
│  4. Backend: Initialize empty Yjs document            │
│  5. Frontend: Navigate to /room/:roomId               │
└───────────────────────────────────────────────────────┘

┌─ JOIN ROOM ───────────────────────────────────────────┐
│  1. Frontend: Connect WebSocket with roomId + user    │
│  2. Backend: Validate room exists in PostgreSQL       │
│  3. Backend: Load latest snapshot if exists           │
│  4. Backend: Add user to room_participants            │
│  5. Backend: Send initial state + participant list    │
│  6. Frontend: Apply state to tldraw canvas            │
└───────────────────────────────────────────────────────┘

┌─ SAVE SNAPSHOT ───────────────────────────────────────┐
│  Triggers:                                            │
│  - Every 30 seconds while users active                │
│  - When last user disconnects                         │
│  - Manual save button                                 │
│                                                       │
│  Process:                                             │
│  1. Encode Yjs document to binary                     │
│  2. Insert into room_snapshots                        │
│  3. Keep last 10 snapshots per room (cleanup old)     │
└───────────────────────────────────────────────────────┘
```

---

## 3. Collaboration Architecture

### WebSocket Protocol

```typescript
// Message types (already defined in src/types/protocol.ts)

// Client → Server
type ClientMessage = 
  | { type: 'join'; roomId: string; user: User }
  | { type: 'yjs-update'; update: Uint8Array }      // Yjs binary diff
  | { type: 'presence'; cursor: { x: number; y: number }; selection?: string[] }
  | { type: 'leave' }

// Server → Client  
type ServerMessage =
  | { type: 'room-state'; snapshot: Uint8Array; participants: Participant[] }
  | { type: 'yjs-update'; update: Uint8Array; from: string }
  | { type: 'presence-update'; userId: string; cursor: { x: number; y: number } }
  | { type: 'user-joined'; user: Participant }
  | { type: 'user-left'; userId: string }
  | { type: 'error'; message: string }
```

### Yjs Integration Flow

```
┌─────────────────────────────────────────────────────────┐
│  tldraw Canvas                                          │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────────┐                                        │
│  │ Yjs Doc     │◄─── Yjs bindings for tldraw shapes    │
│  │ (local)     │                                        │
│  └─────┬───────┘                                        │
│        │                                                │
│        │ on('update', ...)                              │
│        ▼                                                │
│  ┌─────────────┐                                        │
│  │ WebSocket   │───► Server broadcasts to other clients│
│  │ Provider    │                                        │
│  └─────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

### Presence System

```typescript
// Real-time cursor tracking
interface PresenceState {
  odId: string
  cursor: { x: number; y: number } | null;
  selection: string[];  // Selected shape IDs
  viewport: { x: number; y: number; zoom: number };
}

// Update presence 60fps throttled
const throttledPresenceUpdate = throttle((cursor) => {
  ws.send({ type: 'presence', cursor });
}, 16);  // ~60fps

// On canvas pointer move
editor.on('pointerMove', (event) => {
  throttledPresenceUpdate({ x: event.x, y: event.y });
});
```

---

## 4. Backend Implementation Checklist

### REST API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/rooms` | Create new room |
| GET | `/api/rooms/:id` | Get room metadata |
| GET | `/api/rooms/:id/exists` | Check if room exists |
| DELETE | `/api/rooms/:id` | Delete room (creator only) |

### WebSocket Server Requirements

- [ ] Connection authentication (validate room exists)
- [ ] Yjs document management per room
- [ ] Broadcast updates to all room participants
- [ ] Presence tracking with Redis pub/sub
- [ ] Snapshot persistence (30s interval + on disconnect)
- [ ] Graceful reconnection handling
- [ ] Rate limiting (max updates/sec per client)

### Tech Stack (Recommended)

```
├── Node.js + TypeScript
├── Framework: Fastify or Express
├── WebSocket: ws or uWebSockets.js
├── Yjs: y-websocket provider (or custom)
├── Database: PostgreSQL + Prisma
├── Cache: Redis (presence, pub/sub)
└── Deployment: Docker + Fly.io / Railway
```

---

## 5. Frontend Implementation Status

### ✅ Completed
- [x] Landing page with glassmorphism UI
- [x] Room creation (generates ID client-side)
- [x] Join room flow
- [x] Basic tldraw integration
- [x] WebSocket client infrastructure
- [x] Zustand store for room state
- [x] Participants drawer UI
- [x] Room header with share button
- [x] **User generation with localStorage persistence** (`src/hooks/useUser.ts`)
- [x] **Yjs document binding to tldraw** (`src/hooks/useYjsSync.ts`)
- [x] **Real-time cursor rendering for other users** (`src/hooks/useCollaborativeCursors.ts`)

### 🔲 TODO (Frontend)
- [ ] Reconnection handling UI
- [ ] Export functionality (PNG/SVG)
- [ ] Offline indicator
- [ ] User profile editor (change name/color)
- [ ] Chat panel

---

## 6. File Structure

```
Frontend (Lovable)
├── src/
│   ├── hooks/
│   │   ├── useUser.ts               # ✅ Anonymous user management (localStorage)
│   │   ├── useYjsSync.ts            # ✅ Yjs document binding to tldraw
│   │   └── useCollaborativeCursors.ts # ✅ Remote cursor rendering
│   ├── lib/
│   │   ├── websocket.ts             # ✅ WebSocket client
│   │   └── utils.ts                 # ✅ Utilities
│   ├── store/
│   │   └── useRoomStore.ts          # ✅ Room state
│   ├── components/
│   │   ├── RoomHeader.tsx           # ✅ Room header
│   │   ├── ParticipantsDrawer.tsx   # ✅ Participants list
│   │   └── ui/                      # ✅ Shadcn components
│   └── pages/
│       ├── Landing.tsx              # ✅ Landing page
│       └── Room.tsx                 # ✅ Collaboration room

Backend (Custom - Deploy Separately)
├── src/
│   ├── server.ts            # Fastify/Express setup
│   ├── websocket/
│   │   ├── handler.ts       # WS message routing
│   │   └── yjs-manager.ts   # Yjs document management
│   ├── api/
│   │   └── rooms.ts         # REST endpoints
│   ├── services/
│   │   ├── snapshot.ts      # Save/load snapshots
│   │   └── presence.ts      # Redis presence
│   └── db/
│       └── schema.prisma    # Database schema
```

---

## Next Steps

1. ~~Implement user generation in frontend~~ ✅
2. ~~Set up Yjs binding with tldraw~~ ✅
3. **Build backend** following BACKEND_ARCHITECTURE.md
4. **Connect frontend to backend** WebSocket + y-websocket server
5. **Add snapshot persistence** logic
6. **Test multi-user collaboration**
