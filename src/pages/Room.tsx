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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ArrowRight } from "lucide-react";

// WebSocket server URL - configure this to point to your backend
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

const Room = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get persisted anonymous user
  const { user, isLoading: isUserLoading } = useUser();
  
  // Room creation state
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  
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

  // Room creation handlers
  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) {
      toast.error("Please enter a room ID");
      return;
    }
    navigate(`/room/${joinRoomId}`);
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    const newRoomId = Math.random().toString(36).substring(2, 10);
    const roomName = `Canvas-${newRoomId.slice(0, 4)}`;
    toast.success(`Room created!`);
    setTimeout(() => {
      navigate(`/room/${newRoomId}?name=${encodeURIComponent(roomName)}`);
      setIsCreating(false);
    }, 400);
  };

  useEffect(() => {
    // If no roomId, we're in the lobby - don't try to connect
    if (!roomId) {
      setIsInitializing(false);
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
  if (isUserLoading || (roomId && isInitializing)) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">
            {isUserLoading ? 'Loading user...' : 'Connecting to room...'}
          </p>
        </div>
      </div>
    );
  }

  // No roomId - show room creation/join UI
  if (!roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Gradient background */}
        <div 
          className="absolute inset-0 -z-10"
          style={{
            background: "linear-gradient(135deg, hsl(220 60% 95%) 0%, hsl(270 40% 96%) 50%, hsl(200 50% 95%) 100%)"
          }}
        />
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-purple-400/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        
        <div className="w-full max-w-md space-y-6 animate-fade-in">
          {/* Logo & Title */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 backdrop-blur-sm border border-white/30">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Scrible It
            </h1>
            <p className="text-muted-foreground">
              Collaborative whiteboard for teams
            </p>
          </div>

          {/* Glass Card */}
          <div className="backdrop-blur-xl bg-white/40 border border-white/50 rounded-2xl p-6 shadow-[0_8px_32px_-8px_hsl(230_25%_20%_/_0.15)]">
            {/* Tab Switcher */}
            <div className="flex gap-1 p-1 bg-white/30 rounded-xl mb-6">
              <button
                onClick={() => setActiveTab("create")}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "create"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => setActiveTab("join")}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "join"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Join Room
              </button>
            </div>

            {/* Create Tab */}
            {activeTab === "create" && (
              <div className="space-y-4 animate-fade-in">
                <p className="text-sm text-center text-muted-foreground">
                  Jump right in — no setup needed
                </p>
                <Button 
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                  size="lg"
                >
                  {isCreating ? "Creating..." : "Start Scribbling"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Join Tab */}
            {activeTab === "join" && (
              <div className="space-y-4 animate-fade-in">
                <Input
                  placeholder="Enter Room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  className="bg-white/60 border-white/50 focus:bg-white/80 transition-colors h-12"
                />
                <Button 
                  onClick={handleJoinRoom}
                  className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                  size="lg"
                >
                  Join Room
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Ask someone to share their room link with you
                </p>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="flex justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Real-time sync
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Live cursors
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Export ready
            </span>
          </div>
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
