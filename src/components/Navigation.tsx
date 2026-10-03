import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calculator,
  Boxes,
  AlertTriangle,
  FileText,
  Star,
  ShieldCheck,
  Settings,
  MoreHorizontal,
  X,
  ChevronRight,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'costing'
  | 'inventory'
  | 'alerts'
  | 'reports'
  | 'feedback'
  | 'security'
  | 'settings';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  alertCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  alertCount,
}) => {
  const [showMoreMobileSheet, setShowMoreMobileSheet] = useState(false);

  const tabs = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Analytics & KPIs',
      shortLabel: 'KPIs',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'costing' as ActiveTab,
      label: 'Food Costing',
      shortLabel: 'Costing',
      icon: Calculator,
      badge: null,
    },
    {
      id: 'inventory' as ActiveTab,
      label: 'Kitchen Stock',
      shortLabel: 'Stock',
      icon: Boxes,
      badge: null,
    },
    {
      id: 'alerts' as ActiveTab,
      label: 'Stock Alerts',
      shortLabel: 'Alerts',
      icon: AlertTriangle,
      badge: alertCount > 0 ? alertCount : null,
      badgeColor: 'bg-red-500 text-white',
    },
    {
      id: 'reports' as ActiveTab,
      label: 'Reports & S3',
      shortLabel: 'Reports',
      icon: FileText,
      badge: null,
    },
    {
      id: 'feedback' as ActiveTab,
      label: 'Customer NPS',
      shortLabel: 'Feedback',
      icon: Star,
      badge: null,
    },
    {
      id: 'security' as ActiveTab,
      label: 'RBAC & Audit',
      shortLabel: 'Security',
      icon: ShieldCheck,
      badge: null,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      shortLabel: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  // Mobile bottom dock primary 4 tabs + More
  const mobileDockTabs = tabs.slice(0, 4);
  const mobileSecondaryTabs = tabs.slice(4);

  const isSecondaryActive = mobileSecondaryTabs.some((t) => t.id === activeTab);

  return (
    <>
      {/* Top Navigation Bar (Desktop & Mobile Swipeable) */}
      <nav className="w-full bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6">
          <div className="flex items-center space-x-1 sm:space-x-1.5 md:space-x-2 overflow-x-auto no-scrollbar py-2 -mx-2 px-2 touch-pan-x scroll-smooth">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 md:px-3 py-2 rounded-xl text-xs md:text-sm font-semibold whitespace-nowrap transition-all touch-manipulation min-h-[40px] shrink-0 ${
                    isActive
                      ? 'bg-amber-500 text-neutral-950 shadow-sm font-bold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-neutral-950' : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  />
                  <span>{tab.label}</span>
                  {tab.badge !== null && (
                    <span
                      className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-neutral-900 text-amber-400' : 'bg-red-500 text-white'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Fixed Mobile Bottom Dock (Smartphones & Tablets < 768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 safe-bottom">
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {mobileDockTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  setShowMoreMobileSheet(false);
                }}
                className={`flex flex-col items-center justify-center h-full min-h-[44px] py-1 transition-colors relative touch-manipulation ${
                  isActive
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  {tab.badge !== null && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black bg-red-500 text-white flex items-center justify-center">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'font-bold' : ''}`}>
                  {tab.shortLabel}
                </span>
                {isActive && (
                  <span className="w-6 h-0.5 rounded-full bg-amber-500 absolute bottom-1" />
                )}
              </button>
            );
          })}

          {/* More Menu Item for Secondary Tabs */}
          <button
            onClick={() => setShowMoreMobileSheet(true)}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] py-1 transition-colors relative touch-manipulation ${
              isSecondaryActive || showMoreMobileSheet
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span
              className={`text-[10px] mt-1 font-semibold ${
                isSecondaryActive ? 'font-bold' : ''
              }`}
            >
              More
            </span>
            {isSecondaryActive && (
              <span className="w-6 h-0.5 rounded-full bg-amber-500 absolute bottom-1" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile "More" Slide-up Sheet */}
      {showMoreMobileSheet && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in">
          <div
            className="w-full bg-white dark:bg-neutral-900 rounded-t-3xl border-t border-neutral-200 dark:border-neutral-800 p-5 space-y-4 shadow-2xl max-h-[75vh] overflow-y-auto animate-in slide-in-from-bottom"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <span className="text-sm font-bold text-neutral-900 dark:text-white">
                Additional Modules &amp; Tools
              </span>
              <button
                onClick={() => setShowMoreMobileSheet(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {mobileSecondaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setShowMoreMobileSheet(false);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700/60 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isActive
                            ? 'bg-amber-500 text-neutral-950 font-bold'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm">{tab.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
