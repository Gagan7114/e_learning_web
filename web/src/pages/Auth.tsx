import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { apiError } from '@/lib/api';
import { toast } from '@/store/toast';
import { Spinner } from '@/components/ui';

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <GraduationCap className="h-10 w-10 text-brand-600" />
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        </div>
        <div className="card p-6 shadow-card">{children}</div>
      </div>
    </div>
  );
}

const demoAccounts = [
  ['Student', 'alex@e-learning.dev'],
  ['Instructor', 'sarah@e-learning.dev'],
  ['Admin', 'admin@e-learning.dev'],
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Log in to your account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary w-full" disabled={loading}>
          {loading && <Spinner className="h-4 w-4" />} Log in
        </button>
      </form>
      <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-ink-500">
        <p className="mb-1 font-semibold">Demo accounts (password: Password123!)</p>
        {demoAccounts.map(([role, mail]) => (
          <button
            key={mail}
            onClick={() => {
              setEmail(mail);
              setPassword('Password123!');
            }}
            className="block w-full text-left hover:text-brand-700"
          >
            {role}: {mail}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-sm">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-brand-700">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [asInstructor, setAsInstructor] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password, asInstructor);
      toast.success('Account created!');
      navigate(asInstructor ? '/instructor' : '/');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <p className="mt-1 text-xs text-ink-500">At least 6 characters.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={asInstructor} onChange={(e) => setAsInstructor(e.target.checked)} className="accent-brand-600" />
          I want to teach — create an instructor account too
        </label>
        <button className="btn-primary w-full" disabled={loading}>
          {loading && <Spinner className="h-4 w-4" />} Sign up
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
