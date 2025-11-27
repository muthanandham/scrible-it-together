import { useRoomStore } from "@/store/useRoomStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Share2, Activity, Home } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const RoomHeader = () => {
  const navigate = useNavigate();
  const { roomId, roomName, participants, connectionState, toggleParticipants } = useRoomStore();
  
  const participantCount = participants.size;

  const handleShare = () => {
    if (!roomId) return;
    
    const shareUrl = `${window.location.origin}/room/${roomId}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join my Scrible_it room',
        text: `Collaborate with me on Scrible_it!`,
        url: shareUrl,
      }).catch(() => {
        // Fallback to clipboard
        copyToClipboard(shareUrl);
      });
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Room link copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  const getConnectionBadge = () => {
    switch (connectionState) {
      case 'connected':
        return <Badge className="bg-green-500 text-white">Connected</Badge>;
      case 'connecting':
        return <Badge variant="secondary">Connecting...</Badge>;
      case 'reconnecting':
        return <Badge variant="destructive">Reconnecting...</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Disconnected</Badge>;
    }
  };

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shadow-sm">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/')}
          title="Back to home"
        >
          <Home className="w-5 h-5" />
        </Button>
        
        <div className="h-6 w-px bg-border" />
        
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-lg">
            {roomName || 'Untitled Room'}
          </h1>
          {getConnectionBadge()}
        </div>
      </div>

      {/* Center section - Room ID and activity */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          <span>Room: <span className="font-mono font-semibold text-foreground">{roomId}</span></span>
        </div>
        
        {participantCount > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <span>{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleParticipants}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">Participants</span>
          {participantCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {participantCount}
            </Badge>
          )}
        </Button>

        <Button
          onClick={handleShare}
          size="sm"
          className="gap-2"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </div>
    </header>
  );
};
