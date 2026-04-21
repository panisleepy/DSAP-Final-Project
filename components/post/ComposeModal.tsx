'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { CalendarClock, Loader2, Trash2, X } from 'lucide-react';

import { measureTweetLength } from '@/lib/text-counter';
import type { PostSummary } from './PostCard';
import { ImageUploader } from './ImageUploader';

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onPostCreated?: (post: PostSummary) => void;
}

interface DraftSummary {
  id: string;
  content: string;
  updatedAt: string;
  createdAt: string;
}

export function ComposeModal({ open, onClose, onPostCreated }: ComposeModalProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [closePrompt, setClosePrompt] = useState(false);
  const containerRef = useRef<HTMLFormElement>(null);

  const counter = useMemo(() => measureTweetLength(content), [content]);
  const canPost = counter.isValid && Boolean(content.trim()) && !submitting;
  const hasTypedContent = Boolean(content.trim());

  const resetState = useCallback(() => {
    setContent('');
    setImageUrl(null);
    setError(null);
    setSubmitting(false);
    setSavingDraft(false);
    setShowDrafts(false);
    setDraftsLoading(false);
    setDrafts([]);
    setCurrentDraftId(null);
    setClosePrompt(false);
  }, []);

  const finalizeClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleRequestClose = useCallback(() => {
    if (submitting || savingDraft) return;
    if (!hasTypedContent && !currentDraftId) {
      finalizeClose();
      return;
    }
    setClosePrompt(true);
  }, [currentDraftId, finalizeClose, hasTypedContent, savingDraft, submitting]);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleRequestClose();
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      handleRequestClose();
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [currentDraftId, handleRequestClose, open, resetState]);

  if (!open) {
    return null;
  }

  const fetchDrafts = async () => {
    try {
      setDraftsLoading(true);
      const response = await fetch('/api/drafts');
      if (!response.ok) {
        throw new Error('Failed to load drafts');
      }
      const data = (await response.json()) as DraftSummary[];
      setDrafts(data);
      setShowDrafts(true);
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof Error ? caught.message : 'Unable to load drafts');
    } finally {
      setDraftsLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!hasTypedContent) {
      setError('Nothing to save.');
      return;
    }

    try {
      setSavingDraft(true);
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentDraftId ?? undefined, content }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Unable to save draft');
      }

      const draft = (await response.json()) as DraftSummary;
      setCurrentDraftId(draft.id);
      setDrafts((prev) => {
        const filtered = prev.filter((item) => item.id !== draft.id);
        return [{ ...draft }, ...filtered];
      });
      finalizeClose();
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof Error ? caught.message : 'Unable to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDiscard = async () => {
    if (currentDraftId) {
      await fetch(`/api/drafts/${currentDraftId}`, { method: 'DELETE' }).catch((error) =>
        console.error('Failed to delete draft', error),
      );
    }
    finalizeClose();
  };

  const handleSelectDraft = async (draft: DraftSummary) => {
    setCurrentDraftId(draft.id);
    setContent(draft.content);
    setShowDrafts(false);
    setError(null);
  };

  const handleDeleteDraft = async (draftId: string) => {
    await fetch(`/api/drafts/${draftId}`, { method: 'DELETE' }).catch((error) =>
      console.error('Failed to delete draft', error),
    );
    setDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
    if (currentDraftId === draftId) {
      setCurrentDraftId(null);
      setContent('');
    }
  };

  const handleContentChange = (value: string) => {
    const metrics = measureTweetLength(value);
    if (metrics.remaining < 0) {
      return;
    }
    setContent(value);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canPost) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, imageUrl }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Unable to post');
      }
      const createdPost = (await response.json()) as PostSummary;

      if (currentDraftId) {
        await fetch(`/api/drafts/${currentDraftId}`, { method: 'DELETE' }).catch((error) =>
          console.error('Failed to delete draft after posting', error),
        );
      }

      setDrafts((prev) => prev.filter((draft) => draft.id !== currentDraftId));
      resetState();
      setImageUrl(null);
      onPostCreated?.(createdPost);
      onClose();
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderDraftsPanel = () => (
    <div className="absolute inset-0 z-20 flex flex-col rounded-3xl bg-white/98 p-6 shadow-inner">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brandText">Drafts</h3>
        <button
          type="button"
          onClick={() => setShowDrafts(false)}
          className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-brandText"
        >
          <X size={18} />
        </button>
      </header>

      {draftsLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading drafts…
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          You don’t have any drafts yet.
        </div>
      ) : (
        <ul className="flex-1 space-y-3 overflow-y-auto">
          {drafts.map((draft) => (
            <li key={draft.id} className="rounded-2xl border border-brandPink/30 bg-white p-4">
              <button
                type="button"
                onClick={() => handleSelectDraft(draft)}
                className="block w-full text-left text-sm text-brandText"
              >
                <p className="line-clamp-3 whitespace-pre-wrap">{draft.content}</p>
              </button>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <CalendarClock size={14} />
                  {new Date(draft.updatedAt ?? draft.createdAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteDraft(draft.id)}
                  className="flex items-center gap-1 rounded-xl px-2 py-1 text-red-500 transition hover:bg-red-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderClosePrompt = () => (
    <div className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-white/90 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-brandPink/40 bg-white p-6 text-sm text-brandText shadow-xl">
        <h3 className="text-lg font-semibold">Discard this murmur?</h3>
        <p className="text-gray-500">You can save it to drafts and come back later, or discard it permanently.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="rounded-2xl bg-gradient-to-r from-brandBlue to-brandPink px-4 py-2 text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingDraft ? 'Saving…' : 'Save to drafts'}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded-2xl border border-brandPink/40 px-4 py-2 text-red-500 transition hover:bg-brandPink/10"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => setClosePrompt(false)}
            className="rounded-2xl border border-gray-200 px-4 py-2 text-gray-500 transition hover:bg-gray-100"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-brandText/40 backdrop-blur-md">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
        ref={containerRef}
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleRequestClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={() => (showDrafts ? setShowDrafts(false) : fetchDrafts())}
            className="rounded-2xl border border-brandBlue/30 px-3 py-1 text-xs font-semibold text-brandBlue transition hover:bg-brandBlue/10"
          >
            {showDrafts ? 'Close drafts' : 'Drafts'}
          </button>
        </div>

        <h2 className="mb-3 text-lg font-semibold text-brandText">What’s happening?</h2>

        <div className="flex gap-4">
          <span className="mt-1 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brandBlue/60 to-brandPink/60">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.alias ?? 'avatar'}
                width={48}
                height={48}
                className="h-12 w-12 object-cover"
              />
            ) : (
              <span className="text-lg font-semibold text-brandText">
                {session?.user?.name?.slice(0, 1) ?? '?'}
              </span>
            )}
          </span>

          <div className="flex-1">
            <textarea
              value={content}
              onChange={(event) => handleContentChange(event.target.value)}
              placeholder="Share a gentle murmur..."
              className="h-32 w-full resize-none rounded-2xl border border-white bg-brandPink/10 p-4 text-base text-brandText focus:border-brandPink/60 focus:outline-none focus:ring-2 focus:ring-brandPink/40"
              disabled={submitting}
            />
        <ImageUploader value={imageUrl} onChange={setImageUrl} disabled={submitting} />
            <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
              <span className={counter.remaining < 0 ? 'text-red-500' : ''}>{counter.remaining}</span>
              <button
                type="submit"
                disabled={!canPost}
                className="rounded-2xl bg-gradient-to-r from-brandBlue to-brandPink px-4 py-2 text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>
        </div>

        {showDrafts && renderDraftsPanel()}
        {closePrompt && renderClosePrompt()}
      </form>
    </div>
  );
}
