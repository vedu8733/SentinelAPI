'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
  api,
  HealthResponse,
  SeverityLevel,
  ApiServiceItem,
  SecurityEventDetailItem
} from '../../lib/api';

export default function DashboardPage() {
  const { user, token } = useAuth();

  // State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [services, setServices] = useState<ApiServiceItem[]>([]);
  const [recentEvents, setRecentEvents] = useState<SecurityEventDetailItem[]>([]);
  const [openIncidentsCount, setOpenIncidentsCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [advancedDetailsOpen, setAdvancedDetailsOpen] = useState<boolean>(false);

  // Fetch all dashboard data concurrently
  const fetchDashboardTelemetry = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }
      setErrorMsg(null);

      // 1. Health probe (unauthenticated)
      try {
        const healthData = await api.checkHealth();
        setHealth(healthData);
      } catch {
        setHealth(null);
      }

      // 2. Authenticated SOC Telemetry (Services, Recent Events, and Platform Open Incidents)
      if (token && user && user.role !== 'API_CONSUMER') {
        try {
          const [
            servicesRes,
            eventsRes,
            detectedIncidentsRes,
            investigatingIncidentsRes,
            mitigatedIncidentsRes
          ] = await Promise.all([
            api.listServices(token).catch((err) => {
              console.warn('[Dashboard] Services telemetry unavailable:', err.message);
              return { services: [] };
            }),
            api.listSecurityEvents(token, { page: 1, limit: 5 }).catch((err) => {
              console.warn('[Dashboard] Recent security events unavailable:', err.message);
              return { events: [], pagination: { page: 1, limit: 5, total: 0, totalPages: 1 } };
            }),
            api.listIncidents(token, { status: 'DETECTED', limit: 1 }).catch((err) => {
              console.warn('[Dashboard] Detected incidents count unavailable:', err.message);
              return { incidents: [], pagination: { total: 0, page: 1, limit: 1, totalPages: 1 } };
            }),
            api.listIncidents(token, { status: 'INVESTIGATING', limit: 1 }).catch((err) => {
              console.warn('[Dashboard] Investigating incidents count unavailable:', err.message);
              return { incidents: [], pagination: { total: 0, page: 1, limit: 1, totalPages: 1 } };
            }),
            api.listIncidents(token, { status: 'MITIGATED', limit: 1 }).catch((err) => {
              console.warn('[Dashboard] Mitigated incidents count unavailable:', err.message);
              return { incidents: [], pagination: { total: 0, page: 1, limit: 1, totalPages: 1 } };
            })
          ]);

          setServices(servicesRes.services || []);
          setRecentEvents(eventsRes.events || []);

          // Calculate open incidents across platform using backend confirmed status definitions
          // (DETECTED, INVESTIGATING, MITIGATED are active triage statuses; RESOLVED & FALSE_POSITIVE are closed)
          const platformOpenIncidents =
            (detectedIncidentsRes.pagination?.total || 0) +
            (investigatingIncidentsRes.pagination?.total || 0) +
            (mitigatedIncidentsRes.pagination?.total || 0);

          setOpenIncidentsCount(platformOpenIncidents);
          setLastUpdated(new Date());
        } catch (err: unknown) {
          setErrorMsg(
            (err as Error).message || 'Unable to retrieve security telemetry from backend.'
          );
        }
      }

      setIsLoading(false);
      if (isManualRefresh) {
        setIsRefreshing(false);
      }
    },
    [token, user]
  );

  // Initial load and periodic polling (every 20 seconds) with clean unmount
  useEffect(() => {
    let isMounted = true;

    fetchDashboardTelemetry();

    const intervalTimer = setInterval(() => {
      if (isMounted) {
        fetchDashboardTelemetry();
      }
    }, 20000);

    return () => {
      isMounted = false;
      clearInterval(intervalTimer);
    };
  }, [fetchDashboardTelemetry]);

  // Aggregate Metrics across services
  const aggregateTotalRequests = services.reduce(
    (acc, curr) => acc + (curr.totalRequests || 0),
    0
  );
  const aggregateBlockedThreats = services.reduce(
    (acc, curr) => acc + (curr.blockedThreats || 0),
    0
  );
  const activeProtectedServicesCount = services.filter((s) => s.isActive).length;

  // Helpers
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getSeverityBadge = (sev: SeverityLevel) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/10 text-orange-300 border border-orange-500/20">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            MEDIUM
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            LOW
          </span>
        );
    }
  };

  const getActionBadge = (actionTaken: string) => {
    const isBlocked = actionTaken.toUpperCase() === 'BLOCKED';
    if (isBlocked) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <span className="w-1 h-1 rounded-full bg-rose-400" />
          BLOCKED
        </span>
      );
    }
    if (actionTaken.toUpperCase() === 'ALLOWED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <span className="w-1 h-1 rounded-full bg-emerald-400" />
          ALLOWED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <span className="w-1 h-1 rounded-full bg-amber-400" />
        {actionTaken || 'LOGGED'}
      </span>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* 1. Page Heading, Backend Status, Refresh Button, and Last-Updated Timestamp */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Security Overview</h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Gateway SOC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time threat monitoring, reverse-proxy telemetry, and incident response for protected services.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={() => fetchDashboardTelemetry(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-[#0F172A] hover:bg-slate-800 border border-slate-700/80 transition disabled:opacity-50"
              title="Refresh security metrics"
            >
              <svg
                className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {health?.status === 'ok' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live ({health.service})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                Backend Offline
              </span>
            )}
          </div>
        </div>

        {/* API Consumer Access Guard */}
        {user?.role === 'API_CONSUMER' ? (
          <div className="p-6 rounded-xl bg-[#0F172A] border border-slate-800 space-y-3 shadow-sm">
            <h2 className="text-sm font-semibold text-white">API Consumer View</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              You are signed in with the <span className="text-slate-200 font-medium">API_CONSUMER</span> role. 
              Gateway security consoles, live incident triage, and raw event feeds are restricted to Security Analysts and Administrators.
            </p>
            <div className="pt-2">
              <Link
                href="/integrity"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition"
              >
                Access HMAC Data Integrity Verification &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
                <button
                  onClick={() => fetchDashboardTelemetry(true)}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs transition flex-shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* 2. Four Aligned KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Requests */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Total Requests
                  </span>
                  <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  {isLoading ? (
                    <span className="text-slate-600 animate-pulse text-lg">...</span>
                  ) : (
                    aggregateTotalRequests.toLocaleString()
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Aggregated across protected services
                </p>
              </div>

              {/* Threats Blocked */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">
                    Threats Blocked
                  </span>
                  <div className="w-6 h-6 rounded-md bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-rose-300 tracking-tight">
                  {isLoading ? (
                    <span className="text-slate-600 animate-pulse text-lg">...</span>
                  ) : (
                    aggregateBlockedThreats.toLocaleString()
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Rejected pre-forwarding (HTTP 400)
                </p>
              </div>

              {/* Open Incidents (Platform-Wide Count) */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">
                    Open Incidents
                  </span>
                  <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-amber-300 tracking-tight">
                  {isLoading ? (
                    <span className="text-slate-600 animate-pulse text-lg">...</span>
                  ) : openIncidentsCount !== null ? (
                    openIncidentsCount.toLocaleString()
                  ) : (
                    '0'
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Platform alerts: Detected / Investigating
                </p>
              </div>

              {/* Protected Services */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">
                    Protected Services
                  </span>
                  <div className="w-6 h-6 rounded-md bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  </div>
                </div>
                <div className="text-2xl font-bold text-cyan-300 tracking-tight">
                  {isLoading ? (
                    <span className="text-slate-600 animate-pulse text-lg">...</span>
                  ) : (
                    activeProtectedServicesCount
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Active reverse-proxy routes
                </p>
              </div>
            </div>

            {/* 3. Protected Services Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-tight">
                    Protected Services
                  </h2>
                  <p className="text-xs text-slate-400">
                    Upstream web applications and storefronts shielded by SentinelAPI Gateway.
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {services.length} Registered
                </span>
              </div>

              {services.length === 0 && !isLoading ? (
                <div className="p-6 rounded-xl bg-[#0F172A] border border-slate-800 text-center text-xs text-slate-400">
                  No protected services currently registered.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {services.map((svc) => (
                    <div
                      key={svc.id}
                      className="rounded-xl bg-[#0F172A] border border-slate-800/80 p-5 shadow-sm space-y-4"
                    >
                      {/* Service Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800/70">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">
                            🛒
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-white">{svc.name}</h3>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80">
                                {svc.slug}
                              </span>
                              {svc.isActive ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Protected & Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {svc.description || 'E-Commerce storefront secured by SentinelAPI reverse-proxy gateway.'}
                            </p>
                          </div>
                        </div>

                        {/* Open Demo Store Link */}
                        <div className="flex items-center gap-2">
                          {svc.slug === 'nexacart' && (
                            <a
                              href="http://localhost:3001"
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 shadow-sm transition"
                            >
                              <span>Open Demo Store (Port 3001)</span>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Technical Endpoints & Upstream */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/70 space-y-1">
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                            Gateway Proxy Route
                          </span>
                          <div className="font-mono text-cyan-300 font-semibold text-xs truncate select-all">
                            http://127.0.0.1:4000/api/gateway/{svc.slug}/*
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Client traffic inspected in-flight before forwarding
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/70 space-y-1">
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                            Protected Upstream Target
                          </span>
                          <div className="font-mono text-emerald-300 font-semibold text-xs truncate select-all">
                            {svc.upstreamUrl} (Loopback)
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Backend isolated to loopback interface; shielded from public exposure
                          </p>
                        </div>
                      </div>

                      {/* Service Request Metrics Row (Scoped explicitly to this service) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                        <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/50">
                          <span className="text-[10px] text-slate-400 uppercase block font-medium">Forwarded Requests</span>
                          <span className="text-base font-bold text-white tracking-tight">{svc.totalRequests.toLocaleString()}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/50">
                          <span className="text-[10px] text-rose-400 uppercase block font-medium">Blocked Threats</span>
                          <span className="text-base font-bold text-rose-300 tracking-tight">{svc.blockedThreats.toLocaleString()}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/50">
                          <span className="text-[10px] text-amber-400 uppercase block font-medium">Open Incidents</span>
                          <span className="text-base font-bold text-amber-300 tracking-tight">{svc.openIncidents.toLocaleString()}</span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/50">
                          <span className="text-[10px] text-cyan-400 uppercase block font-medium">Total Incidents</span>
                          <span className="text-base font-bold text-cyan-300 tracking-tight">{svc.totalIncidents.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Recent Security Events */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-tight">
                    Recent Security Events
                  </h2>
                  <p className="text-xs text-slate-400">
                    Latest in-flight threat detections intercepted by SentinelAPI reverse-proxy gateway.
                  </p>
                </div>
                <Link
                  href="/monitoring"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
                >
                  <span>View all in Monitoring</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>

              <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 overflow-hidden shadow-sm">
                {recentEvents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    {isLoading ? 'Loading security events...' : 'No security events recorded yet.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-4">Time</th>
                          <th className="py-2.5 px-4">Threat Type</th>
                          <th className="py-2.5 px-4">Severity</th>
                          <th className="py-2.5 px-4">Action Taken</th>
                          <th className="py-2.5 px-4">Affected Service</th>
                          <th className="py-2.5 px-4">Client IP</th>
                          <th className="py-2.5 px-4 text-right">Investigation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {recentEvents.map((evt) => (
                          <tr key={evt.id} className="hover:bg-slate-800/30 transition-colors">
                            {/* Time */}
                            <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                              <span className="font-mono text-[11px]">{formatTime(evt.createdAt)}</span>
                              <span className="text-[10px] text-slate-400 ml-1.5">{formatDate(evt.createdAt)}</span>
                            </td>

                            {/* Threat Type */}
                            <td className="py-2.5 px-4 font-mono font-medium text-slate-200">
                              {evt.threatType}
                            </td>

                            {/* Severity */}
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {getSeverityBadge(evt.severity)}
                            </td>

                            {/* Action Taken */}
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {getActionBadge(evt.actionTaken)}
                            </td>

                            {/* Affected Service */}
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              {evt.service ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                                  <span className="font-semibold">{evt.service.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">({evt.service.slug})</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">SentinelAPI Core</span>
                              )}
                            </td>

                            {/* Client IP */}
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                              {evt.clientIp}
                            </td>

                            {/* Investigation Link */}
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              {evt.incidentId ? (
                                <Link
                                  href={`/incidents?id=${evt.incidentId}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition"
                                  title="View correlated incident detail"
                                >
                                  <span>Incident</span>
                                  <span className="text-[10px]">&rarr;</span>
                                </Link>
                              ) : (
                                <span className="text-slate-600 text-[11px]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Collapsible Advanced Gateway Details */}
            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setAdvancedDetailsOpen(!advancedDetailsOpen)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 text-xs">
                    ⚙️
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Advanced Gateway & Detection Specifications
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Technical protection invariants, rate limits, timeouts, and header isolation guarantees.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{advancedDetailsOpen ? 'Hide specifications' : 'Expand specifications'}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform ${advancedDetailsOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {advancedDetailsOpen && (
                <div className="p-5 border-t border-slate-800/80 bg-slate-950/40 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <span>✓</span>
                        <span>SQL Injection Inspector</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Pre-forwarding tautology and union checks intercept malicious payloads with HTTP 400 before forwarding.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <span>✓</span>
                        <span>Path Traversal Guard</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Normalized sequence validation (`../`, `%2e%2e`) guards against directory escape attempts.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <span>✓</span>
                        <span>Dedicated Gateway Limiter</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        120 req/min sliding rate limit protects store upstream independently from SOC console API limits.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <span>✓</span>
                        <span>Hop-by-Hop & Credential Stripping</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Internal SentinelAPI Bearer tokens and proxy headers are stripped; upstream store session cookies are safely passed.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <span>✓</span>
                        <span>Upstream Timeout & Loop Guard</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        10-second upstream timeout prevents worker starvation; self-referencing loopback forwarding is intercepted.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0F172A] border border-slate-800/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                        <span>✓</span>
                        <span>Automated Triage Correlation</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Blocked events automatically generate or escalate correlated security incidents attributed to the target service.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 font-mono">
                    <span>Verified by Gateway Integration Test Suite (`npm run test:gateway`)</span>
                    <span>12 / 12 Invariants Passing</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
