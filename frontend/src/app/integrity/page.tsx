'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';

interface VerifyResult {
  isValid: boolean;
  message: string;
  resourceType?: string;
  resourceId?: string;
  verifiedAt?: string;
}

interface SignResult {
  message: string;
  record?: {
    signature?: string;
    keyId?: string;
    resourceType?: string;
    resourceId?: string;
  };
}

const DEFAULT_SAMPLE_PAYLOAD = JSON.stringify(
  {
    amount: 250,
    currency: 'USD',
    customerId: 'cust-99',
  },
  null,
  2
);

const TAMPERED_SAMPLE_PAYLOAD = JSON.stringify(
  {
    amount: 999999,
    currency: 'USD',
    customerId: 'cust-attacker',
  },
  null,
  2
);

export default function IntegrityPage() {
  const { user, token } = useAuth();

  const [activeTab, setActiveTab] = useState<'verify' | 'sign'>('verify');

  // Verify Form State
  const [vResourceType, setVResourceType] = useState('Order');
  const [vResourceId, setVResourceId] = useState('order-101');
  const [vPayload, setVPayload] = useState(DEFAULT_SAMPLE_PAYLOAD);
  const [vLoading, setVLoading] = useState(false);
  const [vResult, setVResult] = useState<VerifyResult | null>(null);
  const [vError, setVError] = useState<string | null>(null);

  // Sign Form State
  const [sResourceType, setSResourceType] = useState('Order');
  const [sResourceId, setSResourceId] = useState('order-101');
  const [sPayload, setSPayload] = useState(DEFAULT_SAMPLE_PAYLOAD);
  const [sLoading, setSLoading] = useState(false);
  const [sResult, setSResult] = useState<SignResult | null>(null);
  const [sError, setSError] = useState<string | null>(null);
  const [copiedSignature, setCopiedSignature] = useState(false);

  const canSign = user?.role === 'ADMIN' || user?.role === 'SECURITY_ANALYST';

  // Handle Verify Submit
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setVLoading(true);
    setVResult(null);
    setVError(null);

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(vPayload);
    } catch {
      setVError('Payload must be valid JSON format.');
      setVLoading(false);
      return;
    }

    try {
      const res = await api.verifyPayload(token, vResourceType.trim(), vResourceId.trim(), parsedData);
      setVResult(res);
    } catch (err: unknown) {
      const customErr = err as { message?: string; details?: VerifyResult };
      setVError(customErr.message || 'Verification failed.');
      if (customErr.details) {
        setVResult(customErr.details);
      }
    } finally {
      setVLoading(false);
    }
  };

  // Handle Sign Submit
  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSLoading(true);
    setSResult(null);
    setSError(null);
    setCopiedSignature(false);

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(sPayload);
    } catch {
      setSError('Payload must be valid JSON format.');
      setSLoading(false);
      return;
    }

    try {
      const res = await api.signPayload(token, sResourceType.trim(), sResourceId.trim(), parsedData);
      setSResult(res as unknown as SignResult);
    } catch (err: unknown) {
      setSError((err as Error).message || 'Signing failed.');
    } finally {
      setSLoading(false);
    }
  };

  const handleCopySignature = (sig?: string) => {
    if (!sig) return;
    navigator.clipboard.writeText(sig);
    setCopiedSignature(true);
    setTimeout(() => setCopiedSignature(false), 2000);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                Cryptographic Suite
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-mono">HMAC-SHA256</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Data Integrity Verification</h1>
            <p className="text-sm text-slate-400 mt-1">
              Verify canonical payload integrity and generate authoritative HMAC-SHA256 signatures for tamper detection.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300">
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Standard: RFC 2104
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-slate-800/90 pb-px">
          <button
            onClick={() => setActiveTab('verify')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'verify'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/[0.04]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Verify Payload Integrity
          </button>

          <button
            onClick={() => {
              if (canSign) setActiveTab('sign');
            }}
            disabled={!canSign}
            title={!canSign ? 'Requires ADMIN or SECURITY_ANALYST role' : undefined}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              !canSign
                ? 'border-transparent text-slate-600 cursor-not-allowed opacity-60'
                : activeTab === 'sign'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/[0.04]'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Sign Resource Payload</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
              Admin / Analyst
            </span>
          </button>
        </div>

        {/* Verification Tab Content */}
        {activeTab === 'verify' && (
          <div className="space-y-6">
            {/* Scope Notice */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5 text-cyan-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed space-y-1">
                <p className="text-slate-200 font-medium">Verification Scope & Audit Boundary Notice</p>
                <p>
                  Comparing submitted data against an authoritative HMAC-SHA256 signature mathematically guarantees that the provided payload exactly matches the registered state. It <strong className="text-slate-300">does not prove</strong> that an authoritative database row in external storage has not been modified out-of-band unless that row is fetched directly and submitted for verification.
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {vError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
                <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-0.5">
                  <p className="font-semibold text-rose-200">Verification Request Error</p>
                  <p>{vError}</p>
                </div>
              </div>
            )}

            {/* Result Display */}
            {vResult && (
              <div
                className={`p-5 rounded-xl border text-xs space-y-3 transition-all ${
                  vResult.isValid
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full flex items-center justify-center shrink-0 ${
                        vResult.isValid ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                      }`}
                    />
                    <span className="font-bold text-sm tracking-wide">
                      {vResult.isValid
                        ? 'INTEGRITY VERIFIED: NO TAMPERING DETECTED'
                        : 'TAMPERING DETECTED / SIGNATURE MISMATCH'}
                    </span>
                  </div>

                  {vResult.verifiedAt && (
                    <span className="text-[11px] font-mono opacity-80 bg-slate-900/60 px-2.5 py-1 rounded border border-slate-700/60">
                      Verified: {new Date(vResult.verifiedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed opacity-95">{vResult.message}</p>

                {!vResult.isValid && (
                  <div className="pt-2.5 border-t border-rose-500/20 text-[11px] text-rose-300/90 flex items-center gap-2">
                    <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                      Audit Alert: A <strong className="text-rose-200">HMAC_VERIFICATION_FAILED</strong> security incident with <strong className="text-rose-200">CRITICAL</strong> severity has been logged to the platform.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Verification Form Card */}
            <div className="bg-[#0F172A] border border-slate-800/80 rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-sm font-semibold text-white">Cryptographic Verification Form</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluates the SHA-256 HMAC of canonicalized JSON against registered store records.
                  </p>
                </div>

                {/* Preset sample helpers */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVResourceType('Order');
                      setVResourceId('order-101');
                      setVPayload(DEFAULT_SAMPLE_PAYLOAD);
                      setVResult(null);
                      setVError(null);
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition"
                  >
                    Load Valid Sample
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVResourceType('Order');
                      setVResourceId('order-101');
                      setVPayload(TAMPERED_SAMPLE_PAYLOAD);
                      setVResult(null);
                      setVError(null);
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/50 rounded-md transition"
                  >
                    Load Tampered Sample
                  </button>
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="vResType">
                      Resource Type
                    </label>
                    <input
                      id="vResType"
                      type="text"
                      required
                      value={vResourceType}
                      onChange={(e) => setVResourceType(e.target.value)}
                      placeholder="e.g. Order"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="vResId">
                      Resource ID
                    </label>
                    <input
                      id="vResId"
                      type="text"
                      required
                      value={vResourceId}
                      onChange={(e) => setVResourceId(e.target.value)}
                      placeholder="e.g. order-101"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300" htmlFor="vData">
                      JSON Payload for Verification
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Keys are sorted alphabetically prior to HMAC hashing
                    </span>
                  </div>
                  <textarea
                    id="vData"
                    rows={8}
                    required
                    value={vPayload}
                    onChange={(e) => setVPayload(e.target.value)}
                    className="w-full font-mono text-xs px-3.5 py-3 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[11px] text-slate-500">
                    Calculated with server-side HMAC secret & SHA-256 algorithm.
                  </div>

                  <button
                    type="submit"
                    disabled={vLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition shadow-sm disabled:opacity-50 active:scale-[0.98]"
                  >
                    {vLoading ? (
                      <>
                        <svg className="animate-spin w-3.5 h-3.5 text-slate-950" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Computing HMAC Verification...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Verify Cryptographic Signature
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Signing Tab Content */}
        {activeTab === 'sign' && canSign && (
          <div className="space-y-6">
            {/* Error Banner */}
            {sError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
                <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="space-y-0.5">
                  <p className="font-semibold text-rose-200">Signature Generation Error</p>
                  <p>{sError}</p>
                </div>
              </div>
            )}

            {/* Success Result */}
            {sResult && (
              <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="font-bold text-sm tracking-wide">
                      SIGNATURE GENERATED & REGISTERED
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-emerald-400/90 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                    Key ID: {sResult.record?.keyId || 'default-hmac-key'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Authoritative HMAC-SHA256 Digest:</span>
                    <button
                      type="button"
                      onClick={() => handleCopySignature(sResult.record?.signature)}
                      className="text-cyan-400 hover:text-cyan-300 transition underline underline-offset-2 flex items-center gap-1"
                    >
                      {copiedSignature ? 'Copied!' : 'Copy Hash'}
                    </button>
                  </div>
                  <div className="font-mono text-xs p-3 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 break-all select-all">
                    {sResult.record?.signature}
                  </div>
                </div>

                <div className="text-[11px] opacity-80 pt-1 border-t border-emerald-500/20 flex items-center justify-between">
                  <span>Resource: <strong className="text-emerald-200">{sResult.record?.resourceType}:{sResult.record?.resourceId}</strong></span>
                  <span>Algorithm: HMAC-SHA256 (RFC 2104)</span>
                </div>
              </div>
            )}

            {/* Sign Form Card */}
            <div className="bg-[#0F172A] border border-slate-800/80 rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-sm font-semibold text-white">Generate HMAC-SHA256 Signature</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calculates canonical HMAC digest and records an authoritative IntegrityRecord in the database.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSResourceType('Order');
                      setSResourceId('order-101');
                      setSPayload(DEFAULT_SAMPLE_PAYLOAD);
                      setSResult(null);
                      setSError(null);
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition"
                  >
                    Reset Form
                  </button>
                </div>
              </div>

              <form onSubmit={handleSign} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="sResType">
                      Resource Type
                    </label>
                    <input
                      id="sResType"
                      type="text"
                      required
                      value={sResourceType}
                      onChange={(e) => setSResourceType(e.target.value)}
                      placeholder="e.g. Order"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="sResId">
                      Resource ID
                    </label>
                    <input
                      id="sResId"
                      type="text"
                      required
                      value={sResourceId}
                      onChange={(e) => setSResourceId(e.target.value)}
                      placeholder="e.g. order-101"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300" htmlFor="sData">
                      JSON Data Payload
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Standard JSON format required
                    </span>
                  </div>
                  <textarea
                    id="sData"
                    rows={8}
                    required
                    value={sPayload}
                    onChange={(e) => setSPayload(e.target.value)}
                    className="w-full font-mono text-xs px-3.5 py-3 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/80 transition leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[11px] text-slate-500">
                    Signing updates or creates the baseline IntegrityRecord.
                  </div>

                  <button
                    type="submit"
                    disabled={sLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition shadow-sm disabled:opacity-50 active:scale-[0.98]"
                  >
                    {sLoading ? (
                      <>
                        <svg className="animate-spin w-3.5 h-3.5 text-slate-950" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Signing Payload...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Sign & Register Integrity Record
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
