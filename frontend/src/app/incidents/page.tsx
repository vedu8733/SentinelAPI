'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
  api,
  IncidentSummary,
  IncidentDetail,
  SeverityLevel,
  IncidentStatus,
  ActionType
} from '../../lib/api';

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  DETECTED: ['INVESTIGATING', 'MITIGATED', 'FALSE_POSITIVE'],
  INVESTIGATING: ['MITIGATED', 'RESOLVED', 'FALSE_POSITIVE'],
  MITIGATED: ['RESOLVED', 'INVESTIGATING'],
  RESOLVED: ['INVESTIGATING'],
  FALSE_POSITIVE: ['INVESTIGATING']
};

function IncidentsContent() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filters & Pagination State
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ipQuery, setIpQuery] = useState<string>('');
  const [appliedIp, setAppliedIp] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Detail Modal / View State
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    () => searchParams.get('id')
  );
  const [incidentDetail, setIncidentDetail] = useState<IncidentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Transition form state
  const [newStatus, setNewStatus] = useState<IncidentStatus | ''>('');
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusSuccessMsg, setStatusSuccessMsg] = useState<string | null>(null);

  // Action proposal form state
  const [newActionType, setNewActionType] = useState<ActionType>('IP_BLOCK');
  const [actionReason, setActionReason] = useState<string>('');
  const [isProposingAction, setIsProposingAction] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Trigger re-fetch helper
  const [refreshIndex, setRefreshIndex] = useState<number>(0);
  const refreshList = () => setRefreshIndex((i) => i + 1);

  // Synchronize selected incident with URL query parameter when it changes while mounted
  useEffect(() => {
    const urlIncidentId = searchParams.get('id');
    if (urlIncidentId && urlIncidentId !== selectedIncidentId) {
      setSelectedIncidentId(urlIncidentId);
    }
  }, [searchParams, selectedIncidentId]);

  // Clean handler to open an incident and keep URL in sync
  const handleSelectIncident = useCallback(
    (id: string) => {
      setSelectedIncidentId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set('id', id);
      router.replace(`/incidents?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Clean handler to close the modal and remove ?id= from URL
  const handleCloseModal = useCallback(() => {
    setSelectedIncidentId(null);
    setIncidentDetail(null);
    setStatusSuccessMsg(null);
    setActionSuccessMsg(null);
    setDetailError(null);

    if (searchParams.get('id')) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('id');
      const newQuery = params.toString();
      router.replace(newQuery ? `/incidents?${newQuery}` : '/incidents', { scroll: false });
    }
  }, [router, searchParams]);

  // Fetch Incidents List
  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    api.listIncidents(token, {
      page,
      limit: 10,
      severity: severityFilter || undefined,
      status: statusFilter || undefined,
      sourceIp: appliedIp || undefined
    })
      .then((res) => {
        if (isMounted) {
          setIncidents(res.incidents);
          setTotalPages(res.pagination.totalPages || 1);
          setTotalCount(res.pagination.total);
          setErrorMsg(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setErrorMsg((err as Error).message || 'Failed to fetch security incidents.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, page, severityFilter, statusFilter, appliedIp, refreshIndex]);

  // Fetch Incident Detail when an incident is selected
  useEffect(() => {
    if (!token || !selectedIncidentId) {
      return;
    }

    let isMounted = true;
    setDetailLoading(true);

    api
      .getIncident(token, selectedIncidentId)
      .then((res) => {
        if (isMounted) {
          setIncidentDetail(res.incident);
          const transitions = VALID_TRANSITIONS[res.incident.status] || [];
          setNewStatus(transitions[0] || '');
          setDetailError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setDetailError((err as Error).message || 'Failed to fetch incident details.');
        }
      })
      .finally(() => {
        if (isMounted) setDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, selectedIncidentId]);

  // Handle Status Update
  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedIncidentId || !newStatus) return;

    setIsUpdatingStatus(true);
    setStatusSuccessMsg(null);
    setDetailError(null);

    try {
      await api.updateIncidentStatus(token, selectedIncidentId, newStatus, statusNotes);
      setStatusSuccessMsg(`Incident status successfully updated to ${newStatus}.`);
      setStatusNotes('');

      // Refresh incident detail and list
      const updated = await api.getIncident(token, selectedIncidentId);
      setIncidentDetail(updated.incident);
      const nextTransitions = VALID_TRANSITIONS[updated.incident.status] || [];
      setNewStatus(nextTransitions[0] || '');
      refreshList();
    } catch (err: unknown) {
      setDetailError((err as Error).message || 'Failed to update incident status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Response Action Proposal
  const handleProposeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedIncidentId) return;

    setIsProposingAction(true);
    setActionSuccessMsg(null);
    setDetailError(null);

    try {
      await api.proposeResponseAction(token, selectedIncidentId, newActionType, actionReason);
      setActionSuccessMsg('Simulated response action recorded as PENDING.');
      setActionReason('');

      // Refresh incident detail
      const updated = await api.getIncident(token, selectedIncidentId);
      setIncidentDetail(updated.incident);
      refreshList();
    } catch (err: unknown) {
      setDetailError((err as Error).message || 'Failed to record simulated response action.');
    } finally {
      setIsProposingAction(false);
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

  const getStatusBadge = (st: IncidentStatus) => {
    switch (st) {
      case 'DETECTED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-300 border border-yellow-500/20">
            <span className="w-1 h-1 rounded-full bg-yellow-400" />
            DETECTED
          </span>
        );
      case 'INVESTIGATING':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
            <span className="w-1 h-1 rounded-full bg-blue-400" />
            INVESTIGATING
          </span>
        );
      case 'MITIGATED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
            <span className="w-1 h-1 rounded-full bg-purple-400" />
            MITIGATED
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            RESOLVED
          </span>
        );
      case 'FALSE_POSITIVE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            FALSE POSITIVE
          </span>
        );
    }
  };

  const isOperator = user?.role === 'ADMIN' || user?.role === 'SECURITY_ANALYST';
  const hasActiveFilters = Boolean(severityFilter || statusFilter || appliedIp);

  const handleResetFilters = () => {
    setSeverityFilter('');
    setStatusFilter('');
    setIpQuery('');
    setAppliedIp('');
    setPage(1);
  };

  return (
    <AppShell requiredRoles={['ADMIN', 'SECURITY_ANALYST', 'AUDITOR']}>
      <div className="space-y-6">
        {/* Page Heading & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">
                Security Incidents
              </h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Triage Console
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active security incidents, state-machine lifecycle triage, and correlated threat telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refreshList()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-[#0F172A] hover:bg-slate-800 border border-slate-700/80 transition disabled:opacity-50"
              title="Refresh incidents"
            >
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

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
              onClick={() => refreshList()}
              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-xs transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Incident Console Card */}
        <div className="rounded-xl bg-[#0F172A] border border-slate-800/80 overflow-hidden shadow-sm space-y-0">
          {/* Header & Filter Controls Toolbar */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h2 className="text-sm font-semibold text-white">Incident Queue</h2>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {totalCount} total incidents recorded in PostgreSQL
              </p>
            </div>

            {/* Filter Inputs */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Statuses</option>
                <option value="DETECTED">Detected</option>
                <option value="INVESTIGATING">Investigating</option>
                <option value="MITIGATED">Mitigated</option>
                <option value="RESOLVED">Resolved</option>
                <option value="FALSE_POSITIVE">False Positive</option>
              </select>

              {/* IP Search Filter */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedIp(ipQuery.trim());
                  setPage(1);
                }}
                className="flex items-center gap-1"
              >
                <input
                  type="text"
                  placeholder="Filter by IP..."
                  value={ipQuery}
                  onChange={(e) => setIpQuery(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs w-32 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
                >
                  Search
                </button>
              </form>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 text-xs transition"
                  title="Clear filters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Incidents Table */}
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-500 animate-pulse">
              Retrieving incidents from database...
            </div>
          ) : incidents.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 space-y-2">
              <p className="text-slate-300 font-medium">No incidents found matching the filter.</p>
              <p className="text-[11px] text-slate-400">All services are operating without matching alert records.</p>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
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
                    <th className="py-2.5 px-4">Incident Title</th>
                    <th className="py-2.5 px-4">Target Service</th>
                    <th className="py-2.5 px-4">Source IP</th>
                    <th className="py-2.5 px-4">Severity</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Events</th>
                    <th className="py-2.5 px-4">Actions</th>
                    <th className="py-2.5 px-4">Detected At</th>
                    <th className="py-2.5 px-4 text-right">Triage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {incidents.map((inc) => (
                    <tr
                      key={inc.id}
                      onClick={() => handleSelectIncident(inc.id)}
                      className={`cursor-pointer hover:bg-slate-800/30 transition-colors ${
                        selectedIncidentId === inc.id ? 'bg-cyan-500/5' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-200 max-w-xs truncate">
                        {inc.title}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {inc.service ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                            <span className="font-semibold">{inc.service.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({inc.service.slug})</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">SentinelAPI Core</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {inc.sourceIp || 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">{getSeverityBadge(inc.severity)}</td>
                      <td className="py-2.5 px-4 whitespace-nowrap">{getStatusBadge(inc.status)}</td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-300">{inc.eventCount}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{inc.responseActionCount}</td>
                      <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">
                        <span className="font-mono text-[11px]">
                          {new Date(inc.detectedAt).toLocaleTimeString()}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          {new Date(inc.detectedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectIncident(inc.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition"
                        >
                          <span>Triage</span>
                          <span className="text-[10px]">&rarr;</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalCount > 10 && (
            <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing {incidents.length} of {totalCount} incidents (Page {page} of {totalPages})
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-slate-300 border border-slate-700/80 disabled:opacity-40 transition"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1 rounded bg-[#0F172A] hover:bg-slate-800 text-slate-300 border border-slate-700/80 disabled:opacity-40 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Incident Detail Modal / Drawer */}
        {selectedIncidentId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
            onClick={handleCloseModal}
          >
            <div
              className="w-full max-w-3xl my-8 rounded-2xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {incidentDetail && getSeverityBadge(incidentDetail.severity)}
                    {incidentDetail && getStatusBadge(incidentDetail.status)}
                    <span className="font-mono text-[11px] text-slate-400">
                      ID: {selectedIncidentId}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {detailLoading ? 'Loading incident telemetry...' : incidentDetail?.title}
                  </h2>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {detailLoading ? (
                <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
                  Retrieving incident telemetry and events...
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {detailError}
                </div>
              ) : incidentDetail ? (
                <div className="space-y-6">
                  {/* Status & Feedback messages */}
                  {statusSuccessMsg && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                      {statusSuccessMsg}
                    </div>
                  )}
                  {actionSuccessMsg && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                      {actionSuccessMsg}
                    </div>
                  )}

                  {/* Incident Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-medium">Source IP</span>
                      <span className="font-mono font-medium text-slate-200">
                        {incidentDetail.sourceIp || 'Unknown'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-medium">Target Service</span>
                      <span className="text-slate-200 font-medium">
                        {incidentDetail.service?.name || 'SentinelAPI Core'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-medium">Detected At</span>
                      <span className="text-slate-200">
                        {new Date(incidentDetail.detectedAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-medium">Resolved At</span>
                      <span className="text-slate-200">
                        {incidentDetail.resolvedAt
                          ? new Date(incidentDetail.resolvedAt).toLocaleString()
                          : 'Unresolved'}
                      </span>
                    </div>
                  </div>

                  {/* Status Transition Control (Admin / Analyst only) */}
                  {isOperator ? (
                    <form onSubmit={handleStatusUpdate} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">Update Lifecycle Status</span>
                        <span className="text-[10px] text-slate-400 font-mono">Strict state-machine transitions</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase font-medium mb-1" htmlFor="statusSelect">
                            Target Status
                          </label>
                          <select
                            id="statusSelect"
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value as IncidentStatus)}
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                          >
                            {(VALID_TRANSITIONS[incidentDetail.status] || []).map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-400 uppercase font-medium mb-1" htmlFor="notesInput">
                            Triage Notes
                          </label>
                          <input
                            id="notesInput"
                            type="text"
                            value={statusNotes}
                            onChange={(e) => setStatusNotes(e.target.value)}
                            placeholder="Explanation for audit log..."
                            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={isUpdatingStatus || !newStatus}
                          className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-semibold text-xs shadow-sm transition"
                        >
                          {isUpdatingStatus ? 'Applying...' : 'Apply Transition'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-3 rounded-lg bg-slate-950 text-slate-400 text-xs">
                      Lifecycle transition controls are restricted to Security Analysts and Administrators.
                    </div>
                  )}

                  {/* Correlated Security Events Feed */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-white uppercase tracking-wider block">
                      Correlated Security Events ({incidentDetail.events?.length || incidentDetail.eventCount})
                    </span>
                    <div className="rounded-lg border border-slate-800/80 overflow-hidden bg-slate-950/70">
                      {incidentDetail.events && incidentDetail.events.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-950 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                              <tr>
                                <th className="py-2 px-3">Time</th>
                                <th className="py-2 px-3">Threat Type</th>
                                <th className="py-2 px-3">Severity</th>
                                <th className="py-2 px-3">Action</th>
                                <th className="py-2 px-3">Client IP</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                              {incidentDetail.events.map((ev) => (
                                <tr key={ev.id} className="hover:bg-slate-900/50">
                                  <td className="py-2 px-3 text-slate-400">
                                    {new Date(ev.createdAt).toLocaleTimeString()}
                                  </td>
                                  <td className="py-2 px-3 text-slate-200 font-sans font-medium">{ev.threatType}</td>
                                  <td className="py-2 px-3">{getSeverityBadge(ev.severity)}</td>
                                  <td className="py-2 px-3 text-rose-300">{ev.actionTaken}</td>
                                  <td className="py-2 px-3 text-slate-400">{ev.clientIp}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No linked individual security events recorded for this incident.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Simulated Response Actions */}
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white uppercase tracking-wider">
                        Response Actions History ({incidentDetail.responseActions?.length || incidentDetail.responseActionCount})
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono">
                        Safe Simulation Mode
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-800/80 divide-y divide-slate-800/80 bg-slate-950/70">
                      {incidentDetail.responseActions && incidentDetail.responseActions.length > 0 ? (
                        incidentDetail.responseActions.map((act) => (
                          <div key={act.id} className="p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-cyan-300 font-mono">
                                {act.actionType} &rarr; {act.target}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                {act.status} (SIMULATED)
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">{act.reason}</p>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              Recorded: {new Date(act.appliedAt).toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No response actions recorded yet.
                        </div>
                      )}
                    </div>

                    {/* Propose Manual Response Action Form */}
                    {isOperator && (
                      <form onSubmit={handleProposeAction} className="pt-2 flex flex-col sm:flex-row gap-2">
                        <select
                          value={newActionType}
                          onChange={(e) => setNewActionType(e.target.value as ActionType)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="IP_BLOCK">IP_BLOCK (Simulated)</option>
                          <option value="IP_THROTTLE">IP_THROTTLE (Simulated)</option>
                          <option value="KEY_REVOCATION">KEY_REVOCATION (Simulated)</option>
                          <option value="NOTIFICATION_SENT">NOTIFICATION_SENT (Simulated)</option>
                          <option value="MANUAL_OVERRIDE">MANUAL_OVERRIDE (Simulated)</option>
                        </select>
                        <input
                          type="text"
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          placeholder="Reason for prototype action..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          type="submit"
                          disabled={isProposingAction}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 disabled:opacity-50 text-amber-300 font-semibold text-xs whitespace-nowrap transition"
                        >
                          {isProposingAction ? 'Recording...' : 'Propose Simulated Action'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function IncidentsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0B1120] text-slate-400 text-xs">
          Loading Incidents Console...
        </div>
      }
    >
      <IncidentsContent />
    </React.Suspense>
  );
}
