'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

import { ComposeModal } from './ComposeModal';
import type { PostSummary } from './PostCard';

interface ComposeContextValue {
  open: () => void;
  subscribe: (listener: (post: PostSummary) => void) => () => void;
}

const ComposeContext = createContext<ComposeContextValue | undefined>(undefined);

export function ComposeProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const listenersRef = useRef(new Set<(post: PostSummary) => void>());

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const subscribe = useCallback((listener: (post: PostSummary) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const handlePostCreated = useCallback((post: PostSummary) => {
    listenersRef.current.forEach((listener) => listener(post));
  }, []);

  return (
    <ComposeContext.Provider value={{ open, subscribe }}>
      {children}
      <ComposeModal open={isOpen} onClose={close} onPostCreated={handlePostCreated} />
    </ComposeContext.Provider>
  );
}

export function useCompose() {
  const context = useContext(ComposeContext);
  if (!context) {
    throw new Error('useCompose must be used within ComposeProvider');
  }
  return context;
}
