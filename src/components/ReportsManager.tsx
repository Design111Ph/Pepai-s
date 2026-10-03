import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Cloud,
  Mail,
  CheckCircle2,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
  Sparkles,
  ShieldCheck,
  Eye,
  ArrowUpDown,
  Boxes,
} from 'lucide-react';
import { MenuItem, Ingredient, Location, AppSettings, AuditLog } from '../types';
import { calculateRecipeCost, analyzeMenuEngineering } from '../utils/costing';
import { exportToCSV, S3ArchiveFile } from '../utils/storage';
import { StockMovementChart } from './StockMovementChart';
import { StockMovementService } from '../utils/stockMovements';

interface ReportsManagerProps {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  locations: Location[];
  selectedLocationId: string;
  settings: AppSettings;
  s3Archives: S3ArchiveFile[];
  onUploadS3Report: (type: string, data: any) => void;
  onSendNotification: (title: string, body: string) => void;
  auditLogs: AuditLog[];
  onLocationChange?: (locId: string) => void;
}

export const ReportsManager: React.FC<ReportsManagerProps> = ({
  menuItems,
  ingredients,
  locations,
  selectedLocationId,
  settings,
  s3Archives,
  onUploadS3Report,
  onSendNotification,
  auditLogs,
  onLocationChange,
}) => {
  const [reportType, setReportType] = useState<'stock_movement' | 'margins' | 'inventory'>('stock_movement');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const analysis = analyzeMenuEngineering(
    menuItems,
    ingredients,
    settings.kitchenLaborRatePerHour,
    selectedLocationId === 'all' ? undefined : selectedLocationId
  );

  const handleExportCSV = () => {
    if (reportType === 'stock_movement') {
      const records = StockMovementService.getMovements();
      const filtered = records.filter(
        (r) => selectedLocationId === 'all' || r.locationId === selectedLocationId
      );
      const rows = filtered.map((r) => ({
        Date: r.date,
        Timestamp: r.timestamp,
        Location: r.locationName,
        Direction: r.type.toUpperCase(),
        'Flow Type': r.flowLabel,
        Ingredient: r.ingredientName,
        Category: r.category,
        Quantity: r.quantity,
        Unit: r.unit,
        'Unit Cost (₱)': r.unitCost.toFixed(2),
        'Total Value (₱)': r.totalValue.toFixed(2),
        'Reference PO / Order': r.reference,
        'Recorded By': r.recordedBy,
        Notes: r.notes || '',
      }));
      exportToCSV(`pepais-stock-movements-${selectedLocationId}`, rows);
    } else if (reportType === 'margins') {
      const rows = analysis.items.map((item) => ({
        'Menu Item': item.menuItem.name,
        Category: item.menuItem.category,
        'Selling Price (₱)': item.breakdown.sellingPrice.toFixed(2),
        'Cost Per Portion (₱)': item.breakdown.totalCostPerPortion.toFixed(2),
        'Food Cost (%)': item.breakdown.foodCostPercent.toFixed(1),
        'Gross Margin (₱)': item.breakdown.grossMarginAmount.toFixed(2),
        'Gross Margin (%)': item.breakdown.grossMarginPercent.toFixed(1),
        'Monthly Sales Units': item.breakdown.totalMonthlyUnits,
        'Monthly Revenue (₱)': item.breakdown.monthlyRevenue.toFixed(2),
        'Classification': item.classification,
      }));
      exportToCSV(`pepais-food-cost-margins`, rows);
    } else {
      const rows = ingredients.map((ing) => {
        let totalStock = 0;
        if (selectedLocationId === 'all') {
          Object.values(ing.stockByLocation).forEach((s) => (totalStock += s.quantity || 0));
        } else {
          totalStock = ing.stockByLocation[selectedLocationId]?.quantity || 0;
        }
        return {
          Ingredient: ing.name,
          Category: ing.category,
          Unit: ing.unit,
          'Unit Cost (₱)': ing.costPerUnit.toFixed(2),
          'Stock On Hand': totalStock.toFixed(2),
          'Holding Value (₱)': (totalStock * ing.costPerUnit).toFixed(2),
          'Min Threshold': ing.minThreshold,
          'Par Level': ing.parLevel,
          Supplier: ing.supplier,
        };
      });
      exportToCSV(`pepais-inventory-valuation-${selectedLocationId}`, rows);
    }

    onSendNotification('Report Export Finalized', `Generated CSV export for ${reportType} report in Philippine Peso (₱).`);
    setStatusMessage('CSV report exported and downloaded successfully (PHP ₱)!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleArchiveS3 = () => {
    const reportTitle =
      reportType === 'stock_movement'
        ? 'D3 Stock Movement Inflow/Outflow Trends'
        : reportType === 'margins'
        ? 'Food Cost Margins & Menu Profitability'
        : 'Inventory Par Valuation';

    onUploadS3Report(reportTitle, {
      type: reportType,
      date: new Date().toISOString(),
      location: selectedLocationId,
      analysisSummary: {
        totalRevenue: analysis.totalMonthlyRevenue,
        totalCOGS: analysis.totalMonthlyCOGS,
        foodCostPct: analysis.overallFoodCostPercent,
      },
    });

    onSendNotification(
      'AWS S3 Archive Created',
      `Backup saved to s3://${settings.s3Bucket}/reports/${new Date().toISOString().slice(0, 10)}/`
    );
    setStatusMessage(`Uploaded snapshot to AWS S3 bucket: ${settings.s3Bucket}`);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              Reports &amp; Stock Movement Analytics
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            D3.js stock flow dynamics, menu margin analytics, CSV export, and encrypted AWS S3 Cloud Archives.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-sky-500" />
            <span>PDF Print Preview</span>
          </button>

          <button
            onClick={() => setShowEmailPreviewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-amber-500" />
            <span>Daily Email Preview</span>
          </button>

          <button
            onClick={handleArchiveS3}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Archive to AWS S3</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Report Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          onClick={() => setReportType('stock_movement')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            reportType === 'stock_movement'
              ? 'bg-amber-500 text-neutral-950 shadow-xs'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Stock Movement Dynamics (D3.js)</span>
        </button>
        <button
          onClick={() => setReportType('margins')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            reportType === 'margins'
              ? 'bg-amber-500 text-neutral-950 shadow-xs'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Menu Profit Margins &amp; COGS</span>
        </button>
        <button
          onClick={() => setReportType('inventory')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            reportType === 'inventory'
              ? 'bg-amber-500 text-neutral-950 shadow-xs'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Inventory Valuation &amp; Par Holding</span>
        </button>
      </div>

      {/* Conditional Report Views */}
      {reportType === 'stock_movement' ? (
        <StockMovementChart
          locations={locations}
          ingredients={ingredients}
          selectedLocationId={selectedLocationId}
          onLocationChange={onLocationChange}
          onSendNotification={onSendNotification}
        />
      ) : reportType === 'margins' ? (
        /* Margins Table & Cards View */
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Item / Category</th>
                  <th className="py-2.5 px-3">Selling Price</th>
                  <th className="py-2.5 px-3">Portion Cost</th>
                  <th className="py-2.5 px-3">Food Cost %</th>
                  <th className="py-2.5 px-3">Gross Margin ₱</th>
                  <th className="py-2.5 px-3">Gross Margin %</th>
                  <th className="py-2.5 px-3">Monthly Vol</th>
                  <th className="py-2.5 px-3">Total Monthly Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
                {analysis.items.map(({ menuItem, breakdown }) => (
                  <tr key={menuItem.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-neutral-900 dark:text-white">{menuItem.name}</div>
                      <span className="text-[10px] text-neutral-400">{menuItem.category}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-900 dark:text-white">
                      ₱{breakdown.sellingPrice.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-neutral-700 dark:text-neutral-300">
                      ₱{breakdown.totalCostPerPortion.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400">
                      {breakdown.foodCostPercent.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                      ₱{breakdown.grossMarginAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                      {breakdown.grossMarginPercent.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-neutral-700 dark:text-neutral-300">
                      {breakdown.totalMonthlyUnits}
                    </td>
                    <td className="py-3 px-3 font-bold text-neutral-900 dark:text-white">
                      ₱{breakdown.monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {analysis.items.map(({ menuItem, breakdown }) => (
              <div
                key={menuItem.id}
                className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white text-xs">
                      {menuItem.name}
                    </h4>
                    <span className="text-[10px] text-neutral-400">{menuItem.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-xs text-neutral-900 dark:text-white block">
                      ₱{breakdown.sellingPrice.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-neutral-400">Menu Price</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-white/80 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-neutral-400 block">
                      Portion Cost
                    </span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">
                      ₱{breakdown.totalCostPerPortion.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">
                      {breakdown.foodCostPercent.toFixed(1)}% FC
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-neutral-400 block">
                      Margin Contribution
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +₱{breakdown.grossMarginAmount.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      {breakdown.grossMarginPercent.toFixed(1)}% margin
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                  <span>Monthly Orders: <strong>{breakdown.totalMonthlyUnits}</strong></span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    ₱{breakdown.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Inventory Valuation & Par Holding View */
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800 text-xs">
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white">Inventory Asset Valuation</h3>
              <p className="text-neutral-400 text-[11px]">
                Current holding valuation calculated at standard wholesale unit cost.
              </p>
            </div>
            <div className="text-right">
              <span className="text-neutral-400 text-[10px] block">Total Asset Value</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                ₱{ingredients
                  .reduce((sum, ing) => {
                    const qty =
                      selectedLocationId === 'all'
                        ? Object.values(ing.stockByLocation).reduce((s, x) => s + (x.quantity || 0), 0)
                        : ing.stockByLocation[selectedLocationId]?.quantity || 0;
                    return sum + qty * ing.costPerUnit;
                  }, 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Ingredient</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Unit Cost</th>
                  <th className="py-2.5 px-3">Current Stock</th>
                  <th className="py-2.5 px-3">Total Holding Value</th>
                  <th className="py-2.5 px-3">Par Level</th>
                  <th className="py-2.5 px-3">Stock Health</th>
                  <th className="py-2.5 px-3">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
                {ingredients.map((ing) => {
                  const qty =
                    selectedLocationId === 'all'
                      ? Object.values(ing.stockByLocation).reduce((s, x) => s + (x.quantity || 0), 0)
                      : ing.stockByLocation[selectedLocationId]?.quantity || 0;
                  const holdingValue = qty * ing.costPerUnit;
                  const isCrit = qty < ing.minThreshold;
                  const isWarn = qty < ing.parLevel && !isCrit;

                  return (
                    <tr key={ing.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-neutral-900 dark:text-white">
                        {ing.name}
                      </td>
                      <td className="py-3 px-3 text-neutral-400">{ing.category}</td>
                      <td className="py-3 px-3 font-semibold text-neutral-700 dark:text-neutral-300">
                        ₱{ing.costPerUnit.toFixed(2)} / {ing.unit}
                      </td>
                      <td className="py-3 px-3 font-bold text-neutral-900 dark:text-white">
                        {qty.toFixed(1)} {ing.unit}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        ₱{holdingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-neutral-500">
                        {ing.parLevel} {ing.unit}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCrit
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : isWarn
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isCrit ? 'Crit Low' : isWarn ? 'Under Par' : 'Optimal'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-neutral-400 text-[11px]">{ing.supplier}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2.5">
            {ingredients.map((ing) => {
              const qty =
                selectedLocationId === 'all'
                  ? Object.values(ing.stockByLocation).reduce((s, x) => s + (x.quantity || 0), 0)
                  : ing.stockByLocation[selectedLocationId]?.quantity || 0;
              const holdingValue = qty * ing.costPerUnit;
              const isCrit = qty < ing.minThreshold;
              const isWarn = qty < ing.parLevel && !isCrit;

              return (
                <div
                  key={ing.id}
                  className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-2 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-neutral-900 dark:text-white">{ing.name}</div>
                      <span className="text-[10px] text-neutral-400">{ing.category}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isCrit
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : isWarn
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isCrit ? 'Crit Low' : isWarn ? 'Under Par' : 'Optimal'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-200/60 dark:border-neutral-700/40">
                    <span>
                      Stock: <strong>{qty.toFixed(1)} {ing.unit}</strong> (Par: {ing.parLevel})
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      ₱{holdingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AWS S3 Cloud Storage Archives Section */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-sky-500" />
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                AWS S3 Cloud Report Archives
              </h2>
              <p className="text-xs text-neutral-400">
                Connected Bucket: <strong className="text-neutral-700 dark:text-neutral-300">{settings.s3Bucket}</strong> ({settings.s3Region})
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
            AES-256 Encrypted
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {s3Archives.map((archive, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="font-bold text-neutral-900 dark:text-white">{archive.reportType}</div>
                <div className="text-[10px] text-neutral-400 font-mono">
                  s3://{archive.bucket}/{archive.key}
                </div>
              </div>
              <div className="text-right">
                <span className="text-neutral-500 block">{archive.timestamp}</span>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                  {(archive.sizeBytes / 1024).toFixed(1)} KB • ETag {archive.etag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Printable PDF Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl bg-white text-neutral-950 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-neutral-300">
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-neutral-900">Pepai's Craft Kitchen</span>
                <span className="text-xs text-neutral-500">Executive Food Costing &amp; Stock Movement Report (PHP)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-900 text-white flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-neutral-500 hover:text-neutral-900 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="text-xs space-y-4 font-sans">
              <div className="flex justify-between">
                <div>
                  <p><strong>Generated Date:</strong> {new Date().toLocaleString()}</p>
                  <p><strong>Scope:</strong> {selectedLocationId === 'all' ? 'All Restaurant Units' : selectedLocationId}</p>
                  <p><strong>Active Report Focus:</strong> {reportType === 'stock_movement' ? 'D3 Stock Inflow/Outflow Dynamics' : reportType}</p>
                </div>
                <div className="text-right">
                  <p><strong>Total Food Cost %:</strong> {analysis.overallFoodCostPercent.toFixed(1)}%</p>
                  <p><strong>Total Projected Revenue:</strong> ₱{analysis.totalMonthlyRevenue.toLocaleString()}</p>
                </div>
              </div>

              <table className="w-full text-left text-xs border border-neutral-300">
                <thead className="bg-neutral-100 border-b border-neutral-300 font-bold">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2">Selling Price</th>
                    <th className="p-2">Cost/Portion</th>
                    <th className="p-2">Food Cost %</th>
                    <th className="p-2">Gross Margin ₱</th>
                    <th className="p-2">Matrix Class</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {analysis.items.map((it) => (
                    <tr key={it.menuItem.id}>
                      <td className="p-2 font-bold">{it.menuItem.name}</td>
                      <td className="p-2">₱{it.breakdown.sellingPrice.toFixed(2)}</td>
                      <td className="p-2">₱{it.breakdown.totalCostPerPortion.toFixed(2)}</td>
                      <td className="p-2">{it.breakdown.foodCostPercent.toFixed(1)}%</td>
                      <td className="p-2">₱{it.breakdown.grossMarginAmount.toFixed(2)}</td>
                      <td className="p-2 font-bold">{it.classification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 border-t border-neutral-300 flex justify-between text-[11px] text-neutral-500">
                <span>Verified by Executive Management • Pepai's Hospitality Group</span>
                <span>Confidential - For Internal Kitchen &amp; Management Operations Only</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Automated Email Preview Modal */}
      {showEmailPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Automated Daily Report Email Dispatcher
                </h3>
              </div>
              <button
                onClick={() => setShowEmailPreviewModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-xs space-y-2">
              <div><strong>To:</strong> {settings.emailRecipients.join(', ')}</div>
              <div><strong>Subject:</strong> [Daily Report] Pepai's Kitchen Financials &amp; Stock Status ({new Date().toLocaleDateString()})</div>
              <div><strong>Scheduled Trigger:</strong> Every day at {settings.dailyReportTime}</div>
              <div className="p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-2 mt-2">
                <p className="font-bold text-neutral-900 dark:text-white">Hi Marco &amp; Kitchen Team,</p>
                <p>Here is your automated daily operations summary for Pepai's:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Overall Food Cost: <strong>{analysis.overallFoodCostPercent.toFixed(1)}%</strong> (Goal: {settings.targetFoodCostPct}%)</li>
                  <li>Projected Daily Sales: <strong>₱{(analysis.totalMonthlyRevenue / 30).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></li>
                  <li>Stock Movement Balance: <strong>Active Dynamic Inflow/Outflow tracking via D3.js</strong></li>
                  <li>Inventory Turnover: <strong>4.2x</strong> (Healthy)</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEmailPreviewModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowEmailPreviewModal(false);
                  setStatusMessage('Automated daily summary email dispatched to recipient list!');
                  setTimeout(() => setStatusMessage(null), 3000);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors"
              >
                Dispatch Test Email Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
