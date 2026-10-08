import React, { useState } from 'react';
import { BookOpen, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { login, register, type AuthSession } from '../api/auth.ts';
import { setAccessToken } from '../api/client.ts';

interface AuthPageProps { onAuthenticated: (user: AuthSession['user']) => void; }

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const session = isRegister ? await register(email, password) : await login(email, password);
      setAccessToken(session.access_token);
      onAuthenticated(session.user);
    } catch (err: any) {
      setError(err.message || 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
          <BookOpen className="h-6 w-6" />
        </div>
        <h1 className="text-center text-2xl font-semibold text-slate-900">StudyVault</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {isRegister ? 'Create your private study space.' : 'Sign in to your private study space.'}
        </p>

        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">Email
            <span className="relative mt-1 block">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200" placeholder="you@example.com" />
            </span>
          </label>
          <label className="block text-sm font-medium text-slate-700">Password
            <span className="relative mt-1 block">
              <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input required type="password" minLength={8} maxLength={128} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200" placeholder="At least 8 characters" />
            </span>
          </label>
          {isRegister && <label className="block text-sm font-medium text-slate-700">Confirm password
            <input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200" placeholder="Re-enter your password" />
          </label>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700 disabled:opacity-60">
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isRegister ? 'Already have an account?' : 'New to StudyVault?'}{' '}
          <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }} className="font-semibold text-slate-900 hover:underline">
            {isRegister ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <p className="mt-4 text-center text-xs text-slate-400">Your documents and study history belong to your account.</p>
      </section>
    </main>
  );
};
