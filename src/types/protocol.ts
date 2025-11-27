/**
 * Scrible_it WebSocket Protocol Types
 * Defines all message types for real-time collaboration
 */

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  color: string;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  visibility: 'public' | 'private';
  passwordHash?: string;
  createdAt: string;
  lastActive: string;
}

export interface Participant {
  userId: string;
  clientId: string;
  user: User;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  cursor?: { x: number; y: number };
  viewport?: { x: number; y: number; zoom: number };
  selection?: string[];
}

// WebSocket Message Types
export type WSMessage =
  | ConnectMessage
  | JoinMessage
  | PresenceMessage
  | UpdateMessage
  | SyncRequestMessage
  | SyncResponseMessage
  | ChatMessage
  | HeartbeatMessage
  | LeaveMessage
  | ErrorMessage;

export interface ConnectMessage {
  type: 'connect';
  token?: string;
  roomId: string;
  user: User;
}

export interface JoinMessage {
  type: 'join';
  user: User;
  clientId: string;
  roomId: string;
}

export interface PresenceMessage {
  type: 'presence';
  clientId: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  viewport?: { x: number; y: number; zoom: number };
  userName?: string;
}

export interface UpdateMessage {
  type: 'update';
  clientId: string;
  delta: string; // base64 encoded Yjs update
  version: number;
}

export interface SyncRequestMessage {
  type: 'sync-request';
  clientStateVersion: number;
}

export interface SyncResponseMessage {
  type: 'sync-response';
  snapshotData: string; // base64 encoded Yjs state
  version: number;
}

export interface ChatMessage {
  type: 'chat';
  clientId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
}

export interface LeaveMessage {
  type: 'leave';
  clientId: string;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

// Room state
export interface RoomState {
  room: Room;
  participants: Map<string, Participant>;
  isConnected: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
}

// Export options
export type ExportFormat = 'png' | 'svg' | 'json' | 'pdf';

export interface ExportRequest {
  roomId: string;
  format: ExportFormat;
  quality?: number;
}
