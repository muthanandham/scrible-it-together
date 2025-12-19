/**
 * Hook for managing anonymous user identity
 * Persists user data in localStorage for session consistency
 */

import { useState, useEffect } from 'react';
import { User } from '@/types/protocol';

const STORAGE_KEY = 'scribble_user';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
];

const ADJECTIVES = [
  'Swift', 'Clever', 'Bold', 'Calm', 'Brave', 'Eager', 'Fancy', 'Gentle',
  'Happy', 'Jolly', 'Kind', 'Lively', 'Merry', 'Noble', 'Polite', 'Quick',
];

const NOUNS = [
  'Panda', 'Tiger', 'Eagle', 'Wolf', 'Bear', 'Fox', 'Owl', 'Hawk',
  'Deer', 'Lion', 'Otter', 'Raven', 'Swan', 'Whale', 'Koala', 'Lynx',
];

function generateUserId(): string {
  return `user_${crypto.randomUUID()}`;
}

function generateUserName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective}${noun}`;
}

function generateUserColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function createNewUser(): User {
  return {
    id: generateUserId(),
    name: generateUserName(),
    color: generateUserColor(),
  };
}

function loadUser(): User | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load user from localStorage:', error);
  }
  return null;
}

function saveUser(user: User): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to save user to localStorage:', error);
  }
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let storedUser = loadUser();
    
    if (!storedUser) {
      storedUser = createNewUser();
      saveUser(storedUser);
    }
    
    setUser(storedUser);
    setIsLoading(false);
  }, []);

  const updateName = (name: string) => {
    if (user) {
      const updated = { ...user, name };
      setUser(updated);
      saveUser(updated);
    }
  };

  const updateColor = (color: string) => {
    if (user) {
      const updated = { ...user, color };
      setUser(updated);
      saveUser(updated);
    }
  };

  const regenerateIdentity = () => {
    const newUser = createNewUser();
    setUser(newUser);
    saveUser(newUser);
  };

  return {
    user,
    isLoading,
    updateName,
    updateColor,
    regenerateIdentity,
  };
}

// Export for direct access without hook
export function getStoredUser(): User {
  const stored = loadUser();
  if (stored) return stored;
  
  const newUser = createNewUser();
  saveUser(newUser);
  return newUser;
}
