import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PenTool, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const Landing = () => {
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) {
      toast.error("Please enter a room ID");
      return;
    }
    const userName = `User-${Math.floor(Math.random() * 1000)}`;
    navigate(`/room/${joinRoomId}?user=${userName}`);
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    const roomId = Math.random().toString(36).substring(2, 10);
    const userName = `User-${Math.floor(Math.random() * 1000)}`;
    toast.success(`Room created: ${roomId}`);
    setTimeout(() => {
      navigate(`/room/${roomId}?user=${userName}&name=${encodeURIComponent(newRoomName || 'Untitled Room')}`);
      setIsCreating(false);
    }, 500);
  };

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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 backdrop-blur-sm border border-primary/20">
            <PenTool className="w-8 h-8 text-primary" />
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
              <Input
                placeholder="Room name (optional)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                className="bg-white/60 border-white/50 focus:bg-white/80 transition-colors h-12"
              />
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
};

export default Landing;
