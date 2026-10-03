import React, { useState } from 'react';
import {
  ShieldCheck,
  Fingerprint,
  KeyRound,
  Lock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Globe,
  Sliders,
} from 'lucide-react';
import { AuditLog, User, UserRole } from '../types';

interface SecurityAndAuditProps {
  auditLogs: AuditLog[];
  currentUser: User;
  onSimulateBiometric: () => Promise<boolean>;
}

export const SecurityAndAudit: React.FC<SecurityAndAuditProps> = ({
  auditLogs,
  currentUser,
  onSimulateBiometric,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [biometricStatus, setBiometricStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [mfaCode, setMfaCode] = useState<string>('841 902');
  const [mfaInput, setMfaInput] = useState<string>('');
  const [mfaVerified, setMfaVerified] = useState<boolean | null>(null);

  const permissionsMatrix = [
    { permission: 'View Food Cost % & Margins', admin: true, manager: true, chef: true, kitchen: false },
    { permission: 'Edit Wholesale Ingredient Costs', admin: true, manager: true, chef: false, kitchen: false },
    { permission: 'Create & Modify Recipes', admin: true, manager: true, chef: true, kitchen: false },
    { permission: 'Conduct Kitchen Fast Counts', admin: true, manager: true, chef: true, kitchen: true },
    { permission: 'Log Kitchen Waste & Spoilage', admin: true, manager: true, chef: true, kitchen: true },
    { permission: 'Approve Stock Transfers', admin: true, manager: true, chef: false, kitchen: false },
    { permission: 'Generate Supplier POs', admin: true, manager: true, chef: false, kitchen: false },
    { permission: 'AWS S3 & Cloud Settings', admin: true, manager: false, chef: false, kitchen: false },
    { permission: 'Inspect Security Audit Logs', admin: true, manager: true, chef: false, kitchen: false },
  ];

  const handleTestBiometric = async () => {
    setBiometricStatus('scanning');
    try {
      const success = await onSimulateBiometric();
      setBiometricStatus(success ? 'success' : 'failed');
      setTimeout(() => setBiometricStatus('idle'), 3000);
    } catch {
      setBiometricStatus('failed');
      setTimeout(() => setBiometricStatus('idle'), 3000);
    }
  };

  const handleVerifyMFA = (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaInput.replace(/\s+/g, '') === '841902' || mfaInput.length === 6) {
      setMfaVerified(true);
      setTimeout(() => setMfaVerified(null), 3500);
      setMfaInput('');
    } else {
      setMfaVerified(false);
      setTimeout(() => setMfaVerified(null), 3500);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              Role-Based Access Control (RBAC) &amp; Security
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Enterprise multi-factor authentication, WebAuthn biometrics, OAuth 2.0 SSO, and immutable audit logs.
          </p>
        </div>

        {/* OAuth Badge */}
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs">
          <Globe className="w-3.5 h-3.5 text-sky-500" />
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">OAuth 2.0:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">Authenticated (Google/Pepai's SSO)</span>
        </div>
      </div>

      {/* Biometrics & MFA Testers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Biometric WebAuthn Passkey Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Biometric Passkey Authentication
              </h3>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              WebAuthn / FIDO2
            </span>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Enables instant, hands-free authentication for chefs and managers using device TouchID, FaceID, or hardware keys.
          </p>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={handleTestBiometric}
              disabled={biometricStatus === 'scanning'}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Fingerprint className={`w-4 h-4 ${biometricStatus === 'scanning' ? 'animate-pulse text-amber-400' : ''}`} />
              <span>{biometricStatus === 'scanning' ? 'Scanning Fingerprint...' : 'Test Biometric Prompt'}</span>
            </button>

            {biometricStatus === 'success' && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Passkey Verified!
              </span>
            )}
            {biometricStatus === 'failed' && (
              <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Biometric Cancelled
              </span>
            )}
          </div>
        </div>

        {/* Multi-Factor Authentication (MFA) Simulator */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Multi-Factor Authentication (MFA)
              </h3>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
              TOTP 6-Digit
            </span>
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Active TOTP token: <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-amber-600 dark:text-amber-400 font-mono font-bold">{mfaCode}</code>
          </p>

          <form onSubmit={handleVerifyMFA} className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Enter 6-digit code..."
              value={mfaInput}
              onChange={(e) => setMfaInput(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white w-40"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors"
            >
              Verify Code
            </button>
            {mfaVerified === true && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ✅ Valid
              </span>
            )}
            {mfaVerified === false && (
              <span className="text-xs font-bold text-red-500">
                ❌ Invalid Code
              </span>
            )}
          </form>
        </div>
      </div>

      {/* RBAC Permissions Matrix */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
            Role-Based Access Control (RBAC) Matrix
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Strict permissions isolation between Kitchen Line Staff, Head Chefs, General Managers, and Owners.
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">System Capability</th>
                <th className="py-2.5 px-3 text-center">Owner / Admin</th>
                <th className="py-2.5 px-3 text-center">Operations Manager</th>
                <th className="py-2.5 px-3 text-center">Head Chef</th>
                <th className="py-2.5 px-3 text-center">Kitchen Line Cook</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
              {permissionsMatrix.map((item, idx) => (
                <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white">
                    {item.permission}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.admin ? <span className="text-emerald-500 font-bold">✓ Full</span> : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.manager ? <span className="text-emerald-500 font-bold">✓ Full</span> : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.chef ? <span className="text-emerald-500 font-bold">✓ Full</span> : <span className="text-neutral-400">Restricted</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.kitchen ? <span className="text-emerald-500 font-bold">✓ Allowed</span> : <span className="text-rose-500 font-bold">✕ No Access</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immutable Audit Trail */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Real-Time System Audit Trail</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Complete history of stock adjustments, cost modifications, and security authentications.
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
              />
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">User &amp; Role</th>
                <th className="py-2 px-3">Location</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap font-mono text-[11px]">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-neutral-900 dark:text-white block">{log.userName}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold">{log.userRole}</span>
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                    {log.locationName}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[10px] uppercase font-bold">
                      {log.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (< 768px) */}
        <div className="md:hidden space-y-2.5">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-neutral-900 dark:text-white block">
                    {log.action}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    By <strong>{log.userName}</strong> ({log.userRole}) • {log.locationName}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 shrink-0">
                  {log.category}
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 bg-white/70 dark:bg-neutral-900/60 p-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
                {log.details}
              </p>
              <span className="text-[10px] text-neutral-400 font-mono block">
                {log.timestamp}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
