/**
 * Application configuration
 * For local development, run the backend with Docker: cd backend && docker-compose up
 */

export const config = {
  // WebSocket server URL for custom protocol (rooms API, chat, presence)
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws',
  
  // Yjs WebSocket URL for CRDT sync (y-websocket provider)
  yjsWsUrl: import.meta.env.VITE_YJS_WS_URL || 'ws://localhost:1234',
  
  // REST API URL
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
} as const;
