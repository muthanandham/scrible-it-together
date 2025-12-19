/**
 * Hook for Yjs document synchronization
 * Manages the Yjs document and WebSocket provider for real-time collaboration
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Editor, TLRecord, StoreSnapshot, TLStoreSnapshot, createTLStore, defaultShapeUtils } from 'tldraw';

const YJS_WS_URL = import.meta.env.VITE_YJS_WS_URL || 'ws://localhost:1234';

interface UseYjsSyncOptions {
  roomId: string;
  userId: string;
  userName: string;
  userColor: string;
}

interface UseYjsSyncReturn {
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  isConnected: boolean;
  isSynced: boolean;
  awareness: WebsocketProvider['awareness'] | null;
  bindEditor: (editor: Editor) => void;
}

export function useYjsSync({ roomId, userId, userName, userColor }: UseYjsSyncOptions): UseYjsSyncReturn {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const isLocalChange = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Initialize Yjs document and provider
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider(YJS_WS_URL, `room:${roomId}`, ydoc);
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

    return () => {
      provider.disconnect();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [roomId, userId, userName, userColor]);

  // Bind tldraw editor to Yjs document
  const bindEditor = useCallback((editor: Editor) => {
    if (!ydocRef.current) return;
    
    editorRef.current = editor;
    const ydoc = ydocRef.current;
    const yRecords = ydoc.getMap<TLRecord>('tldraw_records');

    // Initialize from Yjs if there's existing data
    if (yRecords.size > 0) {
      const records: TLRecord[] = [];
      yRecords.forEach((record) => {
        records.push(record);
      });
      
      // Apply existing records to editor
      editor.store.mergeRemoteChanges(() => {
        records.forEach((record) => {
          if (!editor.store.has(record.id)) {
            editor.store.put([record]);
          }
        });
      });
    }

    // Listen to local tldraw changes and sync to Yjs
    const unsubscribe = editor.store.listen(
      ({ changes }) => {
        if (isLocalChange.current) return;
        
        ydoc.transact(() => {
          // Handle added records
          Object.values(changes.added).forEach((record) => {
            yRecords.set(record.id, record);
          });

          // Handle updated records
          Object.values(changes.updated).forEach(([, record]) => {
            yRecords.set(record.id, record);
          });

          // Handle removed records
          Object.values(changes.removed).forEach((record) => {
            yRecords.delete(record.id);
          });
        }, 'local');
      },
      { source: 'user', scope: 'document' }
    );

    // Listen to Yjs changes and apply to tldraw
    const handleYjsChange = (events: Y.YMapEvent<TLRecord>[], transaction: Y.Transaction) => {
      if (transaction.origin === 'local') return;
      
      isLocalChange.current = true;
      
      editor.store.mergeRemoteChanges(() => {
        events.forEach((event) => {
          event.changes.keys.forEach((change, key) => {
            if (change.action === 'add' || change.action === 'update') {
              const record = yRecords.get(key);
              if (record) {
                editor.store.put([record]);
              }
            } else if (change.action === 'delete') {
              if (editor.store.has(key as TLRecord['id'])) {
                editor.store.remove([key as TLRecord['id']]);
              }
            }
          });
        });
      });
      
      isLocalChange.current = false;
    };

    yRecords.observeDeep(handleYjsChange);

    return () => {
      unsubscribe();
      yRecords.unobserveDeep(handleYjsChange);
    };
  }, []);

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    isConnected,
    isSynced,
    awareness: providerRef.current?.awareness ?? null,
    bindEditor,
  };
}
