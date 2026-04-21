'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface ImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function ImageUploader({ value, onChange, disabled }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(value ?? null);
  }, [value]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? 'Upload failed');
      }

      setPreview(data.url);
      onChange(data.url);
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof Error ? caught.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
      {isUploading && <p className="text-xs text-gray-500">Uploading image…</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {preview && (
        <div className="relative mt-2 max-h-72 w-full overflow-hidden rounded-2xl border border-white/60 bg-white/60">
          <Image
            src={preview}
            alt="Uploaded preview"
            width={800}
            height={600}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              onChange(null);
            }}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}


