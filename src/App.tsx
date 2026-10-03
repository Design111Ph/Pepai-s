/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Navigation, ActiveTab } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { FoodCostCalculator } from './components/FoodCostCalculator';
import { InventoryManager } from './components/InventoryManager';
import { AlertsManager } from './components/AlertsManager';
import { ReportsManager } from './components/ReportsManager';
import { CustomerFeedbackModule } from './components/CustomerFeedback';
import { SecurityAndAudit } from './components/SecurityAndAudit';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { LocationsManagerModal } from './components/LocationsManagerModal';

import {
  Ingredient,
  MenuItem,
  Location,
  InventoryAlert,
  AuditLog,
  CustomerFeedback,
  AppSettings,
  OfflineQueueItem,
  User,
} from './types';
import { StorageService, S3ArchiveFile } from './utils/storage';
import { StockMovementService } from './utils/stockMovements';

export default function App() {
  // Core application state loaded from local storage or seeded defaults
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => StorageService.getIngredients());
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => StorageService.getMenuItems());
  const [locations, setLocations] = useState<Location[]>(() => StorageService.getLocations());
  const [feedbackList, setFeedbackList] = useState<CustomerFeedback[]>(() => StorageService.getFeedback());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => StorageService.getAuditLogs());
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [currentUser, setCurrentUser] = useState<User>(() => StorageService.getActiveUser());
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => StorageService.getOfflineQueue());
  const [s3Archives, setS3Archives] = useState<S3ArchiveFile[]>(() => StorageService.getS3Archives());

  // UI States
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedCostingItemId, setSelectedCostingItemId] = useState<string>(menuItems[0]?.id || 'menu-01');
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isSyncingS3, setIsSyncingS3] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showLocationsModal, setShowLocationsModal] = useState<boolean>(false);
  const [toast, setToast] = useState<{ title: string; body: string; type?: 'info' | 'alert' | 'success' } | null>(null);

  // Sync dark mode class on root HTML element
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Compute dynamic inventory alerts from ingredients & locations
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);

  useEffect(() => {
    const generatedAlerts: InventoryAlert[] = [];
    const locMap = new Map(locations.map((l) => [l.id, l]));

    ingredients.forEach((ing) => {
      Object.entries(ing.stockByLocation).forEach(([locId, stockData]) => {
        const qty = stockData.quantity || 0;
        const loc = locMap.get(locId);
        const locName = loc ? loc.name : locId;

        if (qty < ing.minThreshold) {
          generatedAlerts.push({
            id: `alert-crit-${ing.id}-${locId}`,
            ingredientId: ing.id,
            ingredientName: ing.name,
            locationId: locId,
            locationName: locName,
            currentStock: qty,
            minThreshold: ing.minThreshold,
            parLevel: ing.parLevel,
            unit: ing.unit,
            severity: 'critical',
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
            status: 'open',
          });
        } else if (qty < ing.parLevel) {
          generatedAlerts.push({
            id: `alert-warn-${ing.id}-${locId}`,
            ingredientId: ing.id,
            ingredientName: ing.name,
            locationId: locId,
            locationName: locName,
            currentStock: qty,
            minThreshold: ing.minThreshold,
            parLevel: ing.parLevel,
            unit: ing.unit,
            severity: 'warning',
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
            status: 'open',
          });
        }
      });
    });

    setAlerts(generatedAlerts);
  }, [ingredients, locations]);

  // Show Toast notification helper
  const showToastNotification = (title: string, body: string, type: 'info' | 'alert' | 'success' = 'info') => {
    setToast({ title, body, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Stock Adjustment Handler with Offline Ledger support
  const handleUpdateStock = (ingredientId: string, locationId: string, newQty: number, reason?: string) => {
    const loc = locations.find((l) => l.id === locationId);
    const ing = ingredients.find((i) => i.id === ingredientId);
    const prevStock = ing?.stockByLocation[locationId]?.quantity || 0;
    const delta = newQty - prevStock;

    const updatedIngredients = ingredients.map((item) => {
      if (item.id === ingredientId) {
        return {
          ...item,
          stockByLocation: {
            ...item.stockByLocation,
            [locationId]: {
              quantity: newQty,
              lastCountDate: new Date().toISOString().slice(0, 10),
              lastCountBy: currentUser.name,
            },
          },
        };
      }
      return item;
    });

    setIngredients(updatedIngredients);
    StorageService.saveIngredients(updatedIngredients);

    // Track stock movement for D3 visualization
    if (delta !== 0 && ing && loc) {
      StockMovementService.addMovement({
        date: new Date().toISOString().slice(0, 10),
        ingredientId,
        ingredientName: ing.name,
        category: ing.category,
        locationId,
        locationName: loc.name,
        type: delta > 0 ? 'inflow' : 'outflow',
        flowType: delta > 0 ? 'audit_reconciliation' : 'waste_spoilage',
        flowLabel: delta > 0 ? 'Inventory Count Upward Adj' : 'Inventory Count Deduction',
        quantity: Math.abs(delta),
        unit: ing.unit,
        unitCost: ing.costPerUnit,
        totalValue: Math.round(Math.abs(delta) * ing.costPerUnit * 100) / 100,
        reference: `AUDIT-${Date.now().toString().slice(-4)}`,
        recordedBy: currentUser.name,
        notes: reason || 'Manual stock adjustment in manager.',
      });
    }

    const actionText = reason || `Stock Adjusted to ${newQty} ${ing?.unit}`;
    const auditDetail = `Updated stock for ${ing?.name} at ${loc?.name} to ${newQty} ${ing?.unit}.`;

    // If offline, record in offline queue
    if (isOffline) {
      const queueItem = StorageService.enqueueOfflineChange('stock_update', auditDetail, {
        ingredientId,
        locationId,
        newQty,
      });
      setOfflineQueue(StorageService.getOfflineQueue());
      showToastNotification(
        'Offline Entry Saved',
        `Recorded ${ing?.name} update locally. Queued for cloud sync when connection returns.`,
        'info'
      );
    } else {
      const log = StorageService.addAuditLog({
        userName: currentUser.name,
        userRole: currentUser.role,
        locationId,
        locationName: loc?.name || "Pepai's",
        category: 'inventory',
        action: actionText,
        details: auditDetail,
      });
      setAuditLogs(StorageService.getAuditLogs());
    }
  };

  // Inter-Location Stock Transfer Handler
  const handleTransferStock = (ingredientId: string, fromLocId: string, toLocId: string, qty: number) => {
    const fromLoc = locations.find((l) => l.id === fromLocId);
    const toLoc = locations.find((l) => l.id === toLocId);
    const ing = ingredients.find((i) => i.id === ingredientId);

    const updated = ingredients.map((item) => {
      if (item.id === ingredientId) {
        const fromCurrent = item.stockByLocation[fromLocId]?.quantity || 0;
        const toCurrent = item.stockByLocation[toLocId]?.quantity || 0;

        return {
          ...item,
          stockByLocation: {
            ...item.stockByLocation,
            [fromLocId]: {
              ...item.stockByLocation[fromLocId],
              quantity: Math.max(0, fromCurrent - qty),
            },
            [toLocId]: {
              ...item.stockByLocation[toLocId],
              quantity: toCurrent + qty,
            },
          },
        };
      }
      return item;
    });

    setIngredients(updated);
    StorageService.saveIngredients(updated);

    // Track inter-branch transfers in stock movement
    if (ing && fromLoc && toLoc) {
      StockMovementService.addMovement({
        date: new Date().toISOString().slice(0, 10),
        ingredientId,
        ingredientName: ing.name,
        category: ing.category,
        locationId: fromLocId,
        locationName: fromLoc.name,
        type: 'outflow',
        flowType: 'transfer_out',
        flowLabel: 'Inter-Branch Transfer Out',
        quantity: qty,
        unit: ing.unit,
        unitCost: ing.costPerUnit,
        totalValue: Math.round(qty * ing.costPerUnit * 100) / 100,
        reference: `TRF-${fromLoc.code}-${toLoc.code}`,
        recordedBy: currentUser.name,
        notes: `Transfer dispatched to ${toLoc.name}`,
      });

      StockMovementService.addMovement({
        date: new Date().toISOString().slice(0, 10),
        ingredientId,
        ingredientName: ing.name,
        category: ing.category,
        locationId: toLocId,
        locationName: toLoc.name,
        type: 'inflow',
        flowType: 'transfer_in',
        flowLabel: 'Inter-Branch Transfer In',
        quantity: qty,
        unit: ing.unit,
        unitCost: ing.costPerUnit,
        totalValue: Math.round(qty * ing.costPerUnit * 100) / 100,
        reference: `TRF-${fromLoc.code}-${toLoc.code}`,
        recordedBy: currentUser.name,
        notes: `Transfer received from ${fromLoc.name}`,
      });
    }

    const detail = `Transferred ${qty} ${ing?.unit} of ${ing?.name} from ${fromLoc?.name} to ${toLoc?.name}.`;

    if (isOffline) {
      StorageService.enqueueOfflineChange('stock_transfer', detail, { ingredientId, fromLocId, toLocId, qty });
      setOfflineQueue(StorageService.getOfflineQueue());
    } else {
      StorageService.addAuditLog({
        userName: currentUser.name,
        userRole: currentUser.role,
        locationId: fromLocId,
        locationName: fromLoc?.name || "Pepai's",
        category: 'inventory',
        action: 'Inter-Unit Stock Transfer',
        details: detail,
      });
      setAuditLogs(StorageService.getAuditLogs());
    }

    showToastNotification('Transfer Complete', detail, 'success');
  };

  // Sync Offline Queue Replay
  const handleSyncOfflineQueue = () => {
    const queue = StorageService.getOfflineQueue();
    if (queue.length === 0) return;

    StorageService.clearOfflineQueue();
    setOfflineQueue([]);

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: selectedLocationId === 'all' ? locations[0].id : selectedLocationId,
      locationName: "Pepai's Kitchen Cloud",
      category: 'system',
      action: 'Offline Ledger Synced',
      details: `Replayed and synchronized ${queue.length} pending offline kitchen records to AWS Cloud.`,
    });
    setAuditLogs(StorageService.getAuditLogs());

    showToastNotification(
      'Cloud Sync Successful',
      `Synchronized ${queue.length} queued offline transactions to cloud database.`,
      'success'
    );
  };

  // Toggle Offline mode
  const handleToggleOffline = () => {
    const willBeOffline = !isOffline;
    setIsOffline(willBeOffline);

    if (!willBeOffline && offlineQueue.length > 0) {
      // Reconnected! Auto-sync
      handleSyncOfflineQueue();
    } else if (willBeOffline) {
      showToastNotification(
        'Offline Mode Active',
        'Simulating kitchen network disconnect. All counts & waste logs will queue locally without data loss.',
        'alert'
      );
    }
  };

  // AWS S3 Cloud Sync simulation
  const handleTriggerS3Sync = () => {
    if (isOffline) return;
    setIsSyncingS3(true);

    setTimeout(() => {
      setIsSyncingS3(false);
      const newArchive: S3ArchiveFile = {
        key: `backups/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/pepais-full-backup-${Date.now().toString().slice(-4)}.json`,
        bucket: settings.s3Bucket,
        region: settings.s3Region,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        sizeBytes: 256420,
        reportType: 'Full System Snapshot (Recipes, Inventory & Margins)',
        etag: `"${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}"`,
        generatedBy: currentUser.name,
      };

      StorageService.addS3Archive(newArchive);
      setS3Archives(StorageService.getS3Archives());

      StorageService.addAuditLog({
        userName: currentUser.name,
        userRole: currentUser.role,
        locationId: 'all',
        locationName: "Pepai's Central",
        category: 'system',
        action: 'AWS S3 Snapshot Uploaded',
        details: `Synchronized kitchen state to s3://${settings.s3Bucket}/${newArchive.key} (AES-256).`,
      });
      setAuditLogs(StorageService.getAuditLogs());

      showToastNotification(
        'AWS S3 Snapshot Saved',
        `Pushed encrypted backup to ${settings.s3Bucket} (${settings.s3Region}).`,
        'success'
      );
    }, 1200);
  };

  // Upload custom S3 report
  const handleUploadS3Report = (type: string, data: any) => {
    const newArchive: S3ArchiveFile = {
      key: `reports/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/pepais-${type.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}.json`,
      bucket: settings.s3Bucket,
      region: settings.s3Region,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      sizeBytes: 118400,
      reportType: type,
      etag: `"${Math.random().toString(16).slice(2, 10)}"`,
      generatedBy: currentUser.name,
    };

    StorageService.addS3Archive(newArchive);
    setS3Archives(StorageService.getS3Archives());

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: selectedLocationId === 'all' ? locations[0].id : selectedLocationId,
      locationName: "Pepai's Central",
      category: 'report',
      action: 'Report Archived to S3',
      details: `Saved ${type} to AWS S3 bucket ${settings.s3Bucket}.`,
    });
    setAuditLogs(StorageService.getAuditLogs());
  };

  // Save or update recipe modification
  const handleSaveMenuItem = (updatedItem: MenuItem) => {
    const exists = menuItems.some((m) => m.id === updatedItem.id);
    const updated = exists
      ? menuItems.map((m) => (m.id === updatedItem.id ? updatedItem : m))
      : [updatedItem, ...menuItems];
    setMenuItems(updated);
    StorageService.saveMenuItems(updated);

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: selectedLocationId === 'all' ? locations[0]?.id || 'loc-1' : selectedLocationId,
      locationName: "Pepai's Central",
      category: 'costing',
      action: 'Recipe Formulation Saved',
      details: `Updated ${updatedItem.name} recipe costing & selling price (₱${updatedItem.sellingPrice.toFixed(2)}).`,
    });
    setAuditLogs(StorageService.getAuditLogs());

    showToastNotification('Recipe Saved', `${updatedItem.name} formulation and costing updated.`, 'success');
  };

  // Add brand new recipe formulation
  const handleAddMenuItem = (newItem: MenuItem) => {
    const updated = [newItem, ...menuItems];
    setMenuItems(updated);
    StorageService.saveMenuItems(updated);
    setSelectedCostingItemId(newItem.id);

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: selectedLocationId === 'all' ? locations[0]?.id || 'loc-1' : selectedLocationId,
      locationName: "Pepai's Central",
      category: 'costing',
      action: 'New Recipe Created',
      details: `Created new ${newItem.category} recipe '${newItem.name}' with selling price ₱${newItem.sellingPrice.toFixed(2)}.`,
    });
    setAuditLogs(StorageService.getAuditLogs());

    showToastNotification(
      'Recipe Created',
      `${newItem.name} added to the menu and ready for costing analysis.`,
      'success'
    );
  };

  // Delete recipe formulation
  const handleDeleteMenuItem = (itemId: string) => {
    if (menuItems.length <= 1) {
      showToastNotification('Cannot Delete', 'At least one recipe formulation must be maintained.', 'alert');
      return;
    }
    const itemToDelete = menuItems.find((m) => m.id === itemId);
    const updated = menuItems.filter((m) => m.id !== itemId);
    setMenuItems(updated);
    StorageService.saveMenuItems(updated);
    if (selectedCostingItemId === itemId && updated.length > 0) {
      setSelectedCostingItemId(updated[0].id);
    }

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: selectedLocationId === 'all' ? locations[0]?.id || 'loc-1' : selectedLocationId,
      locationName: "Pepai's Central",
      category: 'costing',
      action: 'Recipe Formulation Removed',
      details: `Removed recipe '${itemToDelete?.name || itemId}'.`,
    });
    setAuditLogs(StorageService.getAuditLogs());

    showToastNotification('Recipe Deleted', `${itemToDelete?.name || 'Recipe'} has been removed.`, 'info');
  };

  // Add new restaurant location
  const handleAddLocation = (locData: Omit<Location, 'id'>) => {
    const newLocId = `loc-${Date.now().toString().slice(-4)}`;
    const newLocation: Location = {
      id: newLocId,
      ...locData,
    };

    const updatedLocations = [...locations, newLocation];
    setLocations(updatedLocations);
    StorageService.saveLocations(updatedLocations);

    // Initialize ingredient stock for new location
    const updatedIngredients = ingredients.map((ing) => ({
      ...ing,
      stockByLocation: {
        ...ing.stockByLocation,
        [newLocId]: {
          quantity: ing.minThreshold ? Math.round(ing.minThreshold * 1.5) : 10,
          lastCountDate: new Date().toISOString().slice(0, 10),
          lastCountBy: currentUser.name,
        },
      },
    }));
    setIngredients(updatedIngredients);
    StorageService.saveIngredients(updatedIngredients);

    // Initialize monthly sales for new location
    const updatedMenuItems = menuItems.map((item) => ({
      ...item,
      monthlySalesUnits: {
        ...item.monthlySalesUnits,
        [newLocId]: 140, // standard baseline volume
      },
    }));
    setMenuItems(updatedMenuItems);
    StorageService.saveMenuItems(updatedMenuItems);

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: newLocId,
      locationName: newLocation.name,
      category: 'system',
      action: 'Restaurant Branch Added',
      details: `Deployed new store unit ${newLocation.name} (${newLocation.code}) in ${newLocation.city}.`,
    });
    setAuditLogs(StorageService.getAuditLogs());

    showToastNotification(
      'Location Deployed',
      `${newLocation.name} (${newLocation.code}) added to restaurant network with active inventory rows.`,
      'success'
    );
  };

  // Remove restaurant location
  const handleRemoveLocation = (locationId: string) => {
    if (locations.length <= 1) {
      showToastNotification('Cannot Remove', 'At least one operational store location is required.', 'alert');
      return;
    }

    const locToRemove = locations.find((l) => l.id === locationId);
    const updatedLocations = locations.filter((l) => l.id !== locationId);
    setLocations(updatedLocations);
    StorageService.saveLocations(updatedLocations);

    // If the active location was removed, reset filter to 'all'
    if (selectedLocationId === locationId) {
      setSelectedLocationId('all');
    }

    // Clean up or isolate deleted location from ingredients
    const updatedIngredients = ingredients.map((ing) => {
      const copyStock = { ...ing.stockByLocation };
      delete copyStock[locationId];
      return {
        ...ing,
        stockByLocation: copyStock,
      };
    });
    setIngredients(updatedIngredients);
    StorageService.saveIngredients(updatedIngredients);

    // Clean up from menu items
    const updatedMenuItems = menuItems.map((item) => {
      const copySales = { ...item.monthlySalesUnits };
      delete copySales[locationId];
      return {
        ...item,
        monthlySalesUnits: copySales,
      };
    });
    setMenuItems(updatedMenuItems);
    StorageService.saveMenuItems(updatedMenuItems);

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: 'all',
      locationName: "Pepai's Central",
      category: 'system',
      action: 'Restaurant Branch Removed',
      details: `Decommissioned store unit ${locToRemove?.name || locationId} (${locToRemove?.code || ''}).`,
    });
    setAuditLogs(StorageService.getAuditLogs());

    showToastNotification(
      'Location Removed',
      `${locToRemove?.name || 'Unit'} has been decommissioned from the active network.`,
      'info'
    );
  };

  // Update existing location details
  const handleUpdateLocation = (updatedLoc: Location) => {
    const updatedLocations = locations.map((l) => (l.id === updatedLoc.id ? updatedLoc : l));
    setLocations(updatedLocations);
    StorageService.saveLocations(updatedLocations);

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: updatedLoc.id,
      locationName: updatedLoc.name,
      category: 'system',
      action: 'Location Details Updated',
      details: `Updated information for store unit ${updatedLoc.name} (${updatedLoc.code}).`,
    });
    setAuditLogs(StorageService.getAuditLogs());

    showToastNotification(
      'Location Updated',
      `${updatedLoc.name} information has been saved.`,
      'success'
    );
  };

  // Add Customer Feedback
  const handleAddFeedback = (feedbackData: Omit<CustomerFeedback, 'id' | 'date'>) => {
    const newFeedback: CustomerFeedback = {
      id: `fb-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      ...feedbackData,
    };
    const updated = [newFeedback, ...feedbackList];
    setFeedbackList(updated);
    StorageService.saveFeedback(updated);

    StorageService.addAuditLog({
      userName: currentUser.name,
      userRole: currentUser.role,
      locationId: feedbackData.locationId,
      locationName: feedbackData.locationName,
      category: 'system',
      action: 'Customer Feedback Logged',
      details: `Guest rating ${feedbackData.rating}★ recorded for ${feedbackData.dishName} (${feedbackData.sentiment}).`,
    });
    setAuditLogs(StorageService.getAuditLogs());

    showToastNotification('Feedback Saved', `Guest score of ${feedbackData.rating}★ recorded.`, 'success');
  };

  // Mark Alert Ordered
  const handleMarkAlertOrdered = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: 'ordered' } : a))
    );
    showToastNotification('PO Dispatched', 'Alert marked as ordered. Restock delivery scheduled.', 'info');
  };

  // Biometric Test Simulation Promise
  const handleSimulateBiometric = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 1200);
    });
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors flex flex-col font-sans">
      {/* Toast Alert Banner */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm p-4 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-2xl border border-neutral-700 dark:border-neutral-200 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 dark:text-amber-600">
                {toast.title}
              </h4>
              <p className="text-xs font-medium mt-0.5 text-neutral-300 dark:text-neutral-700">
                {toast.body}
              </p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-neutral-400 hover:text-white dark:hover:text-black text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        locations={locations}
        selectedLocationId={selectedLocationId}
        onSelectLocation={setSelectedLocationId}
        onOpenLocationsModal={() => setShowLocationsModal(true)}
        currentUser={currentUser}
        onSwitchUserPrompt={() => setShowAuthModal(true)}
        isOffline={isOffline}
        onToggleOffline={handleToggleOffline}
        offlineQueue={offlineQueue}
        onSyncOfflineQueue={handleSyncOfflineQueue}
        alerts={alerts}
        onOpenAlertsTab={() => setActiveTab('alerts')}
        settings={settings}
        onToggleTheme={() => {
          const updated = { ...settings, darkMode: !settings.darkMode };
          setSettings(updated);
          StorageService.saveSettings(updated);
        }}
        onOpenSettings={() => setActiveTab('settings')}
        onTriggerS3Sync={handleTriggerS3Sync}
        isSyncingS3={isSyncingS3}
      />

      {/* Tab Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        alertCount={alerts.filter((a) => a.status === 'open').length}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 pb-28 md:pb-10">
        {activeTab === 'dashboard' && (
          <Dashboard
            menuItems={menuItems}
            ingredients={ingredients}
            locations={locations}
            selectedLocationId={selectedLocationId}
            alerts={alerts}
            auditLogs={auditLogs}
            laborRatePerHour={settings.kitchenLaborRatePerHour}
            targetFoodCostPct={settings.targetFoodCostPct}
            onNavigate={setActiveTab}
            onSelectRecipeForCosting={(id) => {
              setSelectedCostingItemId(id);
              setActiveTab('costing');
            }}
            onOpenLocationsModal={() => setShowLocationsModal(true)}
          />
        )}

        {activeTab === 'costing' && (
          <FoodCostCalculator
            menuItems={menuItems}
            ingredients={ingredients}
            selectedItemId={selectedCostingItemId}
            onSelectMenuItem={setSelectedCostingItemId}
            onSaveMenuItem={handleSaveMenuItem}
            onAddMenuItem={handleAddMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            currentUser={currentUser}
            laborRatePerHour={settings.kitchenLaborRatePerHour}
            targetFoodCostPct={settings.targetFoodCostPct}
            targetProfitMarginPct={settings.targetProfitMarginPct ?? (100 - settings.targetFoodCostPct)}
            settings={settings}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager
            ingredients={ingredients}
            locations={locations}
            selectedLocationId={selectedLocationId}
            currentUser={currentUser}
            isOffline={isOffline}
            onUpdateStock={handleUpdateStock}
            onTransferStock={handleTransferStock}
            auditLogs={auditLogs}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsManager
            alerts={alerts}
            ingredients={ingredients}
            locations={locations}
            selectedLocationId={selectedLocationId}
            settings={settings}
            onUpdateSettings={(s) => {
              setSettings(s);
              StorageService.saveSettings(s);
            }}
            onMarkAlertOrdered={handleMarkAlertOrdered}
            onSendMobilePushSimulation={(title, body) =>
              showToastNotification(title, body, 'alert')
            }
            onGeneratePO={(supplier, items) => {
              showToastNotification('PO Placed', `Order sent to ${supplier}`, 'success');
            }}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsManager
            menuItems={menuItems}
            ingredients={ingredients}
            locations={locations}
            selectedLocationId={selectedLocationId}
            settings={settings}
            s3Archives={s3Archives}
            onUploadS3Report={handleUploadS3Report}
            onSendNotification={(title, body) => showToastNotification(title, body, 'info')}
            auditLogs={auditLogs}
            onLocationChange={setSelectedLocationId}
          />
        )}

        {activeTab === 'feedback' && (
          <CustomerFeedbackModule
            feedbackList={feedbackList}
            menuItems={menuItems}
            locations={locations}
            onAddFeedback={handleAddFeedback}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'security' && (
          <SecurityAndAudit
            auditLogs={auditLogs}
            currentUser={currentUser}
            onSimulateBiometric={handleSimulateBiometric}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsModal
            settings={settings}
            onSaveSettings={(s) => {
              setSettings(s);
              StorageService.saveSettings(s);
              showToastNotification('Settings Saved', 'System preferences updated.', 'success');
            }}
            currentUser={currentUser}
            onOpenLocationsModal={() => setShowLocationsModal(true)}
            locationsCount={locations.length}
          />
        )}
      </main>

      {/* Auth & Role Switching Modal */}
      {showAuthModal && (
        <AuthModal
          currentUser={currentUser}
          onSelectUser={(u) => {
            setCurrentUser(u);
            StorageService.setActiveUser(u);
            showToastNotification('User Active', `Logged in as ${u.name} (${u.roleTitle})`, 'info');
          }}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* Locations / Restaurant Units Management Modal */}
      {showLocationsModal && (
        <LocationsManagerModal
          isOpen={showLocationsModal}
          onClose={() => setShowLocationsModal(false)}
          locations={locations}
          onAddLocation={handleAddLocation}
          onRemoveLocation={handleRemoveLocation}
          onUpdateLocation={handleUpdateLocation}
          ingredients={ingredients}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
