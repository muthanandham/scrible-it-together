import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Tldraw, TLUiOverrides } from "tldraw";
import "tldraw/tldraw.css";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantsDrawer } from "@/components/ParticipantsDrawer";
import { useRoomStore } from "@/store/useRoomStore";
import { ScribbleWebSocket } from "@/lib/websocket";
import { User } from "@/types/protocol";
import { toast } from "sonner";

// WebSocket server URL - configure this to point to your backend
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
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

  useEffect(() => {
    if (!roomId) {
      toast.error("Invalid room ID");
      navigate("/");
      return;
    }

    // Get user info from URL params (in production, this would come from auth)
    const userName = searchParams.get('user') || `User-${Math.random().toString(36).substring(7)}`;
    const roomName = searchParams.get('name') || 'Untitled Room';
    
    // Generate random color for user
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4'];
    const userColor = colors[Math.floor(Math.random() * colors.length)];

    const user: User = {
      id: Math.random().toString(36).substring(2),
      name: userName,
      color: userColor,
    };

    // Set room info
    setRoomId(roomId);
    setRoomName(roomName);
    setCurrentUser(user);

    // Initialize WebSocket connection
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

            case 'update':
              // Handle drawing updates (would integrate with tldraw + Yjs)
              console.log('Drawing update received');
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
  }, [roomId]);

  // Custom UI overrides for tldraw
  const uiOverrides: TLUiOverrides = {
    tools(editor, tools) {
      // You can customize tools here
      return tools;
    },
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Connecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <RoomHeader />
      
      <div className="flex-1 relative">
        <Tldraw
          overrides={uiOverrides}
          onMount={(editor) => {
            console.log('🎨 Tldraw editor mounted', editor);
            
            // Example: Listen to pointer events for presence
            editor.on('event', (event) => {
              if (event.type === 'pointer' && 'point' in event && wsRef.current?.isConnected) {
                const { x, y } = event.point;
                wsRef.current.send({
                  type: 'presence',
                  clientId: useRoomStore.getState().currentUser?.id || '',
                  cursor: { x, y },
                });
              }
            });
          }}
        />
      </div>

      <ParticipantsDrawer />
    </div>
  );
};

export default Room;
