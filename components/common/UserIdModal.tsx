"use client";

import { FormEvent, useEffect, useState, startTransition } from "react";
import { useSession } from "next-auth/react";

const USER_ID_REGEX = /^[a-zA-Z0-9_]+$/;

export function UserIdModal() {
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const user = session?.user;

  useEffect(() => {
    const shouldOpen = Boolean(user && !user.userIdSet);
    startTransition(() => {
      setOpen(shouldOpen);
      if (shouldOpen) {
        setValue("");
        setError(null);
      }
    });
  }, [user]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) {
      setError("Please enter a user ID");
      return;
    }

    if (value.length < 3 || value.length > 20) {
      setError("User ID must be between 3 and 20 characters");
      return;
    }

    if (!USER_ID_REGEX.test(value)) {
      setError("Only letters, numbers, and underscores are allowed");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/user-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: value }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Unable to save user ID");
        setSubmitting(false);
        return;
      }

      await update?.({
        user: {
          alias: value,
          userIdSet: true,
        },
      });

      setSubmitting(false);
      setOpen(false);
    } catch (error) {
      console.error(error);
      setError("Unexpected error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-brandText/40 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-2xl font-semibold text-brandText">Pick your user ID</h2>
        <p className="mt-2 text-sm text-gray-500">
          This will be your unique handle (e.g. <span className="font-mono">@murmur_user</span>). You can’t change it later, so choose wisely.
        </p>

        <input
          value={value}
          onChange={(event) => setValue(event.target.value.trim())}
          placeholder="your_user_id"
          className="mt-4 w-full rounded-2xl border border-brandBlue/40 px-4 py-2 text-brandText focus:border-brandPink focus:outline-none focus:ring-2 focus:ring-brandPink/60"
          disabled={submitting}
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-brandBlue to-brandPink py-2 text-center text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save user ID"}
        </button>
      </form>
    </div>
  );
}


