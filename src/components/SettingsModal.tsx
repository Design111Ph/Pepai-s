import React, { useState } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Mail,
  Bell,
  Cloud,
  Percent,
  DollarSign,
  Fingerprint,
  KeyRound,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Building2,
} from 'lucide-react';
import { AppSettings, User } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  currentUser: User;
  onOpenLocationsModal?: () => void;
  locationsCount?: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSaveSettings,
  currentUser,
  onOpenLocationsModal,
  locationsCount,
}) => {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [newRecipient, setNewRecipient] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient.trim() || !newRecipient.includes('@')) return;
    setDraft({
      ...draft,
      emailRecipients: [...draft.emailRecipients, newRecipient.trim()],
    });
    setNewRecipient('');
  };

  const handleRemoveRecipient = (index: number) => {
    setDraft({
      ...draft,
      emailRecipients: draft.emailRecipients.filter((_, i) => i !== index),
    });
  };

  const handleSave = () => {
    onSaveSettings(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              Kitchen OS Preferences &amp; Cloud Settings
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Configure automated restock alerts, AWS S3 storage, biometric security, and dark mode.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm self-start sm:self-auto"
        >
          {savedNotice ? <CheckCircle2 className="w-4 h-4 text-emerald-950" /> : <Save className="w-4 h-4" />}
          <span>{savedNotice ? 'Settings Applied!' : 'Save Preferences'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appearance & Accessibility */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            {draft.darkMode ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              Display &amp; Kitchen Accessibility
            </h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Dark Mode Theme
              </span>
              <span className="text-[11px] text-neutral-500">
                High-contrast dark styling for walk-in coolers and night service
              </span>
            </div>
            <button
              onClick={() => setDraft({ ...draft, darkMode: !draft.darkMode })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                draft.darkMode ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                  draft.darkMode ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Target Food Cost % Ceiling
              </span>
              <span className="text-[11px] text-neutral-500">
                Threshold for alerting on high-cost recipes
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                min="10"
                max="60"
                value={draft.targetFoodCostPct}
                onChange={(e) => {
                  const fc = parseFloat(e.target.value) || 28.5;
                  setDraft({
                    ...draft,
                    targetFoodCostPct: fc,
                    targetProfitMarginPct: parseFloat((100 - fc).toFixed(1)),
                  });
                }}
                className="w-16 px-2 py-1 text-xs font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-right"
              />
              <span className="text-xs font-bold text-neutral-400">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Target Profit Margin %
              </span>
              <span className="text-[11px] text-neutral-500">
                Used to suggest optimal selling prices in Food Cost Calculator
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                min="40"
                max="95"
                value={draft.targetProfitMarginPct ?? parseFloat((100 - draft.targetFoodCostPct).toFixed(1))}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    targetProfitMarginPct: parseFloat(e.target.value) || 70,
                  })
                }
                className="w-16 px-2 py-1 text-xs font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-right"
              />
              <span className="text-xs font-bold text-neutral-400">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Primary Currency
              </span>
              <span className="text-[11px] text-neutral-500">
                Operating currency across all costing, orders & reports
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                Philippine Peso (PHP ₱)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Kitchen Hourly Labor Rate
              </span>
              <span className="text-[11px] text-neutral-500">
                Base rate for calculating prep labor cost per recipe
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-neutral-400">₱</span>
              <input
                type="number"
                step="5"
                min="50"
                value={draft.kitchenLaborRatePerHour}
                onChange={(e) => setDraft({ ...draft, kitchenLaborRatePerHour: parseFloat(e.target.value) || 110 })}
                className="w-20 px-2 py-1 text-xs font-bold text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-right"
              />
              <span className="text-xs text-neutral-400">/hr</span>
            </div>
          </div>
        </div>

        {/* Automated Alerts & Push Notifications */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <Bell className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              Restock Alerts &amp; Notifications
            </h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Automated Restock Email Alerts
              </span>
              <span className="text-[11px] text-neutral-500">
                Send instant email whenever stock drops below minimum threshold
              </span>
            </div>
            <button
              onClick={() => setDraft({ ...draft, automatedEmailAlerts: !draft.automatedEmailAlerts })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                draft.automatedEmailAlerts ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                  draft.automatedEmailAlerts ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Mobile Push Notifications
              </span>
              <span className="text-[11px] text-neutral-500">
                Push urgent alert to chef and manager handheld devices
              </span>
            </div>
            <button
              onClick={() => setDraft({ ...draft, pushNotificationsEnabled: !draft.pushNotificationsEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                draft.pushNotificationsEnabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                  draft.pushNotificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Daily Summary Report Email
              </span>
              <span className="text-[11px] text-neutral-500">
                Dispatched at {draft.dailyReportTime} to ownership
              </span>
            </div>
            <button
              onClick={() => setDraft({ ...draft, dailyReportEmailEnabled: !draft.dailyReportEmailEnabled })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                draft.dailyReportEmailEnabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                  draft.dailyReportEmailEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* AWS S3 Cloud Storage Settings */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <Cloud className="w-4 h-4 text-sky-500" />
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              AWS S3 Storage Integration
            </h2>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
              S3 Bucket Identifier
            </label>
            <input
              type="text"
              value={draft.s3Bucket}
              onChange={(e) => setDraft({ ...draft, s3Bucket: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
              AWS Region
            </label>
            <input
              type="text"
              value={draft.s3Region}
              onChange={(e) => setDraft({ ...draft, s3Region: e.target.value })}
              className="mt-1 w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs font-bold text-neutral-900 dark:text-white block">
                Automatic S3 Nightly Cloud Backup
              </span>
              <span className="text-[11px] text-neutral-500">
                Sync full recipes, margins &amp; stock ledger daily
              </span>
            </div>
            <button
              onClick={() => setDraft({ ...draft, s3AutoSync: !draft.s3AutoSync })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                draft.s3AutoSync ? 'bg-sky-500' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform transform ${
                  draft.s3AutoSync ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Alert Email Recipients */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <Mail className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              Alert Email Recipients
            </h2>
          </div>

          <form onSubmit={handleAddRecipient} className="flex gap-2">
            <input
              type="email"
              placeholder="Add manager email..."
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {draft.emailRecipients.map((recipient, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-xs border border-neutral-200 dark:border-neutral-700/60"
              >
                <span className="text-neutral-800 dark:text-neutral-200 font-medium">{recipient}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(i)}
                  className="text-neutral-400 hover:text-red-500 p-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Store Network & Locations */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                Store Network &amp; Locations
              </h2>
            </div>
            {locationsCount !== undefined && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                {locationsCount} {locationsCount === 1 ? 'Store' : 'Stores'} Active
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Manage multi-unit restaurant branches across Metro Manila and regional clusters. Deploy new store units, update branch addresses, and manage isolated inventory levels.
          </p>

          {onOpenLocationsModal && (
            <button
              type="button"
              onClick={onOpenLocationsModal}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Building2 className="w-4 h-4 text-amber-400 dark:text-amber-600" />
              <span>Open Store Units Manager (+ Add / Remove)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
