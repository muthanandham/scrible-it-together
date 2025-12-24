/**
 * Hook for Fabric.js + Yjs synchronization
 * Manages real-time collaboration for the custom whiteboard
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Canvas as FabricCanvas, FabricObject } from 'fabric';
import { config } from '@/lib/config';
import { WhiteboardUser } from '@/types/whiteboard';

interface UseWhiteboardSyncOptions {
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
}

interface UseWhiteboardSyncReturn {
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  isConnected: boolean;
  isSynced: boolean;
  remoteUsers: WhiteboardUser[];
  bindCanvas: (canvas: FabricCanvas) => () => void;
  updateCursor: (x: number, y: number) => void;
}

export function useWhiteboardSync({
  roomId,
  userId,
  userName,
  userColor,
}: UseWhiteboardSyncOptions): UseWhiteboardSyncReturn {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const canvasRef = useRef<FabricCanvas | null>(null);
  const isLocalChange = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<WhiteboardUser[]>([]);

  // Initialize Yjs document and provider
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider(config.yjsWsUrl, `room:${roomId}`, ydoc);
    providerRef.current = provider;

    // Set user awareness
    provider.awareness.setLocalStateField('user', {
      id: userId,
      name: userName,
      color: userColor,
    });

    // Connection status handlers
    provider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    });

    provider.on('sync', (synced: boolean) => {
      setIsSynced(synced);
    });

    // Track remote users
    const updateRemoteUsers = () => {
      const states = provider.awareness.getStates();
      const users: WhiteboardUser[] = [];
      
      states.forEach((state, clientId) => {
        if (state.user && clientId !== provider.awareness.clientID) {
          users.push({
            id: state.user.id,
            name: state.user.name,
            color: state.user.color,
            cursor: state.cursor,
          });
        }
      });
      
      setRemoteUsers(users);
    };

    provider.awareness.on('change', updateRemoteUsers);

    return () => {
      provider.awareness.off('change', updateRemoteUsers);
      provider.disconnect();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [roomId, userId, userName, userColor]);

  // Update cursor position
  const updateCursor = useCallback((x: number, y: number) => {
    const provider = providerRef.current;
    if (!provider) return;

    provider.awareness.setLocalStateField('cursor', { x, y });
  }, []);

  // Bind Fabric.js canvas to Yjs document
  const bindCanvas = useCallback((canvas: FabricCanvas) => {
    if (!ydocRef.current) return () => {};

    canvasRef.current = canvas;
    const ydoc = ydocRef.current;
    const yObjects = ydoc.getMap<string>('fabric_objects');

    // Load existing objects from Yjs
    if (yObjects.size > 0) {
      const objects: Record<string, unknown>[] = [];
      yObjects.forEach((jsonStr) => {
        try {
          objects.push(JSON.parse(jsonStr));
        } catch (e) {
          console.error('Failed to parse object:', e);
        }
      });

      if (objects.length > 0) {
        canvas.loadFromJSON({ objects, background: '#ffffff' }).then(() => {
          canvas.renderAll();
        });
      }
    }

    // Generate unique ID for objects
    const generateId = () => `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Sync local changes to Yjs
    const syncToYjs = () => {
      if (isLocalChange.current) return;

      ydoc.transact(() => {
        const currentObjects = canvas.getObjects();
        const currentIds = new Set<string>();

        currentObjects.forEach((obj) => {
          // Ensure object has an ID
          if (!(obj as unknown as { id?: string }).id) {
            (obj as unknown as { id: string }).id = generateId();
          }
          
          const objId = (obj as unknown as { id: string }).id;
          currentIds.add(objId);
          
          const json = JSON.stringify(obj.toJSON());
          yObjects.set(objId, json);
        });

        // Remove deleted objects
        yObjects.forEach((_, key) => {
          if (!currentIds.has(key)) {
            yObjects.delete(key);
          }
        });
      }, 'local');
    };

    // Listen to canvas events
    canvas.on('object:added', syncToYjs);
    canvas.on('object:modified', syncToYjs);
    canvas.on('object:removed', syncToYjs);
    canvas.on('path:created', syncToYjs);

    // Listen to Yjs changes and apply to canvas
    const handleYjsChange = () => {
      if (!canvasRef.current) return;
      
      isLocalChange.current = true;

      const objects: Record<string, unknown>[] = [];
      yObjects.forEach((jsonStr) => {
        try {
          objects.push(JSON.parse(jsonStr));
        } catch (e) {
          console.error('Failed to parse object:', e);
        }
      });

      canvas.loadFromJSON({ objects, background: '#ffffff' }).then(() => {
        canvas.renderAll();
        isLocalChange.current = false;
      });
    };

    yObjects.observe(handleYjsChange);

    return () => {
      canvas.off('object:added', syncToYjs);
      canvas.off('object:modified', syncToYjs);
      canvas.off('object:removed', syncToYjs);
      canvas.off('path:created', syncToYjs);
      yObjects.unobserve(handleYjsChange);
    };
  }, [userId]);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    isConnected,
    isSynced,
    remoteUsers,
    bindCanvas,
    updateCursor,
  };
}
