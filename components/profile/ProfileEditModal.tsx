'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface ProfileEditModalProps {
  open: boolean;
  onClose: () => void;
  initialValues: {
    name: string;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    birthday?: string | null;
    image?: string | null;
    coverImage?: string | null;
  };
  onSaved: (payload: ProfileEditModalProps['initialValues']) => void;
}

export function ProfileEditModal({ open, onClose, initialValues, onSaved }: ProfileEditModalProps) {
  const { update } = useSession();
  const [formValues, setFormValues] = useState(() => normalize(initialValues));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormValues(normalize(initialValues));
      setError(null);
      setSaving(false);
    }
  }, [initialValues, open]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formatPayload(formValues)),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? 'Unable to update profile');
      }

      const body = (await response.json()) as ProfileEditModalProps['initialValues'];
      onSaved(normalize(body));
      await update?.({
        user: {
          name: body.name,
          image: body.image,
        },
      });
      onClose();
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof Error ? caught.message : 'Unexpected error updating profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-brandText/40 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brandText">Edit profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-brandText"
          >
            Close
          </button>
        </header>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Display name"
            value={formValues.name}
            onChange={(value) => setFormValues((prev) => ({ ...prev, name: value }))}
            maxLength={60}
            required
          />
          <TextInput
            label="Location"
            value={formValues.location ?? ''}
            onChange={(value) => setFormValues((prev) => ({ ...prev, location: value }))}
            maxLength={80}
          />
          <TextInput
            label="Website"
            value={formValues.website ?? ''}
            onChange={(value) => setFormValues((prev) => ({ ...prev, website: value }))}
            placeholder="https://example.com"
            maxLength={120}
          />
          <TextInput
            label="Birthday"
            type="date"
            value={formValues.birthday ?? ''}
            onChange={(value) => setFormValues((prev) => ({ ...prev, birthday: value }))}
          />
        </fieldset>

        <label className="block text-sm font-medium text-brandText">
          Bio
          <textarea
            value={formValues.bio ?? ''}
            onChange={(event) => setFormValues((prev) => ({ ...prev, bio: event.target.value }))}
            className="mt-1 h-24 w-full resize-none rounded-2xl border border-brandPink/30 px-3 py-2 text-sm text-brandText"
            maxLength={280}
          />
        </label>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Avatar image URL"
            value={formValues.image ?? ''}
            onChange={(value) => setFormValues((prev) => ({ ...prev, image: value }))}
            placeholder="https://..."
          />
          <TextInput
            label="Cover image URL"
            value={formValues.coverImage ?? ''}
            onChange={(value) => setFormValues((prev) => ({ ...prev, coverImage: value }))}
            placeholder="https://..."
          />
        </fieldset>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-gradient-to-r from-brandBlue to-brandPink px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  [key: string]: unknown;
}) {
  return (
    <label className="flex flex-col text-sm font-medium text-brandText">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 rounded-2xl border border-brandPink/30 px-3 py-2 text-sm text-brandText"
        {...rest}
      />
    </label>
  );
}

function normalize(values: ProfileEditModalProps['initialValues']) {
  return {
    ...values,
    bio: values.bio ?? '',
    location: values.location ?? '',
    website: values.website ?? '',
    birthday: values.birthday ? values.birthday.slice(0, 10) : '',
    image: values.image ?? '',
    coverImage: values.coverImage ?? '',
  };
}

function formatPayload(values: ReturnType<typeof normalize>) {
  return {
    name: values.name.trim(),
    bio: values.bio?.trim() || null,
    location: values.location?.trim() || null,
    website: values.website?.trim() || null,
    birthday: values.birthday ? values.birthday : null,
    image: values.image?.trim() || null,
    coverImage: values.coverImage?.trim() || null,
  };
}
