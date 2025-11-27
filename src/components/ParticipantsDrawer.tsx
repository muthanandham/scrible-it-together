import { useRoomStore } from "@/store/useRoomStore";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { Participant } from "@/types/protocol";

const PRESENCE_COLORS = [
  'hsl(var(--presence-1))',
  'hsl(var(--presence-2))',
  'hsl(var(--presence-3))',
  'hsl(var(--presence-4))',
  'hsl(var(--presence-5))',
];

export const ParticipantsDrawer = () => {
  const { showParticipants, toggleParticipants, participants } = useRoomStore();
  
  const participantsList = Array.from(participants.values());

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role: Participant['role']) => {
    switch (role) {
      case 'owner':
        return 'bg-primary text-primary-foreground';
      case 'editor':
        return 'bg-secondary text-secondary-foreground';
      case 'viewer':
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Sheet open={showParticipants} onOpenChange={toggleParticipants}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Participants ({participantsList.length})
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
          <div className="space-y-3">
            {participantsList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No participants yet</p>
                <p className="text-sm">Share the room link to invite others</p>
              </div>
            ) : (
              participantsList.map((participant, index) => {
                const colorIndex = index % PRESENCE_COLORS.length;
                const borderColor = PRESENCE_COLORS[colorIndex];
                
                return (
                  <div
                    key={participant.clientId}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Avatar 
                      className="w-10 h-10 border-2"
                      style={{ borderColor }}
                    >
                      <AvatarFallback 
                        className="text-sm font-semibold"
                        style={{ backgroundColor: `${borderColor}20` }}
                      >
                        {getInitials(participant.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {participant.user.name}
                        </p>
                        {participant.cursor && (
                          <div 
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ backgroundColor: borderColor }}
                            title="Active"
                          />
                        )}
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getRoleColor(participant.role)}`}
                      >
                        {participant.role}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
