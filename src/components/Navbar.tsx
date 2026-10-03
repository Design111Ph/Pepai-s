import React, { useState } from 'react';
import {
  ChefHat,
  MapPin,
  Wifi,
  WifiOff,
  Cloud,
  CloudUpload,
  Bell,
  Sun,
  Moon,
  ShieldCheck,
  Fingerprint,
  UserCheck,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  X,
  ExternalLink,
  Plus,
  Building2,
} from 'lucide-react';
import { User, Location, InventoryAlert, AppSettings, OfflineQueueItem } from '../types';

interface NavbarProps {
  locations: Location[];
  selectedLocationId: string; // 'all' or specific location id
  onSelectLocation: (id: string) => void;
  onOpenLocationsModal?: () => void;
  currentUser: User;
  onSwitchUserPrompt: () => void;
  isOffline: boolean;
  onToggleOffline: () => void;
  offlineQueue: OfflineQueueItem[];
  onSyncOfflineQueue: () => void;
  alerts: InventoryAlert[];
  onOpenAlertsTab: () => void;
  settings: AppSettings;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onTriggerS3Sync: () => void;
  isSyncingS3: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  locations,
  selectedLocationId,
  onSelectLocation,
  onOpenLocationsModal,
  currentUser,
  onSwitchUserPrompt,
  isOffline,
  onToggleOffline,
  offlineQueue,
  onSyncOfflineQueue,
  alerts,
  onOpenAlertsTab,
  settings,
  onToggleTheme,
  onOpenSettings,
  onTriggerS3Sync,
  isSyncingS3,
}) => {
  const [showAlertDropdown, setShowAlertDropdown] = useState(false);

  const activeAlerts = alerts.filter((a) => a.status === 'open');
  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 lg:py-0 lg:h-16 flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-2.5 md:gap-3">
        {/* Top Line on Mobile: Brand + Quick Utility Toggles */}
        <div className="flex items-center justify-between w-full md:w-auto shrink-0">
          {/* Brand & Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 dark:border-amber-400/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black shadow-sm shrink-0">
              <ChefHat className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold tracking-tight text-base sm:text-lg text-neutral-900 dark:text-white">
                  Pepai's
                </span>
                <span className="inline-flex items-center text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Kitchen OS
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 hidden xl:block">
                Food Costing &amp; Inventory Management
              </p>
            </div>
          </div>

          {/* Mobile Right Controls: Alerts Bell + Theme + User Avatar */}
          <div className="flex items-center gap-1.5 sm:hidden">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowAlertDropdown(!showAlertDropdown)}
                className="relative p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
                title="Low Stock & Critical Inventory Alerts"
              >
                <Bell className="w-4 h-4" />
                {activeAlerts.length > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white ${
                      criticalCount > 0 ? 'bg-red-500 animate-bounce' : 'bg-amber-500'
                    }`}
                  >
                    {activeAlerts.length}
                  </span>
                )}
              </button>
            </div>

            {/* Dark Mode */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              {settings.darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600" />}
            </button>

            {/* User Profile */}
            <button
              onClick={onSwitchUserPrompt}
              className="p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
              title="Switch User Role"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-amber-500/40"
              />
            </button>
          </div>
        </div>

        {/* Location Selector & Unit Manager Row */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto shrink-0">
          <div className="relative flex-1 sm:flex-none flex items-center">
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 absolute left-2.5 sm:left-3 pointer-events-none" />
            <select
              value={selectedLocationId}
              onChange={(e) => {
                if (e.target.value === '__manage__') {
                  onOpenLocationsModal?.();
                } else {
                  onSelectLocation(e.target.value);
                }
              }}
              style={{ width: '265px', maxWidth: '100%' }}
              className="w-full sm:w-auto pl-7 sm:pl-8 pr-7 sm:pr-8 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer appearance-none truncate"
              title="Filter by restaurant location"
            >
              <option value="all">
                📍 All Units ({locations.length} {locations.length === 1 ? 'Store' : 'Stores'})
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
              <option value="__manage__">⚙️ + Add / Manage Units...</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 pointer-events-none" />
          </div>

          {onOpenLocationsModal && (
            <button
              type="button"
              onClick={onOpenLocationsModal}
              style={{ width: '117.406px' }}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition-colors shadow-sm shrink-0"
              title="Add or remove restaurant units"
            >
              <Building2 style={{ height: '25px', width: '25.2812px' }} className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span className="hidden xl:inline">Manage Units</span>
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          )}

          {/* Quick Offline indicator on mobile */}
          <div className="flex sm:hidden items-center gap-1 shrink-0">
            <button
              onClick={onToggleOffline}
              className={`p-1.5 rounded-xl text-xs font-medium transition-all ${
                isOffline
                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
              }`}
              title={isOffline ? 'Offline mode active' : 'Connected to cloud'}
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5 text-amber-500" /> : <Wifi className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
            {offlineQueue.length > 0 && (
              <button
                onClick={onSyncOfflineQueue}
                className="px-1.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500 text-neutral-950 flex items-center gap-0.5"
              >
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                <span>{offlineQueue.length}</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop / Tablet Action Controls */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          {/* Offline Mode Toggle & Sync Status */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleOffline}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                isOffline
                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
              title={isOffline ? 'Currently simulating Offline Kitchen Mode' : 'Online & Connected to AWS Cloud'}
            >
              {isOffline ? (
                <>
                  <WifiOff style={{ height: '25px', width: '22.6719px' }} className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden md:inline">Offline Mode</span>
                </>
              ) : (
                <>
                  <Wifi style={{ height: '25px', width: '22.6719px' }} className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden md:inline">Cloud Live</span>
                </>
              )}
            </button>

            {/* Offline Queue Badge & Replay Trigger */}
            {offlineQueue.length > 0 && (
              <button
                onClick={onSyncOfflineQueue}
                className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors shadow-sm"
                title={`${offlineQueue.length} offline ledger edits pending. Click to sync now.`}
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>{offlineQueue.length} queued</span>
              </button>
            )}
          </div>

          {/* S3 Quick Sync */}
          <button
            onClick={onTriggerS3Sync}
            disabled={isSyncingS3 || isOffline}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 transition-colors disabled:opacity-50"
            title={`AWS S3 Storage (${settings.s3Bucket}) - Click to push snapshot`}
          >
            {isSyncingS3 ? (
              <>
                <RefreshCw style={{ height: '25px', width: '23.5938px' }} className="w-3.5 h-3.5 text-sky-500 animate-spin" />
                <span>Syncing S3...</span>
              </>
            ) : (
              <>
                <CloudUpload style={{ height: '25px', width: '23.5938px' }} className="w-3.5 h-3.5 text-sky-500" />
                <span>AWS S3</span>
              </>
            )}
          </button>

          {/* Low Stock Alerts Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowAlertDropdown(!showAlertDropdown)}
              className="relative p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              title="Low Stock & Critical Inventory Alerts"
            >
              <Bell className="w-4 h-4" />
              {activeAlerts.length > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
                    criticalCount > 0 ? 'bg-red-500 animate-bounce' : 'bg-amber-500'
                  }`}
                >
                  {activeAlerts.length}
                </span>
              )}
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            title={settings.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {settings.darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-600" />}
          </button>

          {/* User Profile & Role Switcher */}
          <button
            onClick={onSwitchUserPrompt}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 transition-all text-left"
            title="Switch User Role or Biometric Authentication"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover border border-amber-500/40"
            />
            <div className="hidden xl:block">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-neutral-900 dark:text-white leading-tight">
                  {currentUser.name}
                </span>
                {currentUser.biometricEnabled && (
                  <span title="Biometric Face/TouchID Active">
                    <Fingerprint className="w-3 h-3 text-emerald-500" />
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                {currentUser.roleTitle}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Global Alerts Dropdown for Mobile & Desktop */}
      {showAlertDropdown && (
        <div className="fixed inset-x-3 sm:inset-x-auto sm:right-6 top-16 sm:top-16 z-50 sm:w-96 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                Stock Alerts ({activeAlerts.length})
              </span>
            </div>
            <button
              onClick={() => setShowAlertDropdown(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto py-2 divide-y divide-neutral-100 dark:divide-neutral-800">
            {activeAlerts.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-500">
                ✅ All inventory levels are above par thresholds!
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <div key={alert.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {alert.ingredientName}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {alert.locationName}: <strong>{alert.currentStock} {alert.unit}</strong> left (Par: {alert.parLevel} {alert.unit})
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${
                      alert.severity === 'critical'
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {alert.severity}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-2.5 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
            <button
              onClick={() => {
                setShowAlertDropdown(false);
                onOpenAlertsTab();
              }}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <span>View all &amp; create PO</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-neutral-400">Pepai's Real-time Stock</span>
          </div>
        </div>
      )}
    </header>
  );
};
