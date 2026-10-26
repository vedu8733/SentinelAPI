'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
  api,
  HealthResponse,
  SecurityEventDetailItem,
  ApiServiceItem,
  SeverityLevel,
  ThreatType
} from '../../lib/api';

export default function MonitoringPage() {
  const { user, token } = useAuth();

  // Telemetry Health State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [lastPing, setLastPing] = useState<number | null>(null);

  // Security Events Feed State
  const [events, setEvents] = useState<SecurityEventDetailItem[]>([]);
  const [eventsTotal, setEventsTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [specsOpen, setSpecsOpen] = useState<boolean>(false);

  // Filters
  const [services, setServices] = useState<ApiServiceItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedThreatType, setSelectedThreatType] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');

  // 1. Backend Health Probe
  const probeHealth = useCallback(async () => {
    const start = Date.now();
    try {
      const data = await api.checkHealth();
      setHealth(data);
      setLastPing(Date.now() - start);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // 2. Fetch Security Events Feed
  const fetchEvents = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setIsRefreshing(true);
      }
      setErrorMsg(null);

      if (!token || !user || user.role === 'API_CONSUMER') {
        setEventsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        const [eventsRes, servicesRes] = await Promise.all([
          api.listSecurityEvents(token, {
            page,
            limit: 15,
            serviceId: selectedServiceId || undefined,
            threatType: selectedThreatType || undefined,
            actionTaken: selectedAction || undefined
          }),
          services.length === 0
            ? api.listServices(token).catch(() => ({ services: [] }))
            : Promise.resolve({ services })
        ]);

        setEvents(eventsRes.events || []);
        setEventsTotal(eventsRes.pagination.total);
        setTotalPages(eventsRes.pagination.totalPages || 1);
        if (services.length === 0 && servicesRes.services) {
          setServices(servicesRes.services);
        }
        setLastUpdated(new Date());
      } catch (err: unknown) {
        setErrorMsg((err as Error).message || 'Failed to retrieve real-time security events.');
      } finally {
        setEventsLoading(false);
        if (isManual) {
          setIsRefreshing(false);
        }
      }
    },
    [token, user, page, selectedServiceId, selectedThreatType, selectedAction, services]
  );

  // Periodic Polling (every 20 seconds) with cleanup
  useEffect(() => {
    let isMounted = true;

    probeHealth();
    fetchEvents();

    const timer = setInterval(() => {
      if (isMounted) {
        probeHealth();
        fetchEvents();
      }
    }, 20000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [probeHealth, fetchEvents]);

  const resetFilters = () => {
    setSelectedServiceId('');
    setSelectedThreatType('');
    setSelectedAction('');
    setPage(1);
  };

  const activeRules = [
    {
      name: 'SQL Injection Guard (SQLI_PROTECTION)',
      type: 'Deterministic Pattern Matcher',
      severity: 'CRITICAL',
      status: 'Active (Pre-Forwarding Block)',
      description:
        'Inspects incoming URL parameters, paths, and JSON bodies for boolean tautologies, UNION SELECT injections, and comment delimiters before forwarding to upstream.'
    },
    {
      name: 'Directory Traversal Guard (PATH_TRAVERSAL)',
      type: 'Path Normalization Inspector',
      severity: 'HIGH',
      status: 'Active (Pre-Forwarding Block)',
      description:
        'Detects directory traversal sequences including ../, ..\\, %2e%2e%2f, and encoded slash sequences in API request paths and query strings before reaching loopback.'
    },
    {
      name: 'NexaCart Dedicated Gateway Limiter',
      type: 'Express Rate Limiter',
      severity: 'MEDIUM',
      status: 'Active (120 req/min)',
      description:
        'Enforces an isolated 120 req/min throttling window on /api/gateway/nexacart/*, preventing store traffic surges from impacting native SentinelAPI console limits.'
    },
    {
      name: 'Authentication Brute-Force Guard',
      type: 'Sliding Window Counter',
      severity: 'HIGH',
      status: 'Active',
      description:
        'Tracks failed login attempts per client IP. Triggers UNAUTHORIZED_ACCESS security events when threshold (5 attempts / 5 mins) is exceeded.'
    },
    {
      name: 'Cryptographic HMAC Tampering Detector',
      type: 'Constant-Time Digest Comparator',
      severity: 'CRITICAL',
      status: 'Active',
      description:
        'Verifies incoming payloads against canonicalized HMAC-SHA256 digests. Generates CRITICAL security events upon payload tampering.'
    }
  ];

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

  const getActionBadge = (action: string) => {
    const upper = action ? action.toUpperCase() : '';
    if (upper === 'BLOCKED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
          <span className="w-1 h-1 rounded-full bg-rose-400" />
          BLOCKED
        </span>
      );
    }
    if (upper === 'THROTTLED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <span className="w-1 h-1 rounded-full bg-amber-400" />
          THROTTLED
        </span>
      );
    }
    if (upper === 'LOGGED' || upper === 'FLAGGED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <span className="w-1 h-1 rounded-full bg-amber-400" />
          FLAGGED / LOGGED
        </span>
      );
    }
    if (upper === 'ALLOWED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <span className="w-1 h-1 rounded-full bg-emerald-400" />
          ALLOWED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
        {action || 'UNKNOWN'}
      </span>
    );
  };

  const hasActiveFilters = Boolean(selectedServiceId || selectedThreatType || selectedAction);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Heading & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Engine & Event Monitoring
              </h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Live Feed
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              In-flight inspection feed, real-time threat blocks, and detection rule architecture.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={() => {
                probeHealth();
                fetchEvents(true);
              }}
              disabled={eventsLoading || isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-[#0F172A] hover:bg-slate-800 border border-slate-700/80 transition disabled:opacity-50"
              title="Refresh security event feed"
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

        {/* Telemetry Latency Probe Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-sm space-y-1">
            <span className="block text-[10px] text-slate-400 uppercase font-medium">Service Node</span>
            <div className="font-semibold text-white truncate">
              {healthLoading ? 'Probing...' : health ? `${health.service} (Port 4000)` : 'Offline'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-sm space-y-1">
            <span className="block text-[10px] text-slate-400 uppercase font-medium">Roundtrip Latency</span>
            <div className="font-semibold text-cyan-400 font-mono">
              {healthLoading ? 'Measuring...' : lastPing !== null ? `${lastPing} ms` : 'N/A'}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-[#0F172A] border border-slate-800/80 shadow-sm space-y-1">
            <span className="block text-[10px] text-slate-400 uppercase font-medium">Telemetry Heartbeat</span>
            <div className="font-semibold text-slate-300 font-mono">
              {lastUpdated
                ? lastUpdated.toLocaleTimeString()
                : health
                ? new Date(health.timestamp).toLocaleTimeString()
                : 'Unavailable'}
            </div>
          </div>
        </div>

        {/* API Consumer Access Guard */}
        {user?.role === 'API_CONSUMER' ? (
          <div className="p-6 rounded-xl bg-[#0F172A] border border-slate-800 space-y-3 shadow-sm">
            <h2 className="text-sm font-semibold text-white">API Consumer View</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              You are signed in with the <span className="text-slate-200 font-medium">API_CONSUMER</span> role.
              Live security event streams and threat inspection feeds are restricted to Security Analysts and Administrators.
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
            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
                <button
                  onClick={() => fetchEvents(true)}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs transition flex-shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Real-Time Security Events Feed Table */}
            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 overflow-hidden shadow-sm space-y-0">
              <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <h2 className="text-sm font-semibold text-white">Live Security Events Feed</h2>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Real-time threat inspection records from PostgreSQL ({eventsTotal} total logged)
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Service Filter */}
                  <select
                    value={selectedServiceId}
                    onChange={(e) => {
                      setSelectedServiceId(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">All Services</option>
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name}
                      </option>
                    ))}
                  </select>

                  {/* Threat Type Filter */}
                  <select
                    value={selectedThreatType}
                    onChange={(e) => {
                      setSelectedThreatType(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">All Threat Types</option>
                    <option value="SQL_INJECTION">SQL Injection</option>
                    <option value="PATH_TRAVERSAL">Path Traversal</option>
                    <option value="RATE_LIMIT_EXCEEDED">Rate Limit Exceeded</option>
                    <option value="UNAUTHORIZED_ACCESS">Unauthorized Access</option>
                    <option value="HMAC_VERIFICATION_FAILED">HMAC Tampering</option>
                  </select>

                  {/* Action Filter */}
                  <select
                    value={selectedAction}
                    onChange={(e) => {
                      setSelectedAction(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">All Actions</option>
                    <option value="BLOCKED">Blocked Only</option>
                    <option value="THROTTLED">Throttled (Rate Limited)</option>
                    <option value="LOGGED">Logged / Flagged</option>
                  </select>

                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 text-xs transition"
                      title="Clear active filters"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Events Table Viewport */}
              {eventsLoading ? (
                <div className="p-12 text-center text-xs text-slate-500 animate-pulse">
                  Loading real-time security events from database...
                </div>
              ) : events.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                  <p className="text-slate-300 font-medium">No security events match the current filter.</p>
                  <p className="text-[11px] text-slate-400">Inbound traffic is clean or filters are restricting results.</p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="mt-2 px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Threat Type</th>
                        <th className="py-2.5 px-4">Severity</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Affected Service</th>
                        <th className="py-2.5 px-4">Client IP</th>
                        <th className="py-2.5 px-4">Inspected Path & Reason</th>
                        <th className="py-2.5 px-4 text-right">Incident</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {events.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                            <span className="font-mono text-[11px]">
                              {new Date(ev.createdAt).toLocaleTimeString()}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1.5">
                              {new Date(ev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-200 whitespace-nowrap">
                            {ev.threatType}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">{getSeverityBadge(ev.severity)}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">{getActionBadge(ev.actionTaken)}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {ev.service ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                                <span className="font-semibold">{ev.service.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">({ev.service.slug})</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">SentinelAPI Core</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {ev.clientIp}
                          </td>
                          <td className="py-2.5 px-4 max-w-xs truncate">
                            <span className="font-mono text-[11px] text-cyan-300 block truncate" title={ev.details?.path as string || ''}>
                              {ev.details?.path ? String(ev.details.path) : '—'}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate" title={ev.details?.reason as string || ''}>
                              {ev.details?.reason ? String(ev.details.reason) : 'Threat pattern match'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            {ev.incidentId ? (
                              <Link
                                href={`/incidents?id=${ev.incidentId}`}
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

              {/* Pagination Bar */}
              {eventsTotal > 15 && (
                <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Showing {events.length} of {eventsTotal} security events (Page {page} of {totalPages})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-2.5 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-slate-300 border border-slate-700/80 disabled:opacity-40 transition"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-2.5 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-slate-300 border border-slate-700/80 disabled:opacity-40 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Threat Detection Specifications Accordion */}
            <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setSpecsOpen(!specsOpen)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 text-xs">
                    🛡️
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Active Threat Detection Rules & Specifications
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Technical inspection criteria, pattern matching logic, and automated action rules.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{specsOpen ? 'Hide specifications' : 'Expand specifications'}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform ${specsOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {specsOpen && (
                <div className="p-5 border-t border-slate-800/80 bg-slate-950/40 space-y-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeRules.map((rule) => (
                      <div
                        key={rule.name}
                        className="p-4 rounded-lg bg-[#0F172A] border border-slate-800/80 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-white truncate">{rule.name}</h4>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              rule.severity === 'CRITICAL'
                                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                : rule.severity === 'HIGH'
                                ? 'bg-orange-500/10 text-orange-300 border border-orange-500/20'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}
                          >
                            {rule.severity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-cyan-400 font-mono">
                          <span>{rule.type}</span>
                          <span>•</span>
                          <span className="text-emerald-400">{rule.status}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {rule.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 font-mono">
                    <span>In-flight request inspection verified by ThreatDetector Engine</span>
                    <span>5 Core Detection Modules</span>
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
