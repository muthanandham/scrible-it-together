/**
 * Zustand store for room state management
 */

import { create } from 'zustand';
import { Participant, User } from '@/types/protocol';
import { ScribbleWebSocket } from '@/lib/websocket';

interface RoomStore {
  // Connection state
  ws: ScribbleWebSocket | null;
  isConnected: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  
  // Room data
  roomId: string | null;
  roomName: string | null;
  
  // Participants
  participants: Map<string, Participant>;
  currentUser: User | null;
  
  // UI state
  showParticipants: boolean;
  showChat: boolean;
  
  // Actions
  setWebSocket: (ws: ScribbleWebSocket | null) => void;
  setConnectionState: (state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void;
  setRoomId: (roomId: string | null) => void;
  setRoomName: (name: string | null) => void;
  setCurrentUser: (user: User | null) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (clientId: string) => void;
  updateParticipant: (clientId: string, updates: Partial<Participant>) => void;
  toggleParticipants: () => void;
  toggleChat: () => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  // Initial state
  ws: null,
  isConnected: false,
  connectionState: 'disconnected',
  roomId: null,
  roomName: null,
  participants: new Map(),
  currentUser: null,
  showParticipants: false,
  showChat: false,

  // Actions
  setWebSocket: (ws) => set({ ws, isConnected: ws?.isConnected ?? false }),
  
  setConnectionState: (connectionState) => 
    set({ connectionState, isConnected: connectionState === 'connected' }),
  
  setRoomId: (roomId) => set({ roomId }),
  
  setRoomName: (roomName) => set({ roomName }),
  
  setCurrentUser: (currentUser) => set({ currentUser }),
  
  addParticipant: (participant) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.set(participant.clientId, participant);
      return { participants };
    }),
  
  removeParticipant: (clientId) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.delete(clientId);
      return { participants };
    }),
  
  updateParticipant: (clientId, updates) =>
    set((state) => {
      const participants = new Map(state.participants);
      const participant = participants.get(clientId);
      if (participant) {
        participants.set(clientId, { ...participant, ...updates });
      }
      return { participants };
    }),
  
  toggleParticipants: () => set((state) => ({ showParticipants: !state.showParticipants })),
  
  toggleChat: () => set((state) => ({ showChat: !state.showChat })),
  
  reset: () =>
    set({
      ws: null,
      isConnected: false,
      connectionState: 'disconnected',
      roomId: null,
      roomName: null,
      participants: new Map(),
      showParticipants: false,
      showChat: false,
    }),
}));
