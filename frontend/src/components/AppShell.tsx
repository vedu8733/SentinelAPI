'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { api, HealthResponse, UserRole } from '../lib/api';

interface AppShellProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

export function AppShell({ children, requiredRoles }: AppShellProps) {
  const { user, logout, isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [isHealthChecking, setIsHealthChecking] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Protected route guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Periodic backend health check (every 30 seconds)
  useEffect(() => {
    let isMounted = true;

    async function pollHealth() {
      try {
        const health = await api.checkHealth();
        if (isMounted) {
          setBackendHealth(health);
        }
      } catch {
        if (isMounted) {
          setBackendHealth(null);
        }
      } finally {
        if (isMounted) setIsHealthChecking(false);
      }
    }

    pollHealth();
    const interval = setInterval(pollHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B1120]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span className="text-xs font-medium text-slate-400 tracking-wide">
            Verifying secure session...
          </span>
        </div>
      </div>
    );
  }

  // Role authorization guard for specific page
  const hasRoleAccess =
    !requiredRoles || (user && requiredRoles.includes(user.role));

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      roles: ['ADMIN', 'SECURITY_ANALYST', 'AUDITOR', 'API_CONSUMER'] as UserRole[],
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      )
    },
    {
      name: 'Security Incidents',
      href: '/incidents',
      roles: ['ADMIN', 'SECURITY_ANALYST', 'AUDITOR'] as UserRole[],
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )
    },
    {
      name: 'Engine & Monitoring',
      href: '/monitoring',
      roles: ['ADMIN', 'SECURITY_ANALYST', 'AUDITOR', 'API_CONSUMER'] as UserRole[],
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      )
    },
    {
      name: 'HMAC Data Integrity',
      href: '/integrity',
      roles: ['ADMIN', 'SECURITY_ANALYST', 'AUDITOR', 'API_CONSUMER'] as UserRole[],
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      )
    }
  ];

  const getBreadcrumbTitle = () => {
    if (pathname === '/dashboard') return 'Security Overview';
    if (pathname.startsWith('/monitoring')) return 'Engine & Monitoring';
    if (pathname.startsWith('/incidents')) return 'Security Incidents';
    if (pathname.startsWith('/integrity')) return 'HMAC Data Integrity';
    return 'Console';
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-purple-500/10 text-purple-300 border border-purple-500/20">
            ADMIN
          </span>
        );
      case 'SECURITY_ANALYST':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            ANALYST
          </span>
        );
      case 'AUDITOR':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-amber-500/10 text-amber-300 border border-amber-500/20">
            AUDITOR
          </span>
        );
      case 'API_CONSUMER':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-slate-800 text-slate-300 border border-slate-700">
            CONSUMER
          </span>
        );
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'SA';
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex h-screen bg-[#0B1120] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0F172A] border-r border-slate-800/80 flex-shrink-0">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800/80">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"
              />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-1">
              Sentinel<span className="text-cyan-400">API</span>
            </div>
            <span className="block text-[10px] font-medium tracking-wider uppercase text-slate-400">
              Enterprise SOC
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Operations Navigation
          </div>
          {navItems.map((item) => {
            const hasAccess = user && item.roles.includes(user.role);
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            if (!hasAccess) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 cursor-not-allowed rounded-lg opacity-50"
                  title="Role authorization required"
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.name}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                    Restricted
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-cyan-400' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Gateway & Node Status Panel */}
        <div className="p-3 border-t border-slate-800/80">
          <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800/70 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Backend Gateway</span>
              {isHealthChecking ? (
                <span className="text-slate-500 text-[10px]">Checking...</span>
              ) : backendHealth?.status === 'ok' ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live (Port 4000)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Offline
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/70 flex items-center justify-between">
              <span>NexaCart Store</span>
              <span className="text-slate-300 text-[10px] font-mono">Port 3001</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between h-16 px-5 sm:px-6 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-800/80 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb Hierarchy */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 hidden sm:inline">SOC Console</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <h1 className="text-sm font-semibold text-white tracking-tight">
                {getBreadcrumbTitle()}
              </h1>
            </div>
          </div>

          {/* User Profile & Account Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {user && (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-medium text-slate-200">{user.fullName}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{user.email}</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-semibold text-cyan-400">
                  {getInitials(user.fullName)}
                </div>
                {getRoleBadge(user.role)}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-white border border-slate-700/80 transition"
              title="Sign out of security console"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Mobile Slide-Over Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <div className="relative w-64 max-w-[80%] bg-[#0F172A] border-r border-slate-800 p-4 flex flex-col z-10">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs">
                    🛡️
                  </div>
                  <span className="text-sm font-bold text-white">SentinelAPI</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1">
                {navItems.map((item) => {
                  const hasAccess = user && item.roles.includes(user.role);
                  const isActive = pathname === item.href;
                  if (!hasAccess) return null;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                        isActive
                          ? 'bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400">
                {user && (
                  <div className="mb-2">
                    <span className="block text-white font-medium">{user.fullName}</span>
                    <span className="text-[10px] text-slate-400">{user.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Gateway Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0B1120]">
          {!hasRoleAccess ? (
            <div className="max-w-md mx-auto my-12 p-6 rounded-xl bg-slate-900 border border-rose-900/40 text-center space-y-3 shadow-lg">
              <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-white">Access Restricted</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your role (<span className="text-slate-200 font-medium">{user?.role}</span>) does not have permission to view this section.
              </p>
              <Link
                href="/dashboard"
                className="inline-block mt-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition"
              >
                Return to Dashboard
              </Link>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}
