export interface User {
  id: string;
  name: string;
  color: string;
}

export interface Participant {
  userId: string;
  clientId: string;
  user: User;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  cursor?: { x: number; y: number };
  selection?: string[];
}

// Client -> Server messages
export type ClientMessage =
  | ConnectMessage
  | UpdateMessage
  | PresenceMessage
  | LeaveMessage
  | HeartbeatMessage
  | ChatMessage;

export interface ConnectMessage {
  type: 'connect';
  roomId: string;
  user: User;
  token?: string;
}

export interface UpdateMessage {
  type: 'update';
  delta: string; // base64 encoded Yjs update
}

export interface PresenceMessage {
  type: 'presence';
  clientId: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface LeaveMessage {
  type: 'leave';
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
}

export interface ChatMessage {
  type: 'chat';
  userName: string;
  message: string;
  timestamp: number;
}

// Server -> Client messages
export type ServerMessage =
  | JoinBroadcast
  | LeaveBroadcast
  | SyncResponse
  | UpdateBroadcast
  | PresenceBroadcast
  | ErrorMessage
  | RoomState;

export interface JoinBroadcast {
  type: 'join';
  user: User;
  clientId: string;
  roomId: string;
}

export interface LeaveBroadcast {
  type: 'leave';
  clientId: string;
  userId: string;
}

export interface SyncResponse {
  type: 'sync-response';
  snapshotData: string; // base64 encoded
  participants: Participant[];
}

export interface UpdateBroadcast {
  type: 'update';
  delta: string; // base64 encoded Yjs update
  from: string;
}

export interface PresenceBroadcast {
  type: 'presence';
  clientId: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface RoomState {
  type: 'room-state';
  roomId: string;
  roomName: string;
  participants: Participant[];
}
