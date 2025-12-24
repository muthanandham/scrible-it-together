import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { RoomHeader } from "@/components/RoomHeader";
import { ParticipantsDrawer } from "@/components/ParticipantsDrawer";
import { WhiteboardCanvas } from "@/components/whiteboard";
import { useRoomStore } from "@/store/useRoomStore";
import { ScribbleWebSocket } from "@/lib/websocket";
import { useUser } from "@/hooks/useUser";
import { useWhiteboardSync } from "@/hooks/useWhiteboardSync";
import { toast } from "sonner";
import { config } from "@/lib/config";

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

  // Whiteboard sync for collaboration
  const { isConnected: isYjsConnected, isSynced, remoteUsers, updateCursor } = useWhiteboardSync({
    roomId: roomId || '',
    userId: user?.id || '',
    userName: user?.name || '',
    userColor: user?.color || '#3b82f6',
  });

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
        
        const ws = new ScribbleWebSocket(config.wsUrl, roomId, user);
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

  // Handle cursor movement
  const handleCursorMove = (x: number, y: number) => {
    updateCursor(x, y);
    
    // Also send via WebSocket for presence
    if (wsRef.current?.isConnected && user) {
      wsRef.current.send({
        type: 'presence',
        clientId: user.id,
        cursor: { x, y },
      });
    }
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
        {/* Connection status indicator */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-card/95 backdrop-blur-sm px-3 py-1.5 rounded-full border shadow-sm">
          <div className={`w-2 h-2 rounded-full ${isYjsConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-xs text-muted-foreground">
            {isYjsConnected ? (isSynced ? 'Synced' : 'Syncing...') : 'Connecting...'}
          </span>
          {remoteUsers.length > 0 && (
            <span className="text-xs text-muted-foreground">
              • {remoteUsers.length + 1} online
            </span>
          )}
        </div>

        <WhiteboardCanvas
          roomId={roomId}
          userId={user?.id || ''}
          userName={user?.name || 'Anonymous'}
          userColor={user?.color || '#3b82f6'}
          onCursorMove={handleCursorMove}
          remoteUsers={remoteUsers}
        />
      </div>

      <ParticipantsDrawer />
    </div>
  );
};

export default Room;
