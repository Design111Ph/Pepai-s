import React, { useState } from 'react';
import {
  Boxes,
  Search,
  Plus,
  Minus,
  AlertTriangle,
  Flame,
  ArrowRightLeft,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  WifiOff,
  Filter,
  Trash2,
  Building,
  Scan,
  TrendingDown,
  Download,
  RotateCcw,
  Info,
  Calendar,
  Layers,
  ChefHat,
  X,
  TrendingUp,
  Sparkles,
  QrCode,
  Camera,
} from 'lucide-react';
import {
  Ingredient,
  IngredientCategory,
  Location,
  User,
  WasteCategory,
  WasteLogEntry,
  AuditLog,
} from '../types';
import { StorageService, exportToCSV } from '../utils/storage';
import { StockMovementService } from '../utils/stockMovements';
import { PredictiveStockManager } from './PredictiveStockManager';
import { IngredientQRScannerModal } from './IngredientQRScannerModal';

interface InventoryManagerProps {
  ingredients: Ingredient[];
  locations: Location[];
  selectedLocationId: string;
  currentUser: User;
  isOffline: boolean;
  auditLogs?: AuditLog[];
  onUpdateStock: (ingredientId: string, locationId: string, newQty: number, reason?: string) => void;
  onTransferStock: (ingredientId: string, fromLoc: string, toLoc: string, qty: number) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  ingredients,
  locations,
  selectedLocationId,
  currentUser,
  isOffline,
  auditLogs,
  onUpdateStock,
  onTransferStock,
}) => {
  const effectiveAuditLogs = auditLogs || StorageService.getAuditLogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'table' | 'fast_count' | 'waste' | 'predictive'>('table');

  // QR Code Camera Scanner Modal state
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  // Waste logs state
  const [wasteLogs, setWasteLogs] = useState<WasteLogEntry[]>(() => StorageService.getWasteLogs());
  const [selectedWasteCategory, setSelectedWasteCategory] = useState<'all' | WasteCategory>('all');
  const [wasteSearchQuery, setWasteSearchQuery] = useState('');

  // Modals state
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  // Waste Modal Form state
  const [wasteIngredientId, setWasteIngredientId] = useState<string>(ingredients[0]?.id || '');
  const [wasteLocationId, setWasteLocationId] = useState<string>(
    selectedLocationId === 'all' ? locations[0]?.id || '' : selectedLocationId
  );
  const [wasteCategory, setWasteCategory] = useState<WasteCategory>('spoilage');
  const [wasteQty, setWasteQty] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState<string>('Cooler Temp Issue');
  const [wasteNotes, setWasteNotes] = useState<string>('');

  // Stock Transfer Modal Form state
  const [transferQty, setTransferQty] = useState<number>(5);
  const [transferSourceLoc, setTransferSourceLoc] = useState<string>(
    selectedLocationId === 'all' ? locations[0]?.id || '' : selectedLocationId
  );
  const [transferTargetLoc, setTransferTargetLoc] = useState<string>(
    locations.find((l) => l.id !== selectedLocationId)?.id || locations[0]?.id || ''
  );

  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Active location context
  const activeActionLocationId =
    selectedLocationId === 'all' ? locations[0]?.id || '' : selectedLocationId;
  const activeLocationObj =
    locations.find((l) => l.id === activeActionLocationId) || locations[0];

  const reorderAlertCount = ingredients.filter(
    (i) => (i.stockByLocation[activeActionLocationId]?.quantity || 0) < i.parLevel
  ).length;

  const categories: string[] = [
    'All',
    'Proteins',
    'Dairy & Cheese',
    'Produce',
    'Dry Goods & Flour',
    'Oils & Condiments',
  ];

  // Preset reasons based on category
  const getPresetReasonsForCategory = (cat: WasteCategory): string[] => {
    switch (cat) {
      case 'spoilage':
        return [
          'Cooler Temp Issue',
          'Mold / Bacterial Growth',
          'Soured Dairy / Whey Separation',
          'Leaf Wilt & Blackening',
          'Oxidized / Off-Odor',
        ];
      case 'over_prep':
        return [
          'Excess Batch Prepped (Unsold)',
          'Prep Over-Forecast for Shift',
          'Unconsumed Cooked Batch at Close',
          'Over-Portioned Prep Tray',
        ];
      case 'burnt':
        return [
          'Scorched on Wood Grill',
          'Overcooked Past Guest Spec',
          'Wood Oven Crust Char / Burn',
          'Pan Flare-Up / Scorched Sauce',
          'Line Cook Fire Mistake',
        ];
      case 'expired':
        return [
          'Past FIFO Shelf Life Label',
          'Supplier Best-Before Exceeded',
          'Secondary Prep Holding Expired',
        ];
      case 'dropped_damaged':
        return [
          'Dropped on Kitchen Floor',
          'Bag Puncture During Restock',
          'Container Lid Cracked / Spilled',
          'Prep Station Spill',
        ];
      default:
        return ['General Kitchen Waste', 'Unusable Quality Standard', 'Handling Mistake'];
    }
  };

  // Open Waste Modal for specific ingredient or generic
  const handleOpenWasteModal = (ing?: Ingredient) => {
    if (ing) {
      setSelectedIngredient(ing);
      setWasteIngredientId(ing.id);
    } else {
      const defaultIng = ingredients[0];
      setSelectedIngredient(defaultIng);
      setWasteIngredientId(defaultIng?.id || '');
    }

    const targetLoc = selectedLocationId === 'all' ? locations[0]?.id || '' : selectedLocationId;
    setWasteLocationId(targetLoc);
    setWasteCategory('spoilage');
    setWasteQty(1);
    setWasteReason('Cooler Temp Issue');
    setWasteNotes('');
    setIsWasteModalOpen(true);
  };

  // Open Transfer Modal
  const handleOpenTransferModal = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    const sourceLoc = selectedLocationId === 'all' ? locations[0]?.id || '' : selectedLocationId;
    setTransferSourceLoc(sourceLoc);
    const targetLoc = locations.find((l) => l.id !== sourceLoc)?.id || locations[0]?.id || '';
    setTransferTargetLoc(targetLoc);
    setTransferQty(Math.min(5, ing.stockByLocation[sourceLoc]?.quantity || 1));
    setIsTransferModalOpen(true);
  };

  // Filter ingredients for table & fast count
  const filteredIngredients = ingredients.filter((ing) => {
    const matchesSearch =
      ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ing.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' || ing.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter waste logs
  const filteredWasteLogs = wasteLogs.filter((log) => {
    const matchesLoc =
      selectedLocationId === 'all' ? true : log.locationId === selectedLocationId;
    const matchesCat =
      selectedWasteCategory === 'all' ? true : log.wasteCategory === selectedWasteCategory;
    const matchesSearch =
      wasteSearchQuery === '' ||
      log.ingredientName.toLowerCase().includes(wasteSearchQuery.toLowerCase()) ||
      log.reason.toLowerCase().includes(wasteSearchQuery.toLowerCase()) ||
      log.loggedBy.toLowerCase().includes(wasteSearchQuery.toLowerCase()) ||
      (log.notes && log.notes.toLowerCase().includes(wasteSearchQuery.toLowerCase()));
    return matchesLoc && matchesCat && matchesSearch;
  });

  // Location-scoped waste logs for metrics
  const locationWasteLogs = wasteLogs.filter((log) =>
    selectedLocationId === 'all' ? true : log.locationId === selectedLocationId
  );

  // Waste KPI Metrics
  const totalWasteLoss = locationWasteLogs.reduce((sum, item) => sum + item.totalCost, 0);
  const totalWasteVolume = locationWasteLogs.reduce((sum, item) => sum + item.quantity, 0);

  // Category breakdown metrics
  const categoryStats: Record<WasteCategory, { count: number; cost: number }> = {
    spoilage: { count: 0, cost: 0 },
    over_prep: { count: 0, cost: 0 },
    burnt: { count: 0, cost: 0 },
    expired: { count: 0, cost: 0 },
    dropped_damaged: { count: 0, cost: 0 },
    other: { count: 0, cost: 0 },
  };

  locationWasteLogs.forEach((log) => {
    if (categoryStats[log.wasteCategory]) {
      categoryStats[log.wasteCategory].count += 1;
      categoryStats[log.wasteCategory].cost += log.totalCost;
    }
  });

  // Find top loss category
  const allWasteCategories: WasteCategory[] = [
    'spoilage',
    'over_prep',
    'burnt',
    'expired',
    'dropped_damaged',
    'other',
  ];

  let topCategory: WasteCategory = 'spoilage';
  let topCategoryCost = -1;
  for (const cat of allWasteCategories) {
    if (categoryStats[cat].cost > topCategoryCost) {
      topCategoryCost = categoryStats[cat].cost;
      topCategory = cat;
    }
  }

  // Fast adjust for count
  const handleQuickAdjust = (ingredientId: string, delta: number) => {
    const ing = ingredients.find((i) => i.id === ingredientId);
    if (!ing) return;
    const current = ing.stockByLocation[activeActionLocationId]?.quantity || 0;
    const newQty = Math.max(0, parseFloat((current + delta).toFixed(2)));
    onUpdateStock(
      ingredientId,
      activeActionLocationId,
      newQty,
      `Quick ${delta > 0 ? '+' : ''}${delta} ${ing.unit} Count`
    );
  };

  // Submit Waste Log & Automatically Deduct from Stock
  const handleSaveWasteLog = (e: React.FormEvent) => {
    e.preventDefault();
    const targetIng = ingredients.find((i) => i.id === wasteIngredientId) || selectedIngredient;
    if (!targetIng) return;

    const loc = locations.find((l) => l.id === wasteLocationId) || activeLocationObj;
    const currentStock = targetIng.stockByLocation[wasteLocationId]?.quantity || 0;
    const newStock = Math.max(0, parseFloat((currentStock - wasteQty).toFixed(2)));
    const unitCost = targetIng.costPerUnit;
    const totalCost = Math.round(wasteQty * unitCost * 100) / 100;
    const catLabel = wasteCategory.replace('_', ' ').toUpperCase();

    // 1. Automatically deduct stock via onUpdateStock
    onUpdateStock(
      targetIng.id,
      loc.id,
      newStock,
      `Food Waste: -${wasteQty} ${targetIng.unit} [${catLabel}] (${wasteReason})`
    );

    // 2. Persist in StorageService waste logs
    const newLog = StorageService.addWasteLog({
      date: new Date().toISOString().slice(0, 10),
      ingredientId: targetIng.id,
      ingredientName: targetIng.name,
      category: targetIng.category,
      locationId: loc.id,
      locationName: loc.name,
      quantity: wasteQty,
      unit: targetIng.unit,
      unitCost,
      totalCost,
      wasteCategory,
      reason: wasteReason,
      notes: wasteNotes,
      loggedBy: currentUser.name,
    });

    // Update local state
    setWasteLogs(StorageService.getWasteLogs());

    // 3. Record in Stock Movements ledger
    StockMovementService.addMovement({
      date: new Date().toISOString().slice(0, 10),
      ingredientId: targetIng.id,
      ingredientName: targetIng.name,
      category: targetIng.category,
      locationId: loc.id,
      locationName: loc.name,
      type: 'outflow',
      flowType: 'waste_spoilage',
      flowLabel: `Waste: ${catLabel}`,
      quantity: wasteQty,
      unit: targetIng.unit,
      unitCost,
      totalValue: totalCost,
      reference: `WST-${loc.code}-${Date.now().toString().slice(-4)}`,
      recordedBy: currentUser.name,
      notes: `${wasteReason}${wasteNotes ? ` • ${wasteNotes}` : ''}`,
    });

    // 4. If offline, enqueue
    if (isOffline) {
      StorageService.enqueueOfflineChange(
        'waste_log',
        `Food waste logged: ${wasteQty} ${targetIng.unit} ${targetIng.name} at ${loc.name}`,
        newLog
      );
    }

    // 5. Success confirmation
    setActionSuccessNotice(
      `Waste Logged: Deducted ${wasteQty} ${targetIng.unit} of ${targetIng.name} (-₱${totalCost.toFixed(
        2
      )}) from ${loc.name} stock.`
    );
    setTimeout(() => setActionSuccessNotice(null), 4000);

    setIsWasteModalOpen(false);
  };

  // Revert / Undo Waste Log Entry
  const handleRevertWasteLog = (log: WasteLogEntry) => {
    if (!window.confirm(`Revert waste entry for ${log.quantity} ${log.unit} ${log.ingredientName} and restore stock to ${log.locationName}?`)) {
      return;
    }

    const ing = ingredients.find((i) => i.id === log.ingredientId);
    if (ing) {
      const current = ing.stockByLocation[log.locationId]?.quantity || 0;
      const restored = parseFloat((current + log.quantity).toFixed(2));
      onUpdateStock(
        log.ingredientId,
        log.locationId,
        restored,
        `Reverted Waste Entry: +${log.quantity} ${log.unit} ${log.ingredientName}`
      );
    }

    StorageService.deleteWasteLog(log.id);
    setWasteLogs(StorageService.getWasteLogs());
    setActionSuccessNotice(`Reverted waste log and restored ${log.quantity} ${log.unit} back to inventory.`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  // Submit Stock Transfer
  const submitStockTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;
    onTransferStock(selectedIngredient.id, transferSourceLoc, transferTargetLoc, transferQty);
    const targetLocName = locations.find((l) => l.id === transferTargetLoc)?.name;
    setActionSuccessNotice(`Transferred ${transferQty} ${selectedIngredient.unit} to ${targetLocName}`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
    setIsTransferModalOpen(false);
    setSelectedIngredient(null);
  };

  // Export Waste Logs to CSV
  const handleExportWasteCSV = () => {
    const rows = filteredWasteLogs.map((log) => ({
      'Log ID': log.id,
      Date: log.date,
      Timestamp: log.timestamp,
      Ingredient: log.ingredientName,
      Category: log.category,
      Location: log.locationName,
      'Waste Classification': log.wasteCategory.toUpperCase(),
      'Quantity Wasted': log.quantity,
      Unit: log.unit,
      'Unit Cost (PHP)': log.unitCost.toFixed(2),
      'Total Financial Loss (PHP)': log.totalCost.toFixed(2),
      'Logged By': log.loggedBy,
      Reason: log.reason,
      Notes: log.notes || '',
    }));

    exportToCSV(`pepais-kitchen-waste-report-${activeLocationObj.code}`, rows);
    setActionSuccessNotice('Waste tracking report downloaded as CSV.');
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  // Helper for category badge visual
  const getCategoryBadge = (cat: WasteCategory) => {
    switch (cat) {
      case 'spoilage':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
            <span>🥬</span> Spoilage
          </span>
        );
      case 'over_prep':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">
            <span>🍲</span> Over-Prep
          </span>
        );
      case 'burnt':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25">
            <Flame className="w-3 h-3 text-rose-500" /> Burnt
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25">
            <Clock className="w-3 h-3 text-purple-500" /> Expired
          </span>
        );
      case 'dropped_damaged':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Dropped / Damaged
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            Other
          </span>
        );
    }
  };

  // Selected ingredient in modal calculation
  const currentModalIngredient = ingredients.find((i) => i.id === wasteIngredientId) || selectedIngredient;
  const currentModalStock = currentModalIngredient?.stockByLocation[wasteLocationId]?.quantity || 0;
  const calculatedModalCost = currentModalIngredient
    ? Math.round(wasteQty * currentModalIngredient.costPerUnit * 100) / 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Switcher */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              Real-Time Kitchen Inventory
            </h1>
            {isOffline && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/30">
                <WifiOff className="w-3 h-3" /> Offline Ledger Active
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Tracking on-hand stock, par thresholds, inter-unit transfers, and kitchen waste logging. Store unit:{' '}
            <strong className="text-neutral-900 dark:text-white">{activeLocationObj.name}</strong>
          </p>
        </div>

        {/* View Mode Buttons & Quick Log CTA */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/60">
            <button
              onClick={() => setActiveTab('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Inventory Table
            </button>
            <button
              onClick={() => setActiveTab('fast_count')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'fast_count'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Tablet Count</span>
            </button>
            <button
              onClick={() => setActiveTab('waste')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'waste'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Waste Tracking</span>
              {locationWasteLogs.length > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activeTab === 'waste'
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {locationWasteLogs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('predictive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeTab === 'predictive'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-purple-600 dark:hover:text-purple-400'
              }`}
              title="Predictive weekly stock usage & PO suggestions based on audit log trends"
            >
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              <span>Predictive Usage &amp; POs</span>
              {reorderAlertCount > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activeTab === 'predictive'
                      ? 'bg-white/20 text-white'
                      : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                  }`}
                >
                  {reorderAlertCount}
                </span>
              )}
            </button>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQRScannerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-sm transition-all active:scale-98"
              title="Scan ingredient QR codes using device camera for rapid inventory stock updates"
            >
              <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Scan QR Code</span>
            </button>

            {/* Quick CTA to Log Food Waste from anywhere */}
            <button
              type="button"
              onClick={() => handleOpenWasteModal()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all active:scale-98"
              title="Log food waste (spoilage, over-prep, burnt) and automatically deduct from stock"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>+ Log Food Waste</span>
            </button>
          </div>
        </div>
      </div>

      {actionSuccessNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
          <button
            onClick={() => setActionSuccessNotice(null)}
            className="text-neutral-400 hover:text-neutral-600 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW MODE: PREDICTIVE STOCK USAGE & PO FORECASTER */}
      {activeTab === 'predictive' && (
        <PredictiveStockManager
          ingredients={ingredients}
          locations={locations}
          selectedLocationId={selectedLocationId}
          activeLocationObj={activeLocationObj}
          auditLogs={effectiveAuditLogs}
          currentUser={currentUser}
          onUpdateStock={onUpdateStock}
          onShowNotice={(msg) => {
            setActionSuccessNotice(msg);
            setTimeout(() => setActionSuccessNotice(null), 4000);
          }}
        />
      )}

      {/* VIEW MODE 1: WASTE TRACKING MODULE */}
      {activeTab === 'waste' && (
        <div className="space-y-6">
          {/* Module Banner & Action Bar */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-6 h-6" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-neutral-900 dark:text-white tracking-tight">
                      Kitchen Food Waste &amp; Shrinkage Tracking
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                      Live Stock Deduction
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Categorize food waste by <strong className="text-neutral-700 dark:text-neutral-300">Spoilage, Over-Prep, Burnt, Expired</strong>, and <strong className="text-neutral-700 dark:text-neutral-300">Dropped</strong>. Logged items automatically deduct from {activeLocationObj.name}'s on-hand inventory.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportWasteCSV}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 transition-colors shadow-xs"
                  title="Export waste ledger to CSV file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenWasteModal()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm active:scale-98"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Log Food Waste</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
              {/* Total Financial Loss */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  Total Financial Loss
                </span>
                <div className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
                  ₱{totalWasteLoss.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 block">
                  {selectedLocationId === 'all' ? 'Across all store units' : `At ${activeLocationObj.code}`}
                </span>
              </div>

              {/* Top Loss Category */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  Primary Loss Cause
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-neutral-900 dark:text-white">
                  <span>{topCategory === 'burnt' ? '🔥' : topCategory === 'over_prep' ? '🍲' : '🥬'}</span>
                  <span className="capitalize">{topCategory.replace('_', ' ')}</span>
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 block">
                  ₱{topCategoryCost.toFixed(2)} ({totalWasteLoss > 0 ? Math.round((topCategoryCost / totalWasteLoss) * 100) : 0}% of waste)
                </span>
              </div>

              {/* Volume Wasted */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  Volume / Units Lost
                </span>
                <div className="mt-1 text-2xl font-black text-neutral-900 dark:text-white">
                  {totalWasteVolume.toFixed(1)} <span className="text-xs text-neutral-400">units/kg</span>
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 block">
                  Cumulative ingredients discarded
                </span>
              </div>

              {/* Logged Incidents */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  Recorded Incidents
                </span>
                <div className="mt-1 text-2xl font-black text-neutral-900 dark:text-white">
                  {locationWasteLogs.length}
                </div>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 block">
                  Staff logs recorded in ledger
                </span>
              </div>
            </div>

            {/* Visual Loss Distribution Meter */}
            {totalWasteLoss > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500">
                  <span>Waste Cost Distribution by Cause:</span>
                  <span>Total: ₱{totalWasteLoss.toFixed(2)}</span>
                </div>
                <div className="h-3 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden flex shadow-inner">
                  {categoryStats.spoilage.cost > 0 && (
                    <div
                      style={{ width: `${(categoryStats.spoilage.cost / totalWasteLoss) * 100}%` }}
                      className="bg-emerald-500 transition-all"
                      title={`Spoilage: ₱${categoryStats.spoilage.cost.toFixed(2)}`}
                    />
                  )}
                  {categoryStats.over_prep.cost > 0 && (
                    <div
                      style={{ width: `${(categoryStats.over_prep.cost / totalWasteLoss) * 100}%` }}
                      className="bg-sky-500 transition-all"
                      title={`Over-Prep: ₱${categoryStats.over_prep.cost.toFixed(2)}`}
                    />
                  )}
                  {categoryStats.burnt.cost > 0 && (
                    <div
                      style={{ width: `${(categoryStats.burnt.cost / totalWasteLoss) * 100}%` }}
                      className="bg-rose-500 transition-all"
                      title={`Burnt: ₱${categoryStats.burnt.cost.toFixed(2)}`}
                    />
                  )}
                  {categoryStats.expired.cost > 0 && (
                    <div
                      style={{ width: `${(categoryStats.expired.cost / totalWasteLoss) * 100}%` }}
                      className="bg-purple-500 transition-all"
                      title={`Expired: ₱${categoryStats.expired.cost.toFixed(2)}`}
                    />
                  )}
                  {categoryStats.dropped_damaged.cost > 0 && (
                    <div
                      style={{ width: `${(categoryStats.dropped_damaged.cost / totalWasteLoss) * 100}%` }}
                      className="bg-amber-500 transition-all"
                      title={`Dropped: ₱${categoryStats.dropped_damaged.cost.toFixed(2)}`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Spoilage (₱{categoryStats.spoilage.cost.toFixed(0)})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> Over-Prep (₱{categoryStats.over_prep.cost.toFixed(0)})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Burnt (₱{categoryStats.burnt.cost.toFixed(0)})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Expired (₱{categoryStats.expired.cost.toFixed(0)})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Dropped (₱{categoryStats.dropped_damaged.cost.toFixed(0)})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Filter Pills & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search waste by ingredient, staff, reason..."
                value={wasteSearchQuery}
                onChange={(e) => setWasteSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-xs"
              />
            </div>

            {/* Waste Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
              {[
                { id: 'all', label: `All (${locationWasteLogs.length})` },
                { id: 'spoilage', label: `🥬 Spoilage (${categoryStats.spoilage.count})` },
                { id: 'over_prep', label: `🍲 Over-Prep (${categoryStats.over_prep.count})` },
                { id: 'burnt', label: `🔥 Burnt (${categoryStats.burnt.count})` },
                { id: 'expired', label: `⏳ Expired (${categoryStats.expired.count})` },
                { id: 'dropped_damaged', label: `💥 Dropped (${categoryStats.dropped_damaged.count})` },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedWasteCategory(item.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedWasteCategory === item.id
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Waste History Ledger Table */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-neutral-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                  Waste Audit Ledger ({filteredWasteLogs.length} entries)
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400">
                Filtered Loss: <strong className="text-rose-600 dark:text-rose-400">₱{filteredWasteLogs.reduce((s, i) => s + i.totalCost, 0).toFixed(2)}</strong>
              </span>
            </div>

            {filteredWasteLogs.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Trash2 className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto stroke-[1.5]" />
                <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  No Waste Records Found
                </h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  {wasteSearchQuery || selectedWasteCategory !== 'all'
                    ? 'No waste logs match your search criteria. Try selecting "All" categories.'
                    : 'No food waste has been logged for this location yet. Click below to record an incident.'}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenWasteModal()}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Food Waste Incident</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[780px]">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold text-[11px]">
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                      <th className="py-2.5 px-3">Ingredient</th>
                      <th className="py-2.5 px-3">Store Unit</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Quantity Wasted</th>
                      <th className="py-2.5 px-3 text-right">Cost Loss</th>
                      <th className="py-2.5 px-3">Staff / Role</th>
                      <th className="py-2.5 px-3">Reason / Corrective Notes</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-medium">
                    {filteredWasteLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                      >
                        <td className="py-3 px-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                          <span className="font-bold text-neutral-900 dark:text-white block">
                            {log.date}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {log.timestamp.slice(11, 19)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-neutral-900 dark:text-white block">
                            {log.ingredientName}
                          </span>
                          <span className="text-[10px] text-neutral-400">{log.category}</span>
                        </td>
                        <td className="py-3 px-3 text-neutral-600 dark:text-neutral-300">
                          {log.locationName}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getCategoryBadge(log.wasteCategory)}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-neutral-900 dark:text-white whitespace-nowrap">
                          -{log.quantity} {log.unit}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className="font-black text-rose-600 dark:text-rose-400 block">
                            -₱{log.totalCost.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            @ ₱{log.unitCost.toFixed(2)}/{log.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                          <span className="font-semibold block">{log.loggedBy}</span>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <span className="font-bold text-neutral-800 dark:text-neutral-200 block">
                            {log.reason}
                          </span>
                          {log.notes && (
                            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block line-clamp-1 italic">
                              "{log.notes}"
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleRevertWasteLog(log)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                            title="Revert log and restore stock to inventory"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: TABLET COUNT (FAST WALK-IN COUNT) */}
      {activeTab === 'fast_count' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Scan className="w-4 h-4 text-sky-500" />
                <span>Kitchen Walk-in Cooler Fast Stocktake</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Large tactile buttons designed for rapid stock counting and quick waste logging on tablets.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsQRScannerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-sm transition-all active:scale-98"
                title="Scan container QR stickers with camera"
              >
                <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Scan Container QR</span>
              </button>
              <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                {activeLocationObj.name}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIngredients.map((ing) => {
              const currentStock = ing.stockByLocation[activeActionLocationId]?.quantity || 0;
              const isBelowPar = currentStock < ing.parLevel;
              const isCritical = currentStock < ing.minThreshold;

              return (
                <div
                  key={ing.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCritical
                      ? 'bg-red-500/5 border-red-500/30'
                      : isBelowPar
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700/60'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                        {ing.name}
                      </h3>
                      <span className="text-[11px] text-neutral-500">
                        Par: {ing.parLevel} {ing.unit} | Min: {ing.minThreshold} {ing.unit}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isCritical
                          ? 'bg-red-500 text-white'
                          : isBelowPar
                          ? 'bg-amber-500 text-neutral-950'
                          : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {isCritical ? 'Critical' : isBelowPar ? 'Low' : 'OK'}
                    </span>
                  </div>

                  {/* Big Number Display */}
                  <div className="my-3 text-center">
                    <span className="text-3xl font-black text-neutral-900 dark:text-white">
                      {currentStock}
                    </span>
                    <span className="text-xs font-bold text-neutral-500 ml-1.5 uppercase">
                      {ing.unit}
                    </span>
                  </div>

                  {/* Tactile adjustment buttons */}
                  <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                    <button
                      onClick={() => handleQuickAdjust(ing.id, -5)}
                      className="py-2 rounded-lg bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 font-bold text-xs"
                    >
                      -5
                    </button>
                    <button
                      onClick={() => handleQuickAdjust(ing.id, -1)}
                      className="py-2 rounded-lg bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 font-bold text-xs"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => handleQuickAdjust(ing.id, 1)}
                      className="py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 font-bold text-xs"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => handleQuickAdjust(ing.id, 5)}
                      className="py-2 rounded-lg bg-amber-500 text-neutral-950 hover:bg-amber-400 font-bold text-xs"
                    >
                      +5
                    </button>
                  </div>

                  {/* Quick Waste Reporting Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenWasteModal(ing)}
                    className="w-full py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                    <span>Report Waste / Spoilage</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: INVENTORY TABLE */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          {/* Search & Category Filter Pills */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ingredients, suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Ingredient</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Unit Cost</th>
                    <th className="py-2.5 px-3 text-center">On-Hand ({activeLocationObj.code})</th>
                    <th className="py-2.5 px-3 text-center">Par Level</th>
                    <th className="py-2.5 px-3 text-right">Stock Value</th>
                    <th className="py-2.5 px-3 text-center">Quick Adjust</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 font-medium">
                  {filteredIngredients.map((ing) => {
                    const stockData = ing.stockByLocation[activeActionLocationId] || {
                      quantity: 0,
                      lastCountDate: '',
                      lastCountBy: '',
                    };
                    const currentStock = stockData.quantity;
                    const isBelowPar = currentStock < ing.parLevel;
                    const isCritical = currentStock < ing.minThreshold;
                    const stockVal = currentStock * ing.costPerUnit;

                    return (
                      <tr
                        key={ing.id}
                        className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors ${
                          isCritical
                            ? 'bg-red-500/5'
                            : isBelowPar
                            ? 'bg-amber-500/5'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <span className="font-bold text-neutral-900 dark:text-white block">
                            {ing.name}
                          </span>
                          <span className="text-[10px] text-neutral-400">{ing.supplier}</span>
                        </td>
                        <td className="py-3 px-3 text-neutral-500 dark:text-neutral-400">
                          {ing.category}
                        </td>
                        <td className="py-3 px-3 font-semibold text-neutral-900 dark:text-white">
                          ₱{ing.costPerUnit.toFixed(2)} / {ing.unit}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`font-black text-sm ${
                              isCritical
                                ? 'text-red-600 dark:text-red-400'
                                : isBelowPar
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-neutral-900 dark:text-white'
                            }`}
                          >
                            {currentStock} {ing.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center text-neutral-400">
                          {ing.parLevel} {ing.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ₱{stockVal.toFixed(2)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickAdjust(ing.id, -5)}
                              className="w-6 h-6 rounded bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 font-bold text-[10px] flex items-center justify-center text-neutral-700 dark:text-neutral-300"
                              title="Deduct 5 units"
                            >
                              -5
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAdjust(ing.id, -1)}
                              className="w-6 h-6 rounded bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 font-bold text-[10px] flex items-center justify-center text-neutral-700 dark:text-neutral-300"
                              title="Deduct 1 unit"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAdjust(ing.id, 1)}
                              className="w-6 h-6 rounded bg-amber-500 hover:bg-amber-400 font-bold text-[10px] flex items-center justify-center text-neutral-950"
                              title="Add 1 unit"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAdjust(ing.id, 5)}
                              className="w-6 h-6 rounded bg-sky-500 hover:bg-sky-400 font-bold text-[10px] flex items-center justify-center text-white"
                              title="Add 5 units"
                            >
                              +5
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCritical
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                : isBelowPar
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isCritical ? 'Critical' : isBelowPar ? 'Low Par' : 'Normal'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setIsQRScannerOpen(true)}
                              className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[11px] transition-colors flex items-center gap-1"
                              title="Scan QR code for rapid stock count"
                            >
                              <QrCode className="w-3 h-3 text-amber-500" />
                              <span>QR</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenWasteModal(ing)}
                              className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] transition-colors flex items-center gap-1"
                              title="Log food waste and deduct stock"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                              <span>Waste</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenTransferModal(ing)}
                              className="px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-[11px] transition-colors flex items-center gap-1"
                              title="Transfer stock to another location"
                            >
                              <ArrowRightLeft className="w-3 h-3 text-sky-500" />
                              <span>Transfer</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Inventory Cards View (< 768px) */}
            <div className="md:hidden space-y-3">
              {filteredIngredients.map((ing) => {
                const stockData = ing.stockByLocation[activeActionLocationId] || {
                  quantity: 0,
                  lastCountDate: '',
                  lastCountBy: '',
                };
                const currentStock = stockData.quantity;
                const isBelowPar = currentStock < ing.parLevel;
                const isCritical = currentStock < ing.minThreshold;
                const stockVal = currentStock * ing.costPerUnit;

                return (
                  <div
                    key={ing.id}
                    className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                      isCritical
                        ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/30'
                        : isBelowPar
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                        : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-neutral-900 dark:text-white text-xs">
                          {ing.name}
                        </h4>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {ing.supplier} • {ing.category}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                          isCritical
                            ? 'bg-red-500 text-white'
                            : isBelowPar
                            ? 'bg-amber-500 text-neutral-950 font-bold'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {isCritical ? 'Critical' : isBelowPar ? 'Low Par' : 'Normal'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                          On-Hand ({activeLocationObj.code})
                        </span>
                        <span className="text-base font-black text-neutral-900 dark:text-white">
                          {currentStock} {ing.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                          Value &amp; Par
                        </span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                          ₱{stockVal.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          Par: {ing.parLevel} {ing.unit}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-700/60">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(ing.id, -1)}
                          className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700 font-bold text-xs flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-xs touch-manipulation"
                          title="Deduct 1 unit"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(ing.id, 1)}
                          className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 font-bold text-xs flex items-center justify-center text-neutral-950 shadow-sm touch-manipulation"
                          title="Add 1 unit"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(ing.id, 5)}
                          className="w-8 h-8 rounded-lg bg-sky-500 hover:bg-sky-400 font-bold text-xs flex items-center justify-center text-white shadow-sm touch-manipulation"
                          title="Add 5 units"
                        >
                          +5
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsQRScannerOpen(true)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[11px] transition-colors flex items-center gap-1"
                          title="Scan QR code for rapid stock count"
                        >
                          <QrCode className="w-3 h-3 text-amber-500" />
                          <span>QR</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenWasteModal(ing)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-[11px] transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Waste</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTransferModal(ing)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-[11px] transition-colors flex items-center gap-1"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-sky-500" />
                          <span>Transfer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED FOOD WASTE LOGGING MODAL */}
      {isWasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg p-5 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                    Log Kitchen Food Waste
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Item will automatically deduct from store on-hand inventory
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWasteModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-sm font-bold p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWasteLog} className="space-y-4">
              {/* Store Location Selection */}
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Store Unit
                </label>
                <select
                  value={wasteLocationId}
                  onChange={(e) => setWasteLocationId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ingredient Selection */}
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Select Ingredient
                </label>
                <select
                  value={wasteIngredientId}
                  onChange={(e) => {
                    setWasteIngredientId(e.target.value);
                    const selected = ingredients.find((i) => i.id === e.target.value);
                    if (selected) setSelectedIngredient(selected);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                >
                  {ingredients.map((ing) => {
                    const onHand = ing.stockByLocation[wasteLocationId]?.quantity || 0;
                    return (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.category}) — On-Hand: {onHand} {ing.unit}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Waste Categorization Tiles */}
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1.5">
                  Waste Categorization Cause <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'spoilage',
                      label: 'Spoilage',
                      icon: '🥬',
                      desc: 'Temp failure, mold, souring',
                    },
                    {
                      id: 'over_prep',
                      label: 'Over-Prep',
                      icon: '🍲',
                      desc: 'Excess prepped, unsold batches',
                    },
                    {
                      id: 'burnt',
                      label: 'Burnt',
                      icon: '🔥',
                      desc: 'Overcooked, scorched on line',
                    },
                    {
                      id: 'expired',
                      label: 'Expired',
                      icon: '⏳',
                      desc: 'Past shelf life / FIFO date',
                    },
                    {
                      id: 'dropped_damaged',
                      label: 'Dropped',
                      icon: '💥',
                      desc: 'Spilled, dropped on floor',
                    },
                    {
                      id: 'other',
                      label: 'Other Waste',
                      icon: '📦',
                      desc: 'Quality standard rejection',
                    },
                  ].map((tile) => (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => {
                        setWasteCategory(tile.id as WasteCategory);
                        const presets = getPresetReasonsForCategory(tile.id as WasteCategory);
                        setWasteReason(presets[0]);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        wasteCategory === tile.id
                          ? 'bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-200 ring-2 ring-rose-500/20'
                          : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <span>{tile.icon}</span>
                        <span>{tile.label}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block mt-0.5 line-clamp-1">
                        {tile.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Wasted & Cost Impact Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60">
                <div>
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                    Quantity Discarded ({currentModalIngredient?.unit || 'unit'})
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      value={wasteQty}
                      onChange={(e) => setWasteQty(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-sm font-black rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                      required
                    />
                    <span className="text-xs font-bold text-neutral-400 uppercase">
                      {currentModalIngredient?.unit}
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-1 block">
                    Current on-hand: <strong>{currentModalStock} {currentModalIngredient?.unit}</strong>
                  </span>
                </div>

                <div className="flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                    Estimated Cost Loss
                  </span>
                  <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                    -₱{calculatedModalCost.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    Calculated @ ₱{currentModalIngredient?.costPerUnit.toFixed(2)} / {currentModalIngredient?.unit}
                  </span>
                </div>
              </div>

              {/* Warning if wasteQty > currentStock */}
              {wasteQty > currentModalStock && (
                <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    Warning: Waste quantity ({wasteQty}) exceeds on-hand stock ({currentModalStock}). Stock will be set to 0.
                  </span>
                </div>
              )}

              {/* Incident Reason Selection */}
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Specific Incident Reason
                </label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                >
                  {getPresetReasonsForCategory(wasteCategory).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="Custom Incident">Other / Custom Reason...</option>
                </select>
              </div>

              {/* Notes / Corrective Actions */}
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Incident Details &amp; Corrective Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={wasteNotes}
                  onChange={(e) => setWasteNotes(e.target.value)}
                  placeholder="e.g. Walk-in refrigeration drawer gasket loose; line cook fired order during dinner rush; prepped extra batch for rainy forecast..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400"
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsWasteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center gap-1.5 transition-all active:scale-98"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Deduct from Stock &amp; Log Waste</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK TRANSFER MODAL */}
      {isTransferModalOpen && selectedIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Inter-Location Stock Transfer
                </h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitStockTransfer} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Ingredient
                </label>
                <div className="mt-1 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white">
                  {selectedIngredient.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                    Source Unit
                  </label>
                  <div className="mt-1 p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold truncate">
                    {locations.find((l) => l.id === transferSourceLoc)?.name || activeLocationObj.name}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                    Destination Unit
                  </label>
                  <select
                    value={transferTargetLoc}
                    onChange={(e) => setTransferTargetLoc(e.target.value)}
                    className="mt-1 w-full p-2 text-xs font-semibold rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 truncate"
                  >
                    {locations
                      .filter((l) => l.id !== transferSourceLoc)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Quantity to Transfer ({selectedIngredient.unit})
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={selectedIngredient.stockByLocation[transferSourceLoc]?.quantity || 9999}
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full px-3 py-2 text-xs font-bold rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                  required
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ingredient QR Code Camera Scanner Modal */}
      <IngredientQRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        ingredients={ingredients}
        locations={locations}
        activeLocationId={activeActionLocationId}
        currentUser={currentUser}
        onUpdateStock={onUpdateStock}
        onShowNotice={(msg) => {
          setActionSuccessNotice(msg);
          setTimeout(() => setActionSuccessNotice(null), 4000);
        }}
      />
    </div>
  );
};
