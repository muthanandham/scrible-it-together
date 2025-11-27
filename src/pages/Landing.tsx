import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PenTool, Users, Zap, Globe } from "lucide-react";
import { toast } from "sonner";

const Landing = () => {
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleJoinRoom = () => {
    if (!joinRoomId.trim()) {
      toast.error("Please enter a room ID");
      return;
    }
    
    // Generate random user name for demo (in production, would come from auth)
    const userName = `User-${Math.floor(Math.random() * 1000)}`;
    navigate(`/room/${joinRoomId}?user=${userName}`);
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    
    // Generate a random room ID (in production, this would be from backend)
    const roomId = Math.random().toString(36).substring(2, 10);
    const userName = `User-${Math.floor(Math.random() * 1000)}`;
    
    toast.success(`Room created: ${roomId}`);
    
    // Navigate to the new room
    setTimeout(() => {
      navigate(`/room/${roomId}?user=${userName}&name=${encodeURIComponent(newRoomName || 'Untitled Room')}`);
      setIsCreating(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            <PenTool className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            Scrible It
          </h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            Collaborative Sketching
          </p>
          <p className="text-muted-foreground">
            Real-time whiteboard collaboration powered by tldraw and WebSocket
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-card hover:shadow-card-hover transition-shadow duration-300">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Get Started</CardTitle>
            <CardDescription>
              Join an existing room or create a new one
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Create Room Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Create New Room
              </h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Room name (optional)"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  className="bg-primary hover:bg-primary-hover text-primary-foreground px-8"
                  size="lg"
                >
                  {isCreating ? "Creating..." : "Create Room"}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* Join Room Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Join Existing Room
              </h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Enter Room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleJoinRoom}
                  variant="secondary"
                  size="lg"
                  className="px-8"
                >
                  Join Room
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Need a Room ID? Ask someone to share their room link
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="pt-6 space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold">Real-time Collaboration</h3>
              <p className="text-sm text-muted-foreground">
                Work together with live cursors and instant updates
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6 space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold">Powerful Tools</h3>
              <p className="text-sm text-muted-foreground">
                Full drawing toolkit with shapes, text, and more
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6 space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold">Share Anywhere</h3>
              <p className="text-sm text-muted-foreground">
                Invite anyone with a simple room link
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Powered by{" "}
            <a href="https://tldraw.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              tldraw
            </a>
            {" "}and WebSocket for seamless real-time collaboration
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
