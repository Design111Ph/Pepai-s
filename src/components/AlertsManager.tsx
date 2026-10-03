import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Smartphone,
  Send,
  FileCheck,
  CheckCircle2,
  Mail,
  Truck,
  DollarSign,
  Package,
  Plus,
} from 'lucide-react';
import { InventoryAlert, Ingredient, Location, AppSettings } from '../types';

interface AlertsManagerProps {
  alerts: InventoryAlert[];
  ingredients: Ingredient[];
  locations: Location[];
  selectedLocationId: string;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onMarkAlertOrdered: (alertId: string) => void;
  onSendMobilePushSimulation: (title: string, body: string) => void;
  onGeneratePO: (supplierName: string, items: { ingredientName: string; orderQty: number; unitCost: number; unit: string }[]) => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  alerts,
  ingredients,
  locations,
  selectedLocationId,
  settings,
  onUpdateSettings,
  onMarkAlertOrdered,
  onSendMobilePushSimulation,
  onGeneratePO,
}) => {
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState<string>('All');
  const [showPOModal, setShowPOModal] = useState<boolean>(false);
  const [generatedPODetails, setGeneratedPODetails] = useState<any>(null);
  const [pushSentToast, setPushSentToast] = useState<string | null>(null);

  const filteredAlerts = alerts.filter((a) => {
    if (selectedLocationId !== 'all' && a.locationId !== selectedLocationId) {
      return false;
    }
    return true;
  });

  const criticalAlerts = filteredAlerts.filter((a) => a.severity === 'critical' && a.status === 'open');
  const warningAlerts = filteredAlerts.filter((a) => a.severity === 'warning' && a.status === 'open');

  const handleTestPush = () => {
    const alert = criticalAlerts[0] || warningAlerts[0];
    const itemMsg = alert
      ? `CRITICAL: ${alert.ingredientName} at ${alert.locationName} has dropped to ${alert.currentStock} ${alert.unit}!`
      : "Pepai's Kitchen Alert: All stock levels currently above par.";
    
    onSendMobilePushSimulation("🚨 Pepai's Kitchen Stock Alert", itemMsg);
    setPushSentToast("Push notification dispatched to authorized staff mobile devices!");
    setTimeout(() => setPushSentToast(null), 4000);
  };

  const handleCreatePO = () => {
    const openAlerts = filteredAlerts.filter((a) => a.status === 'open');
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));

    const poItems = openAlerts.map((a) => {
      const ing = ingMap.get(a.ingredientId);
      const deficit = Math.max(1, a.parLevel - a.currentStock);
      return {
        ingredientId: a.ingredientId,
        ingredientName: a.ingredientName,
        supplier: ing?.supplier || 'Direct Supplier',
        supplierEmail: ing?.supplierEmail || 'orders@supplier.com',
        orderQty: Math.ceil(deficit),
        unit: a.unit,
        unitCost: ing?.costPerUnit || 0,
        totalCost: Math.ceil(deficit) * (ing?.costPerUnit || 0),
        alertId: a.id,
      };
    });

    const supplierGroups: Record<string, typeof poItems> = {};
    poItems.forEach((item) => {
      if (!supplierGroups[item.supplier]) supplierGroups[item.supplier] = [];
      supplierGroups[item.supplier].push(item);
    });

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    setGeneratedPODetails({
      poNumber,
      date: new Date().toLocaleDateString(),
      groups: supplierGroups,
      totalCost: poItems.reduce((sum, item) => sum + item.totalCost, 0),
      rawItems: poItems,
    });
    setShowPOModal(true);
  };

  const confirmDispatchPO = () => {
    if (generatedPODetails) {
      generatedPODetails.rawItems.forEach((item: any) => {
        onMarkAlertOrdered(item.alertId);
      });
      setShowPOModal(false);
      setPushSentToast(`Purchase Order ${generatedPODetails.poNumber} dispatched to suppliers via email.`);
      setTimeout(() => setPushSentToast(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              Real-Time Stock Alerts &amp; Replenishment
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Automated alerts for stock falling below par or critical safety thresholds across kitchen coolers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Push notification test trigger */}
          <button
            onClick={handleTestPush}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
            title="Simulate push notification to chef/manager mobile phones"
          >
            <Smartphone className="w-3.5 h-3.5 text-sky-500" />
            <span>Test Mobile Push</span>
          </button>

          {/* Quick PO Button */}
          <button
            onClick={handleCreatePO}
            disabled={criticalAlerts.length === 0 && warningAlerts.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors disabled:opacity-50 shadow-sm"
          >
            <Package className="w-3.5 h-3.5" />
            <span>Generate Replenishment PO</span>
          </button>
        </div>
      </div>

      {pushSentToast && (
        <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center gap-2 animate-bounce">
          <Smartphone className="w-4 h-4 text-sky-500" />
          <span>{pushSentToast}</span>
        </div>
      )}

      {/* Alert Status Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Critical Alerts Card */}
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              Critical Stockouts ({criticalAlerts.length})
            </span>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-red-500 text-white">
              Immediate Action
            </span>
          </div>
          <p className="text-xs text-red-900/80 dark:text-red-300/80 mt-1">
            Ingredients below minimum threshold. Risk of 86-ing menu items during shift.
          </p>
        </div>

        {/* Warning Alerts Card */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Low Par Warnings ({warningAlerts.length})
            </span>
            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500 text-neutral-950">
              Replenish Soon
            </span>
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-1">
            Ingredients below par. Scheduled for next supplier delivery cycle.
          </p>
        </div>
      </div>

      {/* Alerts Table & Mobile Cards */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Ingredient</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Current Stock</th>
                <th className="py-2.5 px-3">Par Level</th>
                <th className="py-2.5 px-3">Replenish Deficit</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-neutral-500">
                    🎉 Excellent! All inventory levels are above safety par thresholds.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => {
                  const deficit = Math.max(0, alert.parLevel - alert.currentStock);

                  return (
                    <tr key={alert.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            alert.severity === 'critical'
                              ? 'bg-red-500 text-white animate-pulse'
                              : 'bg-amber-500 text-neutral-950'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-neutral-900 dark:text-white">
                        {alert.ingredientName}
                      </td>
                      <td className="py-3 px-3 text-neutral-600 dark:text-neutral-400">
                        {alert.locationName}
                      </td>
                      <td className="py-3 px-3 font-black text-neutral-900 dark:text-white">
                        {alert.currentStock} {alert.unit}
                      </td>
                      <td className="py-3 px-3 text-neutral-500">
                        {alert.parLevel} {alert.unit} (Min: {alert.minThreshold})
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400">
                        +{deficit.toFixed(1)} {alert.unit} needed
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            alert.status === 'ordered'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          {alert.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {alert.status === 'open' ? (
                          <button
                            onClick={() => onMarkAlertOrdered(alert.id)}
                            className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold text-[11px] transition-colors"
                          >
                            Mark Ordered
                          </button>
                        ) : (
                          <span className="text-[11px] text-neutral-400">PO Sent</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Alert Cards View (< 768px) */}
        <div className="md:hidden space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              🎉 Excellent! All inventory levels are above safety par thresholds.
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const deficit = Math.max(0, alert.parLevel - alert.currentStock);

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                    alert.severity === 'critical'
                      ? 'bg-red-500/5 dark:bg-red-500/10 border-red-500/30'
                      : 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase mb-1.5 ${
                          alert.severity === 'critical'
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-500 text-neutral-950 font-bold'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <h4 className="font-bold text-neutral-900 dark:text-white text-xs">
                        {alert.ingredientName}
                      </h4>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {alert.locationName}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-neutral-900 dark:text-white block">
                        {alert.currentStock} {alert.unit}
                      </span>
                      <span className="text-[10px] text-neutral-400">Current Stock</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-white/70 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800">
                    <div>
                      <span className="text-[10px] text-neutral-400 block uppercase font-bold">
                        Target Par Level
                      </span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {alert.parLevel} {alert.unit} (Min: {alert.minThreshold})
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block uppercase font-bold">
                        Order Deficit
                      </span>
                      <span className="font-black text-amber-600 dark:text-amber-400">
                        +{deficit.toFixed(1)} {alert.unit}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        alert.status === 'ordered'
                          ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {alert.status === 'ordered' ? 'PO Dispatched' : 'Pending Order'}
                    </span>

                    {alert.status === 'open' ? (
                      <button
                        type="button"
                        onClick={() => onMarkAlertOrdered(alert.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-colors shadow-sm min-h-[38px] flex items-center gap-1.5 touch-manipulation"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Mark Ordered</span>
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400 font-medium">Order Placed</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* PO Generator Modal */}
      {showPOModal && generatedPODetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">
                  Official Restock Order
                </span>
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  Purchase Order #{generatedPODetails.poNumber}
                </h3>
              </div>
              <button
                onClick={() => setShowPOModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {Object.entries(generatedPODetails.groups).map(([supplier, items]: [string, any]) => (
                <div key={supplier} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
                  <div className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-700">
                    <span className="font-bold text-xs text-neutral-900 dark:text-white">{supplier}</span>
                    <span className="text-[11px] text-neutral-400">{items[0]?.supplierEmail}</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {items.map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span>{it.ingredientName} ({it.orderQty} {it.unit})</span>
                        <span className="font-bold">₱{it.totalCost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-neutral-500">Estimated Total Order Cost:</span>
                <div className="text-lg font-black text-neutral-900 dark:text-white">
                  ₱{generatedPODetails.totalCost.toFixed(2)}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPOModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDispatchPO}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send PO via Email &amp; Push</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
