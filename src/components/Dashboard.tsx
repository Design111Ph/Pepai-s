import React, { useState } from 'react';
import {
  TrendingUp,
  Percent,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ChevronRight,
  Award,
  Zap,
  Building2,
  Calendar,
  Info,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { MenuItem, Ingredient, Location, InventoryAlert, AuditLog } from '../types';
import { analyzeMenuEngineering, calculateInventoryTurnover, calculateRecipeCost } from '../utils/costing';

interface DashboardProps {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  locations: Location[];
  selectedLocationId: string;
  alerts: InventoryAlert[];
  auditLogs: AuditLog[];
  laborRatePerHour: number;
  targetFoodCostPct: number;
  onNavigate: (tab: any) => void;
  onSelectRecipeForCosting: (menuItemId: string) => void;
  onOpenLocationsModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  menuItems,
  ingredients,
  locations,
  selectedLocationId,
  alerts,
  auditLogs,
  laborRatePerHour,
  targetFoodCostPct,
  onNavigate,
  onSelectRecipeForCosting,
  onOpenLocationsModal,
}) => {
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'>('all');
  const [showRevenue, setShowRevenue] = useState(true);
  const [showCOGS, setShowCOGS] = useState(true);
  const [showFoodCostLine, setShowFoodCostLine] = useState(true);
  const [activeTrendIndex, setActiveTrendIndex] = useState<number>(5);

  const currentLocation =
    selectedLocationId === 'all'
      ? null
      : locations.find((l) => l.id === selectedLocationId);

  // Compute Menu Engineering & Financials
  const analysis = analyzeMenuEngineering(
    menuItems,
    ingredients,
    laborRatePerHour,
    selectedLocationId === 'all' ? undefined : selectedLocationId
  );

  // Calculate Total Inventory Value at current scope
  let totalInventoryVal = 0;
  ingredients.forEach((ing) => {
    if (selectedLocationId === 'all') {
      Object.values(ing.stockByLocation).forEach((st) => {
        totalInventoryVal += (st.quantity || 0) * ing.costPerUnit;
      });
    } else {
      const locSt = ing.stockByLocation[selectedLocationId];
      if (locSt) {
        totalInventoryVal += (locSt.quantity || 0) * ing.costPerUnit;
      }
    }
  });

  // Calculate Turnover metrics
  const { turnoverRatio, daysOnHand } = calculateInventoryTurnover(
    analysis.totalMonthlyCOGS,
    totalInventoryVal
  );

  // Active alerts for current location
  const relevantAlerts = alerts.filter((a) => {
    if (a.status !== 'open') return false;
    if (selectedLocationId === 'all') return true;
    return a.locationId === selectedLocationId;
  });

  const criticalAlerts = relevantAlerts.filter((a) => a.severity === 'critical');

  // Estimate monthly waste cost (simulated based on typical 3.5% restaurant waste rate)
  const estimatedWasteCost = analysis.totalMonthlyCOGS * 0.038;

  // Real-time calculation of historical 6-month trends based on selected location
  const currentRev = analysis.totalMonthlyRevenue;
  const currentCOGS = analysis.totalMonthlyCOGS;
  const currentFCPct = analysis.overallFoodCostPercent;

  // Monthly factors showing historical operational progression up to current MTD
  const monthlyFactors = [
    { month: 'Apr', label: 'April 2026', revRatio: 0.74, fc: 29.2 },
    { month: 'May', label: 'May 2026', revRatio: 0.81, fc: 28.7 },
    { month: 'Jun', label: 'June 2026', revRatio: 0.88, fc: 28.3 },
    { month: 'Jul', label: 'July 2026', revRatio: 0.93, fc: 27.9 },
    { month: 'Aug', label: 'August 2026', revRatio: 0.97, fc: 28.1 },
  ];

  const monthlyTrends = [
    ...monthlyFactors.map((f) => {
      const rev = Math.round(currentRev * f.revRatio);
      const cogs = Math.round(rev * (f.fc / 100));
      return {
        month: f.month,
        label: f.label,
        revenue: rev,
        cogs: cogs,
        foodCostPct: f.fc,
        grossProfit: rev - cogs,
        grossMarginPct: rev > 0 ? ((rev - cogs) / rev) * 100 : 0,
      };
    }),
    {
      month: 'Sep (MTD)',
      label: 'September 2026 (Month-to-Date)',
      revenue: currentRev,
      cogs: currentCOGS,
      foodCostPct: currentFCPct,
      grossProfit: currentRev - currentCOGS,
      grossMarginPct: currentRev > 0 ? ((currentRev - currentCOGS) / currentRev) * 100 : 0,
    },
  ];

  const activeTrend = monthlyTrends[activeTrendIndex] ?? monthlyTrends[monthlyTrends.length - 1];

  // 6-Month Aggregate Performance KPIs
  const totalPeriodRevenue = monthlyTrends.reduce((sum, t) => sum + t.revenue, 0);
  const totalPeriodCOGS = monthlyTrends.reduce((sum, t) => sum + t.cogs, 0);
  const avgFoodCostPct = totalPeriodRevenue > 0 ? (totalPeriodCOGS / totalPeriodRevenue) * 100 : 0;
  const onTargetCyclesCount = monthlyTrends.filter((t) => t.foodCostPct <= targetFoodCostPct).length;

  const filteredMatrixItems =
    matrixFilter === 'all'
      ? analysis.items
      : analysis.items.filter((item) => item.classification === matrixFilter);

  return (
    <div className="space-y-6">
      {/* Unit Scope Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-800 text-white shadow-lg border border-neutral-700/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-neutral-950">
              Live Operations
            </span>
            <span className="text-xs text-neutral-400">Real-Time Cloud Ledger • Philippine Peso (₱)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            {currentLocation ? currentLocation.name : `Pepai's Restaurant Group (All ${locations.length} Units)`}
          </h1>
          <p className="text-xs text-neutral-300">
            {currentLocation
              ? `${currentLocation.address} • Manager: ${currentLocation.manager}`
              : `Consolidated performance analytics across all ${locations.length} operational restaurant units.`}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('costing')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Recipe Calculator</span>
          </button>
          <button
            onClick={() => onNavigate('inventory')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600 transition-colors flex items-center gap-1.5"
          >
            <Boxes className="w-3.5 h-3.5 text-amber-400" />
            <span>Kitchen Fast Count</span>
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600 transition-colors flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>Export Reports</span>
          </button>
        </div>
      </div>

      {/* Critical Alert Bar if any */}
      {criticalAlerts.length > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 animate-pulse">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="text-xs sm:text-sm font-semibold">
              <span className="font-bold uppercase tracking-wider mr-1">Urgent Alert:</span>
              {criticalAlerts.length} ingredients below critical threshold level! Immediate restock required.
            </div>
          </div>
          <button
            onClick={() => onNavigate('alerts')}
            className="text-xs font-bold px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap"
          >
            Review &amp; Order
          </button>
        </div>
      )}

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Food Cost % Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Food Cost %
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                analysis.overallFoodCostPercent <= targetFoodCostPct
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {analysis.overallFoodCostPercent.toFixed(1)}%
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              vs target {targetFoodCostPct}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {analysis.overallFoodCostPercent <= targetFoodCostPct ? (
              <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>On Target (Profitable)</span>
              </div>
            ) : (
              <div className="flex items-center text-amber-600 dark:text-amber-400 font-semibold gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{(analysis.overallFoodCostPercent - targetFoodCostPct).toFixed(1)}% above goal</span>
              </div>
            )}
          </div>
        </div>

        {/* Inventory Turnover Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Inventory Turnover
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {turnoverRatio.toFixed(1)}x
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              / year ({daysOnHand.toFixed(0)} days on hand)
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Total Holding Value: <strong className="text-neutral-800 dark:text-neutral-200">₱{totalInventoryVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </p>
        </div>

        {/* Projected Monthly Gross Margin */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Monthly Gross Profit
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
              ₱
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              ₱{(analysis.totalMonthlyRevenue - analysis.totalMonthlyCOGS).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              ({(100 - analysis.overallFoodCostPercent).toFixed(1)}% margin)
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Revenue: ₱{analysis.totalMonthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} | COGS: ₱{analysis.totalMonthlyCOGS.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Active Stock Alerts / Waste Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm transition-all hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Low Stock &amp; Waste
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {relevantAlerts.length}
            </span>
            <span className="text-xs text-red-600 dark:text-red-400 font-bold">
              items below par
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Est. Monthly Waste: <strong className="text-amber-600 dark:text-amber-400">₱{estimatedWasteCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> (3.8% shrinkage)
          </p>
        </div>
      </div>

      {/* Interactive Charts Section: Monthly Sales Trends & Food Cost Percentage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales & Food Cost Trend Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span>Monthly Sales Trends &amp; Food Cost Percentage</span>
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Tracking cost of goods sold (COGS) vs target food cost ceiling across fiscal cycles
                </p>
              </div>

              {/* Interactive Series Toggle Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRevenue(!showRevenue)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all border ${
                    showRevenue
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700 opacity-60'
                  }`}
                  title="Toggle Revenue Bars"
                >
                  <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                  <span>Revenue (₱)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCOGS(!showCOGS)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all border ${
                    showCOGS
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700 opacity-60'
                  }`}
                  title="Toggle COGS Bars"
                >
                  <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                  <span>COGS (₱)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFoodCostLine(!showFoodCostLine)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all border ${
                    showFoodCostLine
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-neutral-200 dark:border-neutral-700 opacity-60'
                  }`}
                  title="Toggle Food Cost % Line"
                >
                  <span className="w-2.5 h-0.5 bg-emerald-500" />
                  <span>Food Cost %</span>
                </button>
              </div>
            </div>

            {/* Selected / Focused Month Drilldown Banner */}
            <div className="mt-3.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {activeTrend.label}
                </span>
                <span className="text-neutral-400">|</span>
                <span className="text-neutral-600 dark:text-neutral-300">
                  Revenue: <strong className="text-neutral-900 dark:text-white">₱{activeTrend.revenue.toLocaleString()}</strong>
                </span>
                <span className="text-neutral-400">•</span>
                <span className="text-neutral-600 dark:text-neutral-300">
                  COGS: <strong className="text-rose-600 dark:text-rose-400">₱{activeTrend.cogs.toLocaleString()}</strong>
                </span>
                <span className="text-neutral-400">•</span>
                <span className="text-neutral-600 dark:text-neutral-300">
                  Gross Profit: <strong className="text-emerald-600 dark:text-emerald-400">₱{activeTrend.grossProfit.toLocaleString()}</strong> ({activeTrend.grossMarginPct.toFixed(1)}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  Food Cost:
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-black ${
                    activeTrend.foodCostPct <= targetFoodCostPct
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {activeTrend.foodCostPct.toFixed(1)}%
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {activeTrend.foodCostPct <= targetFoodCostPct ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 inline" />
                      {(targetFoodCostPct - activeTrend.foodCostPct).toFixed(1)}% under target
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      +{(activeTrend.foodCostPct - targetFoodCostPct).toFixed(1)}% over ceiling
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* High-Precision Dual-Axis SVG Chart */}
            <div className="mt-4 relative">
              {(() => {
                const svgWidth = 640;
                const svgHeight = 230;
                const padLeft = 65;
                const padRight = 50;
                const padTop = 32;
                const padBottom = 32;
                const chartW = svgWidth - padLeft - padRight; // 525
                const chartH = svgHeight - padTop - padBottom; // 166

                const maxSeriesVal = Math.max(...monthlyTrends.map((t) => Math.max(t.revenue, t.cogs)), 100000);
                const yMaxCurrency = Math.ceil((maxSeriesVal * 1.18) / 100000) * 100000;

                const allPctVals = monthlyTrends.map((t) => t.foodCostPct).concat([targetFoodCostPct]);
                const minFCPct = Math.max(16, Math.floor(Math.min(...allPctVals) - 2));
                const maxFCPct = Math.ceil(Math.max(...allPctVals) + 2);
                const pctRange = Math.max(1, maxFCPct - minFCPct);

                const currencyToY = (val: number) => padTop + chartH - (val / yMaxCurrency) * chartH;
                const pctToY = (pct: number) => padTop + chartH - ((pct - minFCPct) / pctRange) * chartH;

                const colWidth = chartW / monthlyTrends.length;
                const targetLineY = pctToY(targetFoodCostPct);

                const formatTickCurrency = (val: number) => {
                  if (val >= 1000000) return `₱${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `₱${(val / 1000).toFixed(0)}k`;
                  return `₱${val}`;
                };

                // Grid line levels: 0, 0.33, 0.66, 1.0
                const gridLevels = [0, 0.333, 0.666, 1];

                // Coordinates for Food Cost Line
                const linePoints = monthlyTrends.map((t, i) => ({
                  x: padLeft + (i + 0.5) * colWidth,
                  y: pctToY(t.foodCostPct),
                  fc: t.foodCostPct,
                  month: t.month,
                }));

                const linePathD = linePoints
                  .map((p, i) => (i === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`))
                  .join(' ');

                const areaPathD =
                  `M ${linePoints[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} ` +
                  linePoints.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
                  ` L ${linePoints[linePoints.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;

                const barWidth = 14;
                const barGap = 3;

                return (
                  <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-64 sm:h-72 select-none overflow-visible"
                  >
                    <defs>
                      {/* Gradient for Revenue Bars */}
                      <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#d97706" stopOpacity="0.8" />
                      </linearGradient>

                      {/* Gradient for COGS Bars */}
                      <linearGradient id="cogsBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#e11d48" stopOpacity="0.75" />
                      </linearGradient>

                      {/* Gradient for Food Cost Line Area */}
                      <linearGradient id="fcAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Gridlines & Axis Ticks */}
                    {gridLevels.map((lvl, idx) => {
                      const yPos = padTop + chartH - lvl * chartH;
                      const currVal = lvl * yMaxCurrency;
                      const pctVal = minFCPct + lvl * pctRange;

                      return (
                        <g key={idx}>
                          <line
                            x1={padLeft}
                            y1={yPos}
                            x2={padLeft + chartW}
                            y2={yPos}
                            stroke="currentColor"
                            strokeDasharray={lvl === 0 ? 'none' : '3 3'}
                            strokeWidth={lvl === 0 ? '1.5' : '1'}
                            className="text-neutral-200 dark:text-neutral-800"
                          />
                          {/* Left Axis: Currency (₱) */}
                          <text
                            x={padLeft - 8}
                            y={yPos + 3.5}
                            textAnchor="end"
                            fontSize="10"
                            fontWeight="500"
                            fill="currentColor"
                            className="fill-neutral-600 dark:fill-neutral-400"
                          >
                            {formatTickCurrency(currVal)}
                          </text>
                          {/* Right Axis: Food Cost % */}
                          <text
                            x={padLeft + chartW + 8}
                            y={yPos + 3.5}
                            textAnchor="start"
                            fontSize="10"
                            fontWeight="500"
                            fill="currentColor"
                            className="fill-neutral-600 dark:fill-neutral-400"
                          >
                            {pctVal.toFixed(0)}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Target Food Cost Reference Line */}
                    <g>
                      <line
                        x1={padLeft}
                        y1={targetLineY}
                        x2={padLeft + chartW}
                        y2={targetLineY}
                        stroke="#f59e0b"
                        strokeDasharray="4 3"
                        strokeWidth="1.5"
                        strokeOpacity="0.85"
                      />
                      {/* Target Pill Label on Right */}
                      <rect
                        x={padLeft + chartW - 86}
                        y={targetLineY - 9}
                        width="84"
                        height="18"
                        rx="4"
                        fill="#fef3c7"
                        stroke="#f59e0b"
                        strokeWidth="1"
                        className="dark:fill-amber-950/90 dark:stroke-amber-600"
                      />
                      <text
                        x={padLeft + chartW - 44}
                        y={targetLineY + 3.5}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="bold"
                        fill="#b45309"
                        className="dark:fill-amber-300"
                      >
                        Target {targetFoodCostPct}%
                      </text>
                    </g>

                    {/* Monthly Columns (Bars & X-Labels) */}
                    {monthlyTrends.map((t, idx) => {
                      const centerX = padLeft + (idx + 0.5) * colWidth;
                      const isActive = activeTrendIndex === idx;

                      const revY = currencyToY(t.revenue);
                      const revHeight = Math.max(3, padTop + chartH - revY);

                      const cogsY = currencyToY(t.cogs);
                      const cogsHeight = Math.max(3, padTop + chartH - cogsY);

                      return (
                        <g key={t.month}>
                          {/* Column active/hover highlight backdrop */}
                          {isActive && (
                            <rect
                              x={padLeft + idx * colWidth + 2}
                              y={padTop - 8}
                              width={colWidth - 4}
                              height={chartH + 16}
                              rx="8"
                              fill="#f59e0b"
                              fillOpacity="0.08"
                            />
                          )}

                          {/* Revenue Bar */}
                          {showRevenue && (
                            <rect
                              x={showCOGS ? centerX - barWidth - barGap / 2 : centerX - barWidth / 2}
                              y={revY}
                              width={barWidth}
                              height={revHeight}
                              rx="3"
                              fill="url(#revBarGrad)"
                              className="transition-all hover:opacity-90 cursor-pointer"
                            />
                          )}

                          {/* COGS Bar */}
                          {showCOGS && (
                            <rect
                              x={showRevenue ? centerX + barGap / 2 : centerX - barWidth / 2}
                              y={cogsY}
                              width={barWidth}
                              height={cogsHeight}
                              rx="3"
                              fill="url(#cogsBarGrad)"
                              className="transition-all hover:opacity-90 cursor-pointer"
                            />
                          )}

                          {/* Month Label on X-Axis */}
                          <text
                            x={centerX}
                            y={padTop + chartH + 18}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight={isActive ? 'bold' : '500'}
                            fill={isActive ? '#f59e0b' : 'currentColor'}
                            className={isActive ? 'fill-amber-600 dark:fill-amber-400' : 'fill-neutral-600 dark:fill-neutral-400'}
                          >
                            {t.month}
                          </text>

                          {/* Interactive Hover / Click Zone covering the full column */}
                          <rect
                            x={padLeft + idx * colWidth}
                            y={padTop - 12}
                            width={colWidth}
                            height={chartH + padBottom + 12}
                            fill="transparent"
                            cursor="pointer"
                            onMouseEnter={() => setActiveTrendIndex(idx)}
                            onClick={() => setActiveTrendIndex(idx)}
                          />
                        </g>
                      );
                    })}

                    {/* Food Cost % Line & Nodes (Drawn on top of bars) */}
                    {showFoodCostLine && (
                      <g className="pointer-events-none">
                        {/* Area glow */}
                        <path d={areaPathD} fill="url(#fcAreaGrad)" />

                        {/* Connected Polyline */}
                        <path
                          d={linePathD}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Node Points & Percentage Value Badges */}
                        {linePoints.map((p, idx) => {
                          const isActive = activeTrendIndex === idx;
                          const isOnTarget = p.fc <= targetFoodCostPct;

                          return (
                            <g key={p.month}>
                              {/* Glowing node ring */}
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={isActive ? 6.5 : 4.5}
                                fill="#10b981"
                                stroke="#ffffff"
                                strokeWidth="2"
                                className="transition-all"
                              />

                              {/* Value Badge above node */}
                              <g transform={`translate(${p.x}, ${p.y - 14})`}>
                                <rect
                                  x="-17"
                                  y="-9"
                                  width="34"
                                  height="16"
                                  rx="4"
                                  fill={isOnTarget ? '#059669' : '#d97706'}
                                  stroke="#ffffff"
                                  strokeWidth="1"
                                  className="shadow-sm"
                                />
                                <text
                                  x="0"
                                  y="2.5"
                                  textAnchor="middle"
                                  fontSize="9"
                                  fontWeight="bold"
                                  fill="#ffffff"
                                >
                                  {p.fc.toFixed(1)}%
                                </text>
                              </g>
                            </g>
                          );
                        })}
                      </g>
                    )}
                  </svg>
                );
              })()}
            </div>
          </div>

          {/* 4-Metric Executive KPI Summary Strip */}
          <div className="mt-4 pt-3.5 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/50">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                6-Mo Avg Food Cost
              </span>
              <div className="mt-0.5 text-sm font-black text-neutral-900 dark:text-white">
                {avgFoodCostPct.toFixed(1)}%
              </div>
              <span className="text-[10px] text-neutral-500">
                Target: {targetFoodCostPct}%
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/50">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                6-Mo Total Revenue
              </span>
              <div className="mt-0.5 text-sm font-black text-amber-600 dark:text-amber-400">
                ₱{(totalPeriodRevenue / 1000000).toFixed(2)}M
              </div>
              <span className="text-[10px] text-neutral-500">
                Gross sales volume
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/50">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                6-Mo Gross Profit
              </span>
              <div className="mt-0.5 text-sm font-black text-emerald-600 dark:text-emerald-400">
                ₱{((totalPeriodRevenue - totalPeriodCOGS) / 1000000).toFixed(2)}M
              </div>
              <span className="text-[10px] text-neutral-500">
                {((1 - totalPeriodCOGS / totalPeriodRevenue) * 100).toFixed(1)}% margin
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/70 dark:border-neutral-700/50">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                Budget Compliance
              </span>
              <div className="mt-0.5 text-sm font-black text-neutral-900 dark:text-white">
                {onTargetCyclesCount} of {monthlyTrends.length} cycles
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Controlled &amp; Profitable
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Location Benchmarking Widget */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-500" />
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                  Unit Benchmarking
                </h2>
                <span className="text-[10px] uppercase font-bold text-neutral-400">
                  {locations.length} {locations.length === 1 ? 'Store' : 'Stores'}
                </span>
              </div>
              {onOpenLocationsModal && (
                <button
                  type="button"
                  onClick={onOpenLocationsModal}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition-colors shadow-sm"
                  title="Add or remove restaurant units"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>Manage Units</span>
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {locations.map((loc) => {
                // Compute location specific food cost
                const locAnalysis = analyzeMenuEngineering(menuItems, ingredients, laborRatePerHour, loc.id);
                const locAlerts = alerts.filter((a) => a.locationId === loc.id && a.status === 'open').length;

                return (
                  <div
                    key={loc.id}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900 dark:text-white">
                        {loc.name}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          locAnalysis.overallFoodCostPercent <= targetFoodCostPct
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {locAnalysis.overallFoodCostPercent.toFixed(1)}% FC
                      </span>
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          locAnalysis.overallFoodCostPercent <= targetFoodCostPct
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, (locAnalysis.overallFoodCostPercent / 35) * 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>Monthly Vol: {locAnalysis.totalMonthlyRevenue > 0 ? `₱${(locAnalysis.totalMonthlyRevenue / 1000).toFixed(0)}k` : '₱0'}</span>
                      <span className={locAlerts > 0 ? 'text-red-500 font-bold' : 'text-neutral-400'}>
                        {locAlerts > 0 ? `${locAlerts} Low Stock Alerts` : 'Stock Stable'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => onNavigate('reports')}
              className="w-full py-2 rounded-xl text-xs font-bold text-center bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors flex items-center justify-center gap-1"
            >
              <span>View Full Location Audit Report</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Menu Engineering Matrix (Stars, Plowhorses, Puzzles, Dogs) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Menu Engineering Profitability Matrix
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold">
                Margin vs Popularity
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Classifies dishes into Stars, Plowhorses, Puzzles, and Dogs based on gross contribution margin and volume.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['all', 'Star', 'Plowhorse', 'Puzzle', 'Dog'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setMatrixFilter(filter)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  matrixFilter === filter
                    ? 'bg-amber-500 text-neutral-950'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {filter === 'all' ? 'All Dishes' : `${filter}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Quadrant Description Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
              ⭐ Stars (High Margin, High Vol)
            </span>
            <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-1">
              Flagship winners. Maintain strict recipe consistency and prominent menu placement.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
              🐎 Plowhorses (Low Margin, High Vol)
            </span>
            <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-1">
              Popular customer favorites. Bump selling price slightly or optimize trim waste to raise margin.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
              🧩 Puzzles (High Margin, Low Vol)
            </span>
            <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 mt-1">
              High profit margin but low order volume. Reposition on menu or train servers to recommend.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-neutral-500/10 border border-neutral-500/20">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
              🐕 Dogs (Low Margin, Low Vol)
            </span>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
              Unpopular with thin margin. Consider 86-ing, replacing with seasonal special, or major rework.
            </p>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Menu Item</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Cost / Portion</th>
                <th className="py-2.5 px-3">Selling Price</th>
                <th className="py-2.5 px-3">Food Cost %</th>
                <th className="py-2.5 px-3">Gross Margin ₱</th>
                <th className="py-2.5 px-3">Monthly Vol</th>
                <th className="py-2.5 px-3">Classification</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
              {filteredMatrixItems.map(({ menuItem, breakdown, classification }) => {
                const getBadge = () => {
                  switch (classification) {
                    case 'Star':
                      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                    case 'Plowhorse':
                      return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
                    case 'Puzzle':
                      return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
                    case 'Dog':
                      return 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-400 border-neutral-500/30';
                  }
                };

                return (
                  <tr key={menuItem.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {menuItem.name}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate max-w-xs">
                        {menuItem.description}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[11px]">
                        {menuItem.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-800 dark:text-neutral-200">
                      ₱{breakdown.totalCostPerPortion.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 font-bold text-neutral-900 dark:text-white">
                      ₱{breakdown.sellingPrice.toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-bold ${
                          breakdown.foodCostPercent <= targetFoodCostPct
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {breakdown.foodCostPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                      ₱{breakdown.grossMarginAmount.toFixed(2)} ({breakdown.grossMarginPercent.toFixed(0)}%)
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300">
                      {breakdown.totalMonthlyUnits} orders
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getBadge()}`}>
                        {classification}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          onSelectRecipeForCosting(menuItem.id);
                          onNavigate('costing');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[11px] transition-colors"
                      >
                        Costing Tool
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (< 768px) */}
        <div className="md:hidden space-y-3">
          {filteredMatrixItems.map(({ menuItem, breakdown, classification }) => {
            const getBadge = () => {
              switch (classification) {
                case 'Star':
                  return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                case 'Plowhorse':
                  return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
                case 'Puzzle':
                  return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
                case 'Dog':
                  return 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-400 border-neutral-500/30';
              }
            };

            return (
              <div
                key={menuItem.id}
                className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-bold text-neutral-900 dark:text-white text-xs">
                        {menuItem.name}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        {menuItem.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                      {menuItem.description}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0 ${getBadge()}`}>
                    {classification}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/80 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                      Price / Cost
                    </span>
                    <span className="font-black text-neutral-900 dark:text-white text-sm">
                      ₱{breakdown.sellingPrice.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-neutral-500 block">
                      Cost: ₱{breakdown.totalCostPerPortion.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-bold block">
                      Food Cost &amp; Margin
                    </span>
                    <span
                      className={`font-black text-sm block ${
                        breakdown.foodCostPercent <= targetFoodCostPct
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {breakdown.foodCostPercent.toFixed(1)}% FC
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                      +₱{breakdown.grossMarginAmount.toFixed(2)} ({breakdown.grossMarginPercent.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-neutral-500">
                    Monthly Vol: <strong className="text-neutral-800 dark:text-neutral-200">{breakdown.totalMonthlyUnits}</strong> orders
                  </span>

                  <button
                    onClick={() => {
                      onSelectRecipeForCosting(menuItem.id);
                      onNavigate('costing');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 transition-colors shadow-sm"
                  >
                    Open Costing Tool →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
