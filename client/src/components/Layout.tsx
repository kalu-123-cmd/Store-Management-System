import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, gql } from '@apollo/client';
import { ShoppingCart, Users, Truck, LogOut, Tag, Archive, BarChart2, Menu, X, Sun, Moon, UserCog, Star, UserCircle, ClipboardList, Barcode, Building2, ChevronDown, Shield, Settings as SettingsIcon, FileText, Briefcase, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '../hooks/useDarkMode';
import { useRole } from '../hooks/useRole';
import { useLangContext } from '../lib/LangContext';
import LanguageSwitcher from './LanguageSwitcher';
import StockAlertBell from './StockAlertBell';
import Logo from './Logo';

const GET_BRANCHES = gql`query { branches { id name isActive } }`;

function BranchSelector() {
  const { data } = useQuery(GET_BRANCHES, { errorPolicy: 'ignore' });
  const [open, setOpen] = useState(false);
  const branches = (data?.branches || []).filter((b: any) => b.isActive);

  const [activeBranch, setActiveBranch] = useState(() => {
    try { return JSON.parse(localStorage.getItem('active-branch') || 'null'); } catch { return null; }
  });

  const current = activeBranch || branches[0] || null;

  const select = (b: any) => {
    setActiveBranch(b);
    localStorage.setItem('active-branch', JSON.stringify(b));
    setOpen(false);
  };

  if (branches.length <= 1) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm max-w-[140px]">
        <Building2 size={13} className="text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground truncate">{current?.name || 'All Branches'}</span>
        <ChevronDown size={11} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-10 w-48 bg-card border border-border rounded-xl shadow-2xl z-40 overflow-hidden p-1.5 space-y-0.5">
              <button onClick={() => select(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!activeBranch ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-foreground'}`}>
                All Branches
              </button>
              {branches.map((b: any) => (
                <button key={b.id} onClick={() => select(b)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeBranch?.id === b.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted text-foreground'}`}>
                  <Building2 size={13} className="shrink-0 text-muted-foreground" />
                  {b.name}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const navItems = [
  { name: 'Dashboard',       path: '/dashboard',  icon: <BarChart2 size={18} /> },
  { name: 'AI Intelligence', path: '/ai-dashboard', icon: <Brain size={18} /> },
  { name: 'Products',        path: '/products',   icon: <Archive size={18} /> },
  { name: 'Inventory',       path: '/inventory',  icon: <Tag size={18} /> },
  { name: 'Purchase Orders', path: '/purchases',  icon: <ClipboardList size={18} /> },
  { name: 'Sales',           path: '/sales',      icon: <ShoppingCart size={18} /> },
  { name: 'Customers',       path: '/customers',  icon: <Users size={18} /> },
  { name: 'Suppliers',       path: '/suppliers',  icon: <Truck size={18} /> },
  { name: 'Categories',      path: '/categories', icon: <Tag size={18} /> },
  { name: 'Reports',         path: '/reports',    icon: <BarChart2 size={18} /> },
  { name: 'Barcode Print',   path: '/barcodes',   icon: <Barcode size={18} /> },
  { name: 'Organizations',   path: '/organizations', icon: <Building2 size={18} /> },
  { name: 'Procurement',     path: '/procurement', icon: <Briefcase size={18} /> },
];

// Admin-only nav items shown below a divider
const adminItems = [
  { name: 'Users',     path: '/users',    icon: <UserCog   size={18} /> },
  { name: 'Audit Log', path: '/audit',    icon: <Shield    size={18} /> },
  { name: 'Settings',  path: '/settings', icon: <SettingsIcon size={18} /> },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const { isAdmin } = useRole();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    return (
      <Link
        to={item.path}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
          isActive
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        {item.icon}
        {item.name}
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center justify-between px-5 border-b border-border shrink-0">
        <Logo variant="compact" size="md" />
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground md:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => <NavLink key={item.path} item={item} />)}

        {/* Admin-only section */}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-border" />
            <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
            {adminItems.map(item => <NavLink key={item.path} item={item} />)}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border shrink-0">
        <Link to="/profile" onClick={onClose}
          className="flex items-center gap-3 mb-3 px-1 rounded-lg hover:bg-muted transition-colors p-1 -mx-1 group">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-foreground truncate">{user?.name || 'User'}</span>
            <span className="text-xs text-muted-foreground">{user?.role || 'Role'}</span>
          </div>
          <UserCircle size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useDarkMode();
  const { lang, setLang, t } = useLangContext();
  const location = useLocation();
  const allNavItems = [...navItems, ...adminItems];
  const currentPage = allNavItems.find(item => location.pathname.startsWith(item.path))?.name || 'Dashboard';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-60 border-r border-border bg-card hidden md:flex md:flex-col shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-60 bg-card border-r border-border z-50 md:hidden"
            >
              <Sidebar onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-muted-foreground hover:text-foreground"
            >
              <Menu size={20} />
            </button>
            <Logo variant="icon-only" size="sm" className="hidden md:block" />
            <h1 className="text-base font-semibold text-foreground">StoreOS - Smart Retail Management</h1>
          </div>

          {/* Header right: branch selector + stock alerts + language switcher + dark mode */}
          <div className="flex items-center gap-1.5">
            <BranchSelector />
            <StockAlertBell />
            <LanguageSwitcher lang={lang} setLang={setLang} />
            <button
              onClick={() => setDark(d => !d)}
              aria-label="Toggle dark mode"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={dark ? 'sun' : 'moon'}
                  initial={{ rotate: -30, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 30, opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.18 }}
                >
                  {dark ? <Sun size={18} /> : <Moon size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
