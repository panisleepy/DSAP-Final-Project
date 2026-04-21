'use client';

import { signIn } from 'next-auth/react';
import { Github, Mail } from 'lucide-react';

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brandPink/50 via-white to-brandBlue/50 p-6">
      <section className="murmur-card flex w-full max-w-md flex-col gap-6 p-8 text-center">
        <h1 className="text-3xl font-semibold text-brandText">Welcome to murmur</h1>
        <p className="text-sm text-gray-500">Sign in to share gentle whispers with your friends.</p>
        <div className="space-y-3">
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="murmur-button flex w-full items-center justify-center gap-3 py-3"
          >
            <Mail size={18} /> Continue with Google
          </button>
          <button
            onClick={() => signIn('github', { callbackUrl: '/' })}
            className="murmur-button flex w-full items-center justify-center gap-3 py-3"
          >
            <Github size={18} /> Continue with GitHub
          </button>
        </div>
      </section>
    </main>
  );
}
