'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  FileText, LayoutDashboard, UserRound, Menu, X, Sparkles,
  Settings, LogOut, LogIn, ChevronDown, Mail, Gauge, MessagesSquare, Contact, BarChart3,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const PRIMARY_LINKS = [
  { href: '/dashboard', label: 'Job Tracker', icon: LayoutDashboard },
  { href: '/profile', label: 'Master Profile', icon: UserRound },
  { href: '/resumes', label: 'Resumes', icon: FileText },
];

const TOOL_LINKS = [
  { href: '/cover-letters', label: 'Cover Letters', icon: Mail },
  { href: '/ats-checker', label: 'ATS Checker', icon: Gauge },
  { href: '/interview', label: 'Mock Interview', icon: MessagesSquare },
  { href: '/linkedin', label: 'LinkedIn Optimizer', icon: Contact },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  // '/chat' removed while the general-purpose chatbot is disabled (see
  // backend/routes/aiRoutes.js) — don't link to a dead feature.
];

const linkClass = (active: boolean) =>
  `flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 font-medium ${
    active ? 'bg-[#f1f3f4] text-[#202124] font-semibold' : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#f8f9fa]'
  }`;

const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    setOpen(false);
    router.push('/');
  };

  const toolsActive = TOOL_LINKS.some((t) => pathname?.startsWith(t.href));

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#dadce0] no-print">
      <div className="container mx-auto flex justify-between items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-2xl font-bold tracking-tight text-[#202124] group">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500 shadow-md group-hover:scale-105 transition-transform duration-300">
            <Sparkles className="h-5 w-5 text-white" />
          </span>
          Resume Master
        </Link>

        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          {PRIMARY_LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(!!pathname?.startsWith(href))}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          <div className="relative" ref={toolsRef}>
            <button onClick={() => setToolsOpen((v) => !v)} className={linkClass(toolsActive)}>
              <Sparkles className="h-4 w-4" />
              Tools
              <ChevronDown className={`h-3.5 w-3.5 transition ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>
            {toolsOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-[#dadce0] rounded-2xl shadow-xl p-2 z-50 transform origin-top-right transition-all">
                {TOOL_LINKS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setToolsOpen(false)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm transition-all duration-200 ${
                      pathname?.startsWith(href) ? 'bg-[#f1f3f4] text-[#202124] font-semibold' : 'text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-[#dadce0] mx-2" />

          {!loading && (
            user ? (
              <>
                {user.isAdmin && (
                  <Link href="/admin" className={linkClass(!!pathname?.startsWith('/admin'))}>
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Admin
                  </Link>
                )}
                <Link href="/settings" className={linkClass(!!pathname?.startsWith('/settings'))}>
                  <Settings className="h-4 w-4" />
                  {user.name || user.email.split('@')[0]}
                </Link>
                <button onClick={handleLogout} className={linkClass(false)}>
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={linkClass(false)}>
                  <LogIn className="h-4 w-4" />
                  Log In
                </Link>
                <Link href="/signup" className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#202124] text-white hover:bg-black transition font-medium shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:-translate-y-0.5">
                  Sign Up
                </Link>
              </>
            )
          )}
        </div>

        <button
          className="md:hidden p-2 text-[#5f6368] hover:text-[#202124]"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[#dadce0] px-4 py-4 space-y-1 bg-white absolute w-full left-0 shadow-2xl">
          {PRIMARY_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-all ${
                pathname?.startsWith(href) ? 'bg-[#f1f3f4] text-[#202124] font-semibold' : 'text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          {user && user.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-all ${
                pathname?.startsWith('/admin') ? 'bg-[#f1f3f4] text-[#202124] font-semibold' : 'text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Admin
            </Link>
          )}

          <div className="pt-2 pb-1 px-3 text-xs uppercase tracking-wider text-[#5f6368]">Tools</div>
          {TOOL_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition ${
                pathname?.startsWith(href) ? 'bg-[#f1f3f4] text-[#202124] font-semibold' : 'text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          <div className="h-px bg-[#dadce0] my-2" />

          {!loading && (
            user ? (
              <>
                <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button onClick={handleLogout} className="flex w-full items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]">
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]">
                  <LogIn className="h-4 w-4" />
                  Log In
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium bg-[#202124] text-white hover:bg-black">
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
