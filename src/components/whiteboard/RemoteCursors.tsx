import { WhiteboardUser } from '@/types/whiteboard';

interface RemoteCursorsProps {
  users: WhiteboardUser[];
  currentUserId: string;
}

export function RemoteCursors({ users, currentUserId }: RemoteCursorsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {users
        .filter((user) => user.id !== currentUserId && user.cursor)
        .map((user) => (
          <div
            key={user.id}
            className="absolute transition-all duration-75 ease-out"
            style={{
              left: user.cursor!.x,
              top: user.cursor!.y,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Cursor Arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            >
              <path
                d="M5.65376 12.4563L5.65376 4L14.1538 12.4563H9.15376L5.65376 12.4563Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            {/* User Name Tag */}
            <div
              className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </div>
          </div>
        ))}
    </div>
  );
}
