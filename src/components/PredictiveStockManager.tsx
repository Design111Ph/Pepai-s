import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Search,
  ShoppingCart,
  Download,
  AlertTriangle,
  Calendar,
  Layers,
  ChevronRight,
  Clock,
  Sliders,
  CheckCircle,
  Plus,
  Minus,
  RefreshCw,
  X,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  Check,
  Building,
} from 'lucide-react';
import {
  Ingredient,
  Location,
  User,
  AuditLog,
  PredictiveStockInsight,
  PredictiveUrgency,
} from '../types';
import {
  calculatePredictiveStockUsage,
  DEFAULT_PREDICTIVE_OPTIONS,
  PredictiveScenarioOptions,
} from '../utils/predictiveStock';
import { StockMovementService } from '../utils/stockMovements';
import { StorageService, exportToCSV } from '../utils/storage';

interface PredictiveStockManagerProps {
  ingredients: Ingredient[];
  locations: Location[];
  selectedLocationId: string;
  activeLocationObj: Location;
  auditLogs: AuditLog[];
  currentUser: User;
  onUpdateStock: (ingredientId: string, locationId: string, newQty: number, reason?: string) => void;
  onShowNotice?: (msg: string) => void;
}

export const PredictiveStockManager: React.FC<PredictiveStockManagerProps> = ({
  ingredients,
  locations,
  selectedLocationId,
  activeLocationObj,
  auditLogs,
  currentUser,
  onUpdateStock,
  onShowNotice,
}) => {
  // Scenario configuration
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [bufferPct, setBufferPct] = useState<number>(20);
  const [weekendSurge, setWeekendSurge] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUrgency, setSelectedUrgency] = useState<'all' | PredictiveUrgency>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Manual PO quantity overrides: { [ingredientId]: number }
  const [poOverrides, setPoOverrides] = useState<Record<string, number>>({});

  // Deep dive inspect modal state
  const [inspectingInsight, setInspectingInsight] = useState<PredictiveStockInsight | null>(null);

  // Stock movements for calculation
  const stockMovements = useMemo(() => StockMovementService.getMovements(), []);

  // Compute predictive insights
  const scenarioOptions: PredictiveScenarioOptions = useMemo(
    () => ({
      horizonDays,
      bufferPct,
      weekendSurge,
    }),
    [horizonDays, bufferPct, weekendSurge]
  );

  const insights: PredictiveStockInsight[] = useMemo(() => {
    return calculatePredictiveStockUsage(
      ingredients,
      auditLogs,
      stockMovements,
      selectedLocationId,
      scenarioOptions
    );
  }, [ingredients, auditLogs, stockMovements, selectedLocationId, scenarioOptions]);

  // Categories list
  const categories = ['All', 'Proteins', 'Dairy & Cheese', 'Produce', 'Dry Goods & Flour', 'Oils & Condiments'];

  // Filtered insights
  const filteredInsights = useMemo(() => {
    return insights.filter((item) => {
      const matchesSearch =
        item.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUrgency =
        selectedUrgency === 'all' || item.urgency === selectedUrgency;
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesUrgency && matchesCategory;
    });
  }, [insights, searchQuery, selectedUrgency, selectedCategory]);

  // Summary KPI Calculations
  const criticalItems = useMemo(() => insights.filter((i) => i.urgency === 'critical'), [insights]);
  const reorderItems = useMemo(() => insights.filter((i) => i.urgency === 'critical' || i.urgency === 'reorder'), [insights]);

  // Total projected PO spend factoring manual overrides
  const totalSuggestedSpend = useMemo(() => {
    return insights.reduce((sum, item) => {
      const orderQty = poOverrides[item.ingredientId] ?? item.suggestedWeeklyPO;
      return sum + orderQty * item.unitCost;
    }, 0);
  }, [insights, poOverrides]);

  const totalDailyBurnCost = useMemo(() => {
    return insights.reduce((sum, item) => sum + item.avgDailyBurnRate * item.unitCost, 0);
  }, [insights]);

  // Override handler
  const handleAdjustPO = (ingredientId: string, currentVal: number, delta: number) => {
    const current = poOverrides[ingredientId] ?? currentVal;
    const nextVal = Math.max(0, parseFloat((current + delta).toFixed(1)));
    setPoOverrides((prev) => ({ ...prev, [ingredientId]: nextVal }));
  };

  const handleResetPO = (ingredientId: string) => {
    setPoOverrides((prev) => {
      const copy = { ...prev };
      delete copy[ingredientId];
      return copy;
    });
  };

  // Generate Master Weekly PO CSV
  const handleExportPOCSV = () => {
    const rows = filteredInsights.map((item) => {
      const finalOrderQty = poOverrides[item.ingredientId] ?? item.suggestedWeeklyPO;
      return {
        'Ingredient Name': item.ingredientName,
        Category: item.category,
        Supplier: item.supplier,
        'Current Stock': `${item.currentStock} ${item.unit}`,
        'Avg Daily Burn': `${item.avgDailyBurnRate} ${item.unit}/day`,
        'Days Remaining': `${item.daysRemaining} days`,
        'Runout Date': item.runoutDate,
        'Suggested PO Qty': finalOrderQty,
        Unit: item.unit,
        'Unit Cost (PHP)': item.unitCost.toFixed(2),
        'Estimated PO Total (PHP)': (finalOrderQty * item.unitCost).toFixed(2),
        'Urgency Level': item.urgencyLabel,
        'Recommended Dispatch': item.recommendedOrderDate,
      };
    });

    exportToCSV(`pepais-predictive-weekly-po-${activeLocationObj.code}`, rows);
    onShowNotice?.(`Master Weekly PO generated with ${rows.length} ingredient suggestions.`);
  };

  // One-click quick order for all critical & reorder items
  const handleBatchOrderCritical = () => {
    const itemsToOrder = reorderItems.filter((item) => {
      const qty = poOverrides[item.ingredientId] ?? item.suggestedWeeklyPO;
      return qty > 0;
    });

    if (itemsToOrder.length === 0) {
      onShowNotice?.('No critical or reorder purchase orders pending.');
      return;
    }

    const totalBatchSpend = itemsToOrder.reduce((sum, item) => {
      const qty = poOverrides[item.ingredientId] ?? item.suggestedWeeklyPO;
      return sum + qty * item.unitCost;
    }, 0);

    // Record in audit log
    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: activeLocationObj.id,
      locationName: activeLocationObj.name,
      category: 'inventory',
      action: 'Predictive Weekly PO Dispatched',
      details: `Generated replenishment PO for ${itemsToOrder.length} critical items. Total estimated commitment: ₱${totalBatchSpend.toFixed(2)}.`,
    });

    onShowNotice?.(
      `Dispatched PO batch for ${itemsToOrder.length} ingredients (₱${totalBatchSpend.toFixed(2)}) based on audit log demand forecasting.`
    );
  };

  // Single item PO dispatch simulation
  const handleDispatchSinglePO = (item: PredictiveStockInsight, qty: number) => {
    if (qty <= 0) return;
    const totalCost = qty * item.unitCost;

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: activeLocationObj.id,
      locationName: activeLocationObj.name,
      category: 'inventory',
      action: 'Supplier PO Dispatched',
      details: `Dispatched order for ${qty} ${item.unit} ${item.ingredientName} to ${item.supplier} (Est. ₱${totalCost.toFixed(2)}).`,
    });

    onShowNotice?.(
      `PO dispatched for ${qty} ${item.unit} of ${item.ingredientName} to ${item.supplier}.`
    );
    setInspectingInsight(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Scenario Controls */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <TrendingUp className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                  Predictive Stock Usage &amp; Weekly PO Forecaster
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Audit Log Trend Engine
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Analyzes historical recipe explosion depletions, daily burn rates, and weekend spikes to suggest proactive weekly replenishment orders. Unit:{' '}
                <strong className="text-neutral-800 dark:text-neutral-200">{activeLocationObj.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportPOCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 transition-colors shadow-xs"
              title="Export suggested PO matrix to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PO (CSV)</span>
            </button>
            <button
              type="button"
              onClick={handleBatchOrderCritical}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-sm active:scale-98"
              title="One-click order all ingredients marked Critical or Reorder"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Order All Critical ({reorderItems.length})</span>
            </button>
          </div>
        </div>

        {/* Interactive Scenario Controls Bar */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-400 font-bold flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5" /> Forecast Scenario:
            </span>

            {/* Forecast Horizon */}
            <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setHorizonDays(3)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  horizonDays === 3
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                3 Days (Rush)
              </button>
              <button
                type="button"
                onClick={() => setHorizonDays(7)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  horizonDays === 7
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                7 Days (Weekly PO)
              </button>
              <button
                type="button"
                onClick={() => setHorizonDays(14)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  horizonDays === 14
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                14 Days (Bi-Weekly)
              </button>
            </div>

            {/* Safety Stock Buffer */}
            <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-0.5 border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setBufferPct(10)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  bufferPct === 10
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
                title="10% Lean Buffer"
              >
                10% Lean
              </button>
              <button
                type="button"
                onClick={() => setBufferPct(20)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  bufferPct === 20
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
                title="20% Standard Par Buffer"
              >
                20% Par
              </button>
              <button
                type="button"
                onClick={() => setBufferPct(30)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  bufferPct === 30
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
                title="30% Conservative Buffer for Long Weekend"
              >
                30% Safe
              </button>
            </div>

            {/* Weekend Surge Spike Toggle */}
            <button
              type="button"
              onClick={() => setWeekendSurge(!weekendSurge)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                weekendSurge
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400'
              }`}
            >
              <span>🔥 Weekend Spike (+15%)</span>
              <span className={`w-2 h-2 rounded-full ${weekendSurge ? 'bg-amber-500' : 'bg-neutral-400'}`} />
            </button>
          </div>

          <span className="text-[11px] text-neutral-400 italic">
            Calibrated against {auditLogs.length} audit logs &amp; {stockMovements.length} 30-day stock movements
          </span>
        </div>

        {/* Forecast KPI Metrics Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
          {/* Total Suggested PO Spend */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
              Projected {horizonDays}-Day PO Spend
            </span>
            <div className="mt-1 text-2xl font-black text-purple-600 dark:text-purple-400">
              ₱{totalSuggestedSpend.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 block">
              Estimated restocking capital required
            </span>
          </div>

          {/* Immediate Runout Risk */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
              Critical Runout (&lt; 2 Days)
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {criticalItems.length}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold">
                High Risk
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 block">
              Stockout before weekend service
            </span>
          </div>

          {/* Reorder Needed This Week */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
              Total Recommended Orders
            </span>
            <div className="mt-1 text-2xl font-black text-neutral-900 dark:text-white">
              {reorderItems.length} <span className="text-xs text-neutral-400 font-normal">of {insights.length}</span>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 block">
              Items at or below par buffer
            </span>
          </div>

          {/* Daily Kitchen Burn Rate */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
              Kitchen Daily Burn Rate
            </span>
            <div className="mt-1 text-2xl font-black text-neutral-900 dark:text-white">
              ₱{totalDailyBurnCost.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              <span className="text-xs text-neutral-400 font-normal"> / day</span>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 block">
              Average inventory consumption
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar & Urgency Chips */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ingredient or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-xs"
          />
        </div>

        {/* Urgency Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {[
            { id: 'all', label: `All (${insights.length})` },
            { id: 'critical', label: `🔴 Critical (${criticalItems.length})` },
            { id: 'reorder', label: `🟡 Reorder (${insights.filter((i) => i.urgency === 'reorder').length})` },
            { id: 'optimal', label: `🟢 Optimal (${insights.filter((i) => i.urgency === 'optimal').length})` },
            { id: 'surplus', label: `🔵 Surplus (${insights.filter((i) => i.urgency === 'surplus').length})` },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSelectedUrgency(chip.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedUrgency === chip.id
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Predictive PO Table */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-200">
              Suggested Purchase Orders ({filteredInsights.length} ingredients)
            </h3>
          </div>
          <span className="text-[11px] text-neutral-400">
            Click any row to view 7-day depletion countdown and audit trail
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[840px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-2.5 px-3">Ingredient</th>
                <th className="py-2.5 px-3">On-Hand Stock</th>
                <th className="py-2.5 px-3">Daily Burn Rate</th>
                <th className="py-2.5 px-3">Runout Horizon</th>
                <th className="py-2.5 px-3 text-right">Projected Demand</th>
                <th className="py-2.5 px-3 text-center">Suggested PO Qty</th>
                <th className="py-2.5 px-3 text-right">Est. Cost (₱)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-medium">
              {filteredInsights.map((item) => {
                const isOverridden = poOverrides[item.ingredientId] !== undefined;
                const effectivePOQty = poOverrides[item.ingredientId] ?? item.suggestedWeeklyPO;
                const effectiveCost = Math.round(effectivePOQty * item.unitCost * 100) / 100;

                return (
                  <tr
                    key={item.ingredientId}
                    className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors ${
                      item.urgency === 'critical'
                        ? 'bg-rose-500/5'
                        : item.urgency === 'reorder'
                        ? 'bg-amber-500/5'
                        : ''
                    }`}
                  >
                    {/* Ingredient */}
                    <td className="py-3 px-3">
                      <div
                        onClick={() => setInspectingInsight(item)}
                        className="cursor-pointer group"
                      >
                        <span className="font-bold text-neutral-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors block">
                          {item.ingredientName}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {item.supplier} • {item.category}
                        </span>
                      </div>
                    </td>

                    {/* On Hand Stock */}
                    <td className="py-3 px-3">
                      <span className="font-bold text-neutral-900 dark:text-white block">
                        {item.currentStock} {item.unit}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        Par: {item.parLevel} {item.unit}
                      </span>
                    </td>

                    {/* Daily Burn Rate */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                        <span>{item.avgDailyBurnRate} {item.unit}/day</span>
                        {item.trendVelocity === 'up' && (
                          <span
                            className="inline-flex items-center text-[10px] text-rose-600 dark:text-rose-400 font-bold"
                            title={`Usage velocity increased ${item.trendPercent}% vs prior week`}
                          >
                            <TrendingUp className="w-3 h-3" /> +{item.trendPercent}%
                          </span>
                        )}
                        {item.trendVelocity === 'down' && (
                          <span
                            className="inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold"
                            title={`Usage velocity decreased ${Math.abs(item.trendPercent)}%`}
                          >
                            <TrendingDown className="w-3 h-3" /> {item.trendPercent}%
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400">
                        Audit history: {item.historicalAuditEventsCount} pts
                      </span>
                    </td>

                    {/* Runout Horizon */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-black text-xs ${
                              item.daysRemaining <= 2
                                ? 'text-rose-600 dark:text-rose-400'
                                : item.daysRemaining <= 4.5
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {item.daysRemaining > 30 ? '> 30 days' : `${item.daysRemaining} days`}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            (Runout: {item.runoutDate})
                          </span>
                        </div>
                        {/* Countdown progress bar */}
                        <div className="h-1.5 w-24 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            style={{
                              width: `${Math.min(100, (item.daysRemaining / 7) * 100)}%`,
                            }}
                            className={`h-full ${
                              item.daysRemaining <= 2
                                ? 'bg-rose-500'
                                : item.daysRemaining <= 4.5
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Projected Demand */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="font-bold text-neutral-900 dark:text-white block">
                        {item.projectedWeeklyDemand} {item.unit}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        +{item.safetyStockBuffer} {item.unit} buffer
                      </span>
                    </td>

                    {/* Suggested Weekly PO Qty (with interactive overrides) */}
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdjustPO(item.ingredientId, item.suggestedWeeklyPO, -1)}
                          className="w-6 h-6 rounded bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 font-bold text-xs flex items-center justify-center text-neutral-700 dark:text-neutral-300"
                          title="Reduce PO by 1"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="w-16 text-center">
                          <span
                            className={`font-black text-sm block ${
                              effectivePOQty > 0
                                ? 'text-purple-600 dark:text-purple-400'
                                : 'text-neutral-400'
                            }`}
                          >
                            {effectivePOQty}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-neutral-400 block -mt-0.5">
                            {item.unit} {isOverridden && '(custom)'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAdjustPO(item.ingredientId, item.suggestedWeeklyPO, 1)}
                          className="w-6 h-6 rounded bg-purple-500/20 hover:bg-purple-500/30 font-bold text-xs flex items-center justify-center text-purple-700 dark:text-purple-300"
                          title="Increase PO by 1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => handleResetPO(item.ingredientId)}
                            className="p-1 text-[10px] text-neutral-400 hover:text-rose-500"
                            title="Reset to algorithm suggested value"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Estimated Cost */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="font-black text-neutral-900 dark:text-white block">
                        ₱{effectiveCost.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        @ ₱{item.unitCost.toFixed(2)}/{item.unit}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.urgency === 'critical'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 animate-pulse'
                            : item.urgency === 'reorder'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            : item.urgency === 'optimal'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {item.urgency === 'critical' && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                        <span>{item.urgencyLabel}</span>
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectingInsight(item)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-[11px] transition-colors flex items-center gap-1"
                          title="View 7-day usage countdown & audit log events"
                        >
                          <Eye className="w-3 h-3 text-neutral-500" />
                          <span>Inspect</span>
                        </button>
                        {effectivePOQty > 0 && (
                          <button
                            type="button"
                            onClick={() => handleDispatchSinglePO(item, effectivePOQty)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-colors flex items-center gap-1 shadow-xs"
                            title="Place PO for this item"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Order</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEEP-DIVE FORECAST INSPECT DRAWER / MODAL */}
      {inspectingInsight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl p-5 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                      {inspectingInsight.ingredientName}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      {inspectingInsight.category} • Supplier: <strong className="text-neutral-700 dark:text-neutral-300">{inspectingInsight.supplier}</strong>
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingInsight(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Current On-Hand
                </span>
                <span className="text-base font-black text-neutral-900 dark:text-white">
                  {inspectingInsight.currentStock} {inspectingInsight.unit}
                </span>
                <span className="text-[10px] text-neutral-400 block">
                  Par: {inspectingInsight.parLevel} {inspectingInsight.unit}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Daily Burn Rate
                </span>
                <span className="text-base font-black text-neutral-900 dark:text-white">
                  {inspectingInsight.avgDailyBurnRate} {inspectingInsight.unit}/d
                </span>
                <span className="text-[10px] text-neutral-400 block">
                  Weekly: {inspectingInsight.projectedWeeklyDemand} {inspectingInsight.unit}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Runout Horizon
                </span>
                <span
                  className={`text-base font-black ${
                    inspectingInsight.daysRemaining <= 2
                      ? 'text-rose-600'
                      : inspectingInsight.daysRemaining <= 4.5
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {inspectingInsight.daysRemaining} Days
                </span>
                <span className="text-[10px] text-neutral-400 block">
                  Depletes: {inspectingInsight.runoutDate}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Suggested Weekly PO
                </span>
                <span className="text-base font-black text-purple-600 dark:text-purple-400">
                  {poOverrides[inspectingInsight.ingredientId] ?? inspectingInsight.suggestedWeeklyPO} {inspectingInsight.unit}
                </span>
                <span className="text-[10px] text-neutral-400 block">
                  Est. ₱{((poOverrides[inspectingInsight.ingredientId] ?? inspectingInsight.suggestedWeeklyPO) * inspectingInsight.unitCost).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Day-by-Day Depletion Countdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  <span>Day-by-Day Projected Stock Depletion Countdown</span>
                </span>
                <span className="text-[11px] text-neutral-400">
                  Includes weekend spike weighting
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center">
                {inspectingInsight.dailyProjectedUsage.map((day, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl border text-[11px] ${
                      day.projectedStockRemaining <= 0
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
                        : day.projectedStockRemaining < inspectingInsight.minThreshold
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <span className="font-bold block text-[10px] uppercase text-neutral-400">
                      {day.dayName} {day.isWeekend && '🔥'}
                    </span>
                    <span className="text-[9px] text-neutral-400 block">{day.date}</span>
                    <span className="font-bold text-xs block my-0.5">
                      -{day.projectedQty}
                    </span>
                    <span className="text-[10px] font-black block pt-1 border-t border-neutral-200/50 dark:border-neutral-700/50">
                      {day.projectedStockRemaining} {inspectingInsight.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log Historical Data Points */}
            <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                <span>Historical Audit Log Activity Points ({inspectingInsight.recentAuditPoints.length} recent)</span>
              </span>

              {inspectingInsight.recentAuditPoints.length === 0 ? (
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 text-xs text-neutral-400 text-center">
                  Burn rate modeled from 30-day stock movement recipe explosion and location par velocity.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {inspectingInsight.recentAuditPoints.map((pt) => (
                    <div
                      key={pt.id}
                      className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 text-xs flex items-start justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900 dark:text-white">
                            {pt.action}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {pt.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {pt.details}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-400 shrink-0">
                        {pt.userName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-500">
                Recommended Order Date: <strong className="text-neutral-900 dark:text-white">{inspectingInsight.recommendedOrderDate}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectingInsight(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDispatchSinglePO(
                      inspectingInsight,
                      poOverrides[inspectingInsight.ingredientId] ?? inspectingInsight.suggestedWeeklyPO
                    )
                  }
                  className="px-4 py-1.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-sm"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>
                    Confirm &amp; Place PO ({poOverrides[inspectingInsight.ingredientId] ?? inspectingInsight.suggestedWeeklyPO} {inspectingInsight.unit})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
