import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Tldraw, TLUiOverrides } from "tldraw";
import "tldraw/tldraw.css";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantsDrawer } from "@/components/ParticipantsDrawer";
import { useRoomStore } from "@/store/useRoomStore";
import { ScribbleWebSocket } from "@/lib/websocket";
import { useUser } from "@/hooks/useUser";
import { useYjsSync } from "@/hooks/useYjsSync";
import { useCollaborativeCursors } from "@/hooks/useCollaborativeCursors";
import { toast } from "sonner";

// WebSocket server URL - configure this to point to your backend
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get persisted anonymous user
  const { user, isLoading: isUserLoading } = useUser();
  
  const {
    setWebSocket,
    setConnectionState,
    setRoomId,
    setRoomName,
    setCurrentUser,
    addParticipant,
    removeParticipant,
    updateParticipant,
    reset,
  } = useRoomStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const wsRef = useRef<ScribbleWebSocket | null>(null);

  // Yjs sync for collaboration - only init when we have a roomId
  const { provider, isConnected: isYjsConnected, isSynced, bindEditor } = useYjsSync({
    roomId: roomId || '',
    userId: user?.id || '',
    userName: user?.name || '',
    userColor: user?.color || '#3b82f6',
  });

  // Collaborative cursors
  const { cursors, updateCursor } = useCollaborativeCursors(provider);

  // Auto-create room if no roomId
  useEffect(() => {
    if (!roomId && !isUserLoading) {
      const newRoomId = Math.random().toString(36).substring(2, 10);
      const roomName = `Canvas-${newRoomId.slice(0, 4)}`;
      navigate(`/room/${newRoomId}?name=${encodeURIComponent(roomName)}`, { replace: true });
    }
  }, [roomId, isUserLoading, navigate]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    if (isUserLoading || !user) return;

    const roomName = searchParams.get('name') || 'Untitled Room';

    // Set room info
    setRoomId(roomId);
    setRoomName(roomName);
    setCurrentUser(user);

    // Initialize WebSocket connection for presence/signaling
    const initWebSocket = async () => {
      try {
        setConnectionState('connecting');
        
        const ws = new ScribbleWebSocket(WS_URL, roomId, user);
        wsRef.current = ws;
        setWebSocket(ws);

        // Set up message handlers
        const unsubscribe = ws.onMessage((message) => {
          console.log('📨 Received message:', message.type);
          
          switch (message.type) {
            case 'join':
              addParticipant({
                userId: message.user.id,
                clientId: message.clientId,
                user: message.user,
                role: 'editor',
                joinedAt: new Date().toISOString(),
              });
              toast.success(`${message.user.name} joined the room`);
              break;

            case 'leave':
              removeParticipant(message.clientId);
              break;

            case 'presence':
              updateParticipant(message.clientId, {
                cursor: message.cursor,
                selection: message.selection,
                viewport: message.viewport,
              });
              break;

            case 'chat':
              toast.info(`${message.userName}: ${message.message}`);
              break;

            case 'error':
              toast.error(`Error: ${message.message}`);
              break;
          }
        });

        // Connect to WebSocket
        await ws.connect();
        setConnectionState('connected');
        setIsInitializing(false);
        
        toast.success('Connected to room!');

        return () => {
          unsubscribe();
          ws.disconnect();
        };
      } catch (error) {
        console.error('Failed to connect:', error);
        setConnectionState('disconnected');
        setIsInitializing(false);
        toast.error('Failed to connect to room. Using offline mode.');
      }
    };

    initWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
      reset();
    };
  }, [roomId, user, isUserLoading]);

  // Custom UI overrides for tldraw
  const uiOverrides: TLUiOverrides = {
    tools(editor, tools) {
      return tools;
    },
  };

  // Loading state
  if (isUserLoading || !roomId || isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">
            {isUserLoading ? 'Loading...' : !roomId ? 'Creating room...' : 'Connecting...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <RoomHeader />
      
      <div className="flex-1 relative">
        {/* Yjs connection status indicator */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border">
          <div className={`w-2 h-2 rounded-full ${isYjsConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-xs text-muted-foreground">
            {isYjsConnected ? (isSynced ? 'Synced' : 'Syncing...') : 'Connecting...'}
          </span>
          {cursors.length > 0 && (
            <span className="text-xs text-muted-foreground">
              • {cursors.length} online
            </span>
          )}
        </div>

        <Tldraw
          overrides={uiOverrides}
          onMount={(editor) => {
            console.log('🎨 Tldraw editor mounted');
            
            // Bind Yjs for collaboration
            bindEditor(editor);
            
            // Track cursor for collaborative cursors
            editor.on('event', (event) => {
              if (event.type === 'pointer' && 'point' in event) {
                const { x, y } = event.point;
                updateCursor({ x, y });
                
                // Also send via WebSocket for presence
                if (wsRef.current?.isConnected) {
                  wsRef.current.send({
                    type: 'presence',
                    clientId: user?.id || '',
                    cursor: { x, y },
                  });
                }
              }
            });
          }}
        />

        {/* Render collaborative cursors */}
        {cursors.map((cursor) => (
          cursor.cursor && (
            <div
              key={cursor.id}
              className="absolute pointer-events-none z-50 transition-all duration-75"
              style={{
                left: cursor.cursor.x,
                top: cursor.cursor.y,
                transform: 'translate(-2px, -2px)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.85 2.85a.5.5 0 0 0-.35.36Z"
                  fill={cursor.color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              </svg>
              <span
                className="absolute left-4 top-4 px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
                style={{ backgroundColor: cursor.color }}
              >
                {cursor.name}
              </span>
            </div>
          )
        ))}
      </div>

      <ParticipantsDrawer />
    </div>
  );
};

export default Room;
