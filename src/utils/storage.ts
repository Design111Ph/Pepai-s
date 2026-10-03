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
  WasteLogEntry,
} from '../types';
import {
  INITIAL_INGREDIENTS,
  INITIAL_MENU_ITEMS,
  INITIAL_LOCATIONS,
  INITIAL_FEEDBACK,
  INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS,
  INITIAL_USERS,
  INITIAL_WASTE_LOGS,
} from '../data/initialData';

const STORAGE_KEYS = {
  INGREDIENTS: 'pepais_ingredients_php_v2',
  MENU_ITEMS: 'pepais_menu_items_php_v2',
  LOCATIONS: 'pepais_locations_php_v2',
  ALERTS: 'pepais_alerts_php_v2',
  FEEDBACK: 'pepais_feedback_php_v2',
  AUDIT_LOGS: 'pepais_audit_logs_php_v2',
  SETTINGS: 'pepais_settings_php_v2',
  ACTIVE_USER: 'pepais_active_user_php_v2',
  OFFLINE_QUEUE: 'pepais_offline_queue_php_v2',
  S3_ARCHIVES: 'pepais_s3_archives_php_v2',
  WASTE_LOGS: 'pepais_waste_logs_php_v2',
};

export interface S3ArchiveFile {
  key: string;
  bucket: string;
  region: string;
  timestamp: string;
  sizeBytes: number;
  reportType: string;
  etag: string;
  generatedBy: string;
}

export const StorageService = {
  getIngredients(): Ingredient[] {
    const raw = localStorage.getItem(STORAGE_KEYS.INGREDIENTS);
    if (!raw) {
      this.saveIngredients(INITIAL_INGREDIENTS);
      return INITIAL_INGREDIENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_INGREDIENTS;
    }
  },

  saveIngredients(data: Ingredient[]) {
    localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(data));
  },

  getMenuItems(): MenuItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MENU_ITEMS);
    if (!raw) {
      this.saveMenuItems(INITIAL_MENU_ITEMS);
      return INITIAL_MENU_ITEMS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_MENU_ITEMS;
    }
  },

  saveMenuItems(data: MenuItem[]) {
    localStorage.setItem(STORAGE_KEYS.MENU_ITEMS, JSON.stringify(data));
  },

  getLocations(): Location[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    if (!raw) {
      this.saveLocations(INITIAL_LOCATIONS);
      return INITIAL_LOCATIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_LOCATIONS;
    }
  },

  saveLocations(data: Location[]) {
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(data));
  },

  getFeedback(): CustomerFeedback[] {
    const raw = localStorage.getItem(STORAGE_KEYS.FEEDBACK);
    if (!raw) {
      this.saveFeedback(INITIAL_FEEDBACK);
      return INITIAL_FEEDBACK;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_FEEDBACK;
    }
  },

  saveFeedback(data: CustomerFeedback[]) {
    localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(data));
  },

  getAuditLogs(): AuditLog[] {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (!raw) {
      this.saveAuditLogs(INITIAL_AUDIT_LOGS);
      return INITIAL_AUDIT_LOGS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  },

  saveAuditLogs(data: AuditLog[]) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(data));
  },

  addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ...entry,
    };
    const updated = [newLog, ...logs].slice(0, 250); // keep recent 250
    this.saveAuditLogs(updated);
    return newLog;
  },

  getSettings(): AppSettings {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      this.saveSettings(INITIAL_SETTINGS);
      return INITIAL_SETTINGS;
    }
    try {
      return { ...INITIAL_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return INITIAL_SETTINGS;
    }
  },

  saveSettings(data: AppSettings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data));
  },

  getActiveUser(): User {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    if (!raw) {
      this.setActiveUser(INITIAL_USERS[0]); // Marco Pepai (Admin)
      return INITIAL_USERS[0];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_USERS[0];
    }
  },

  setActiveUser(user: User) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));
  },

  getOfflineQueue(): OfflineQueueItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveOfflineQueue(queue: OfflineQueueItem[]) {
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  },

  enqueueOfflineChange(type: OfflineQueueItem['type'], description: string, payload: any): OfflineQueueItem {
    const queue = this.getOfflineQueue();
    const item: OfflineQueueItem = {
      id: `queue-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      description,
      payload,
      synced: false,
    };
    queue.push(item);
    this.saveOfflineQueue(queue);
    return item;
  },

  clearOfflineQueue() {
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  },

  getS3Archives(): S3ArchiveFile[] {
    const raw = localStorage.getItem(STORAGE_KEYS.S3_ARCHIVES);
    if (!raw) {
      const initialArchives: S3ArchiveFile[] = [
        {
          key: 'reports/2026/09/pepais-eom-food-costing-q3.pdf',
          bucket: 'pepais-kitchen-backups-us-east-1',
          region: 'us-east-1',
          timestamp: '2026-09-22 23:59:00',
          sizeBytes: 142850,
          reportType: 'Food Cost Margins & COGS',
          etag: '"a9b2c89f2140d39e802a4"',
          generatedBy: 'Marco Pepai',
        },
        {
          key: 'reports/2026/09/pepais-weekly-inventory-par-status.csv',
          bucket: 'pepais-kitchen-backups-us-east-1',
          region: 'us-east-1',
          timestamp: '2026-09-21 06:00:00',
          sizeBytes: 42100,
          reportType: 'Inventory Par & Stock Levels',
          etag: '"f14c23179ba18042c8d20"',
          generatedBy: 'Elena Rostova',
        },
      ];
      localStorage.setItem(STORAGE_KEYS.S3_ARCHIVES, JSON.stringify(initialArchives));
      return initialArchives;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  addS3Archive(archive: S3ArchiveFile) {
    const archives = this.getS3Archives();
    const updated = [archive, ...archives];
    localStorage.setItem(STORAGE_KEYS.S3_ARCHIVES, JSON.stringify(updated));
  },

  getWasteLogs(): WasteLogEntry[] {
    const raw = localStorage.getItem(STORAGE_KEYS.WASTE_LOGS);
    if (!raw) {
      this.saveWasteLogs(INITIAL_WASTE_LOGS);
      return INITIAL_WASTE_LOGS;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.saveWasteLogs(INITIAL_WASTE_LOGS);
        return INITIAL_WASTE_LOGS;
      }
      return parsed;
    } catch {
      return INITIAL_WASTE_LOGS;
    }
  },

  saveWasteLogs(data: WasteLogEntry[]) {
    localStorage.setItem(STORAGE_KEYS.WASTE_LOGS, JSON.stringify(data));
  },

  addWasteLog(entry: Omit<WasteLogEntry, 'id' | 'timestamp'>): WasteLogEntry {
    const logs = this.getWasteLogs();
    const newEntry: WasteLogEntry = {
      id: `wst-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ...entry,
    };
    const updated = [newEntry, ...logs];
    this.saveWasteLogs(updated);
    return newEntry;
  },

  deleteWasteLog(id: string) {
    const logs = this.getWasteLogs();
    const updated = logs.filter((l) => l.id !== id);
    this.saveWasteLogs(updated);
  },
};

export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || !rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          let cell = row[header];
          if (cell === null || cell === undefined) cell = '';
          const str = String(cell).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    ),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
