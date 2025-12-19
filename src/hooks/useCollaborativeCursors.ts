/**
 * Hook for managing collaborative cursors from Yjs awareness
 */

import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';

export interface RemoteCursor {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

export function useCollaborativeCursors(provider: WebsocketProvider | null) {
  const [cursors, setCursors] = useState<Map<number, RemoteCursor>>(new Map());

  useEffect(() => {
    if (!provider) return;

    const awareness = provider.awareness;

    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const newCursors = new Map<number, RemoteCursor>();

      states.forEach((state, clientId) => {
        // Skip our own cursor
        if (clientId === awareness.clientID) return;
        
        if (state.user) {
          newCursors.set(clientId, {
            id: state.user.id,
            name: state.user.name,
            color: state.user.color,
            cursor: state.cursor,
          });
        }
      });

      setCursors(newCursors);
    };

    awareness.on('change', handleAwarenessChange);
    
    // Initial load
    handleAwarenessChange();

    return () => {
      awareness.off('change', handleAwarenessChange);
    };
  }, [provider]);

  const updateCursor = (position: { x: number; y: number } | null) => {
    if (!provider) return;
    provider.awareness.setLocalStateField('cursor', position);
  };

  return {
    cursors: Array.from(cursors.values()),
    updateCursor,
  };
}
