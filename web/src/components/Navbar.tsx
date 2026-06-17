import { useState } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ShoppingCart,
  Heart,
  Bell,
  GraduationCap,
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  LogOut,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { Avatar } from './ui';
import type { Category } from '@/lib/types';

export function Navbar() {
  const { user, logout, has } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data.categories as Category[],
    staleTime: 5 * 60 * 1000,
  });

  const { data: cart } = useQuery({
    queryKey: ['cart-count'],
    queryFn: async () => (await api.get('/cart')).data.items.length as number,
    enabled: !!user,
  });

  const { data: notif } = useQuery({
    queryKey: ['notif-count'],
    queryFn: async () => (await api.get('/me/notifications')).data.unread as number,
    enabled: !!user,
    refetchInterval: 60000,
  });

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="container-page flex h-16 items-center gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-1.5 text-brand-700">
          <GraduationCap className="h-7 w-7" />
          <span className="text-xl font-extrabold tracking-tight">e-learning</span>
        </Link>

        {/* categories dropdown */}
        <div className="group relative hidden lg:block">
          <button className="btn-ghost px-2 py-1.5 text-sm">Categories</button>
          <div className="invisible absolute left-0 top-full z-50 w-64 rounded-lg border bg-white py-2 opacity-0 shadow-card transition-all group-hover:visible group-hover:opacity-100">
            {cats?.map((c) => (
              <Link
                key={c.id}
                to={`/category/${c.slug}`}
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
              >
                <span>{c.icon}</span>
                {c.name}
              </Link>
            ))}
            <Link to="/browse" className="block px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-gray-50">
              Browse all →
            </Link>
          </div>
        </div>

        {/* search */}
        <form onSubmit={submitSearch} className="hidden flex-1 md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for anything"
              className="w-full rounded-full border border-gray-300 bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-brand-500 focus:bg-white"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1">
          {has('instructor') && (
            <Link to="/instructor" className="hidden text-sm font-medium text-ink-700 hover:text-brand-700 lg:block">
              Instructor
            </Link>
          )}
          {!has('instructor') && user && (
            <Link to="/teach" className="hidden text-sm font-medium text-ink-700 hover:text-brand-700 lg:block">
              Teach
            </Link>
          )}

          {user && (
            <>
              <Link to="/wishlist" className="rounded p-2 hover:bg-gray-100" title="Wishlist">
                <Heart className="h-5 w-5" />
              </Link>
              <Link to="/cart" className="relative rounded p-2 hover:bg-gray-100" title="Cart">
                <ShoppingCart className="h-5 w-5" />
                {!!cart && cart > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                    {cart}
                  </span>
                )}
              </Link>
              <Link to="/notifications" className="relative rounded p-2 hover:bg-gray-100" title="Notifications">
                <Bell className="h-5 w-5" />
                {!!notif && notif > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {notif}
                  </span>
                )}
              </Link>
            </>
          )}

          {!user ? (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-secondary">
                Log in
              </Link>
              <Link to="/register" className="btn-dark">
                Sign up
              </Link>
            </div>
          ) : (
            <div className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} className="ml-1 flex items-center rounded-full">
                <Avatar name={user.name} src={user.avatar} size={36} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border bg-white py-2 shadow-card">
                    <div className="border-b px-4 py-2">
                      <p className="truncate font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-ink-500">{user.email}</p>
                    </div>
                    <MenuItem to="/learning" icon={<BookOpen className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      My learning
                    </MenuItem>
                    <MenuItem to="/cart" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      My cart
                    </MenuItem>
                    {has('instructor') && (
                      <MenuItem
                        to="/instructor"
                        icon={<LayoutDashboard className="h-4 w-4" />}
                        onClick={() => setMenuOpen(false)}
                      >
                        Instructor dashboard
                      </MenuItem>
                    )}
                    {has('admin') && (
                      <MenuItem
                        to="/admin"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        onClick={() => setMenuOpen(false)}
                      >
                        Admin panel
                      </MenuItem>
                    )}
                    <MenuItem to="/account" icon={<UserIcon className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
                      Account settings
                    </MenuItem>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                        navigate('/');
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <button className="rounded p-2 hover:bg-gray-100 md:hidden" onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* mobile search + nav */}
      {mobileOpen && (
        <div className="border-t bg-white p-4 md:hidden">
          <form onSubmit={submitSearch} className="mb-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for anything"
              className="input rounded-full"
            />
          </form>
          <nav className="flex flex-col gap-1">
            <NavLink to="/browse" className="px-2 py-2 text-sm" onClick={() => setMobileOpen(false)}>
              Browse
            </NavLink>
            {cats?.slice(0, 6).map((c) => (
              <NavLink key={c.id} to={`/category/${c.slug}`} className="px-2 py-2 text-sm" onClick={() => setMobileOpen(false)}>
                {c.icon} {c.name}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuItem({
  to,
  icon,
  children,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
      {icon}
      {children}
    </Link>
  );
}
