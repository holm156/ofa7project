"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '../../context/StoreContext';
import { Button, Input, Card } from '../../components/UIComponents';
import { BookOpen, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useStore();
  const router = useRouter();
  const [isAdminPortal, setIsAdminPortal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSubdomain = window.location.hostname.startsWith('dash.');
      const isPath = window.location.pathname.startsWith('/admin');
      setIsAdminPortal(isSubdomain || isPath);
    }
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        // Use hard redirect on the admin portal so the new session cookie
        // is sent with the next request. router.push() is a soft navigation
        // and the proxy middleware won't see the cookie in time.
        if (isAdminPortal) {
          window.location.href = '/';
        } else {
          router.push('/');
        }
      } else {
        await register(username, email, password);
        setIsLogin(true); // Switch to login after registration
      }
    } catch (e) {
      // Error handled in store
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-md p-8 border-t-4 border-t-primary bg-surface/50 backdrop-blur">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Legion Scans" className="w-24 h-24 mx-auto mb-6 drop-shadow-2xl object-contain" />
          <h1 className="text-2xl font-bold mb-2">
            {isAdminPortal ? (isLogin ? 'Admin Portal' : 'Restricted') : (isLogin ? 'Welcome Back' : 'Create Account')}
          </h1>
          <p className="text-zinc-500 text-sm">
            {isAdminPortal 
              ? (isLogin ? 'Authorized personnel only' : 'Unauthorized Access')
              : (isLogin ? 'Enter your details to access your library' : 'Join Legion Scans today for free')}
          </p>

        </div>

        {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-xs text-red-200 leading-relaxed font-bold">
                    {error === 'CredentialsSignin' ? 'Invalid email or password. Please check your credentials.' : 
                     error === 'OAuthAccountNotLinked' ? 'This email is already linked to another provider (Google or Discord).' :
                     error === 'AdminAccessOnly' ? 'Access Denied: This area is restricted to administrators only.' :
                     'An error occurred during sign in, please try again later.'}
                </p>
            </div>
        )}


        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <Input
              label="Username"
              placeholder="Enter username"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="Enter email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <Button type="submit" className="w-full mt-2" size="lg" disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Register')}
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#121212] px-2 text-zinc-500">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2 border-zinc-800 hover:border-zinc-700"
            onClick={() => {
              import('next-auth/react').then(mod => mod.signIn('google', { callbackUrl: '/' }));
            }}
          >
            <img src="https://authjs.dev/img/providers/google.svg" className="w-4 h-4" alt="" />
            Google
          </Button>
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2 border-zinc-800 hover:border-zinc-700"
            onClick={() => {
              import('next-auth/react').then(mod => mod.signIn('discord', { callbackUrl: '/' }));
            }}
          >
            <img src="https://authjs.dev/img/providers/discord.svg" className="w-4 h-4 text-blue-500" alt="" />
            Discord
          </Button>
        </div>

        {!isAdminPortal && (
          <div className="mt-6 text-center text-sm text-zinc-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              className="text-primary hover:underline font-medium"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </div>
        )}

      </Card>
    </div>
  );
};

export default Login;
