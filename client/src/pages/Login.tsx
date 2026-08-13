import React, { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, ArrowRight, Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import Logo from '../components/Logo';

const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user { id name role }
    }
  }
`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { loading, error }] = useMutation(LOGIN_MUTATION);
  const [dark, setDark] = useDarkMode();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await login({ variables: { email: email.trim(), password } });
      if (data.login.token) {
        localStorage.setItem('token', data.login.token);
        localStorage.setItem('user', JSON.stringify(data.login.user));
        navigate('/dashboard');
      }
    } catch (err) {
      // error shown via Apollo error state below
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Theme toggle — top right */}
      <button
        onClick={() => setDark(d => !d)}
        aria-label="Toggle dark mode"
        className="fixed top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden relative z-10"
      >
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <Logo variant="default" size="lg" />
            <h1 className="text-2xl font-bold text-foreground mt-4">StoreOS Enterprise</h1>
            <p className="text-muted-foreground text-sm mt-1 text-center">Enter your credentials to access the management portal</p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-6 border border-destructive/20 text-center"
            >
              {error.message}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  placeholder="admin@store.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-foreground">Password</label>
                <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Demo credentials hint */}
        <div className="bg-muted/40 border-t border-border/50 p-4">
          <p className="text-xs text-muted-foreground font-medium text-center mb-2.5">Demo credentials</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { role: 'Admin', email: 'admin@store.com', password: 'admin123' },
              { role: 'Manager', email: 'manager@store.com', password: 'manager123' },
              { role: 'Cashier', email: 'cashier@store.com', password: 'cashier123' },
            ].map(cred => (
              <button
                key={cred.role}
                type="button"
                onClick={() => { setEmail(cred.email); setPassword(cred.password); }}
                className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{cred.role}</span>
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{cred.email}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
