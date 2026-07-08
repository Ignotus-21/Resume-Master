'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { FileText, LayoutDashboard, UserRound, MessageSquareText, Menu, X, Sparkles, Settings, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Job Tracker', icon: LayoutDashboard },
  { href: '/profile', label: 'Master Profile', icon: UserRound },
  { href: '/resumes', label: 'Resumes', icon: FileText },
  { href: '/chat', label: 'AI Chat', icon: MessageSquareText },
];

const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    router.push('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 no-print">
      <div className="container mx-auto flex justify-between items-center px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-900/40">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          Super Master Resume
        </Link>

        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                  active
                    ? 'bg-slate-800 text-blue-400'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}

          <div className="w-px h-6 bg-slate-800 mx-2" />

          {!loading && (
            user ? (
              <>
                <Link
                  href="/settings"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                    pathname?.startsWith('/settings') ? 'bg-slate-800 text-blue-400' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  {user.name || user.email.split('@')[0]}
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition">
                  <LogIn className="h-4 w-4" />
                  Log In
                </Link>
                <Link href="/signup" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition font-semibold">
                  Sign Up
                </Link>
              </>
            )
          )}
        </div>

        <button
          className="md:hidden p-2 text-slate-300 hover:text-white"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-800 px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active ? 'bg-slate-800 text-blue-400' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}

          <div className="h-px bg-slate-800 my-2" />

          {!loading && (
            user ? (
              <>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white"
                >
                  <LogIn className="h-4 w-4" />
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white"
                >
                  Sign Up
                </Link>
              </>
            )
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
