export type UserRole = 'admin' | 'manager' | 'chef' | 'kitchen';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatar: string;
  biometricEnabled: boolean;
  mfaEnabled: boolean;
  assignedLocationId: string;
}

export type IngredientCategory = 'Proteins' | 'Dairy & Cheese' | 'Produce' | 'Dry Goods & Flour' | 'Oils & Condiments' | 'Beverages & Bar' | 'Packaging';

export interface LocationStock {
  quantity: number;
  lastCountDate: string;
  lastCountBy: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: string; // 'kg', 'g', 'L', 'ml', 'unit', 'can', 'bunch', 'box'
  costPerUnit: number; // Cost in USD per base unit
  stockByLocation: Record<string, LocationStock>; // locationId -> stock
  minThreshold: number; // Alerts when total/location stock < this
  parLevel: number; // Target par level
  supplier: string;
  supplierEmail: string;
  shelfLifeDays: number;
  lastPriceUpdate: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number; // in ingredient's base unit
  unit: string;
  wastePercent: number; // e.g. 10% trim waste
  notes?: string;
}

export type MenuCategory = 'Pizza' | 'Pasta' | 'Mains' | 'Starters' | 'Desserts' | 'Beverages';

export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  description: string;
  ingredients: RecipeIngredient[];
  prepLaborMinutes: number;
  packagingCost: number;
  sellingPrice: number;
  targetFoodCostPercent: number; // e.g. 28%
  portionYield: number; // e.g. 1 portion (maintained for backward compatibility)
  yieldQuantity: number; // Number of portions or batches a single recipe produces
  yieldUnit?: string; // Unit descriptor e.g. 'portions', 'servings', 'slices', 'plates', 'batches'
  monthlySalesUnits: Record<string, number>; // locationId -> units sold
  rating: number;
  status: 'active' | 'seasonal' | 'draft';
}

export interface Location {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  manager: string;
  active: boolean;
}

export interface InventoryAlert {
  id: string;
  ingredientId: string;
  ingredientName: string;
  locationId: string;
  locationName: string;
  currentStock: number;
  minThreshold: number;
  parLevel: number;
  unit: string;
  severity: 'critical' | 'warning';
  timestamp: string;
  status: 'open' | 'ordered' | 'resolved';
}

export type AuditCategory = 'inventory' | 'costing' | 'security' | 'system' | 'report';

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  locationId: string;
  locationName: string;
  category: AuditCategory;
  action: string;
  details: string;
}

export interface CustomerFeedback {
  id: string;
  dishId: string;
  dishName: string;
  locationId: string;
  locationName: string;
  rating: number; // 1 to 5 stars
  npsScore: number; // 0 to 10
  comment: string;
  category: 'Food Quality' | 'Portion Size' | 'Value for Money' | 'Temperature' | 'Service';
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  customerName: string;
}

export interface AppSettings {
  darkMode: boolean;
  automatedEmailAlerts: boolean;
  emailRecipients: string[];
  pushNotificationsEnabled: boolean;
  biometricAuthRequired: boolean;
  mfaRequired: boolean;
  s3Bucket: string;
  s3Region: string;
  s3AutoSync: boolean;
  lastS3Sync: string | null;
  targetFoodCostPct: number;
  targetProfitMarginPct?: number;
  dailyReportEmailEnabled: boolean;
  dailyReportTime: string;
  kitchenLaborRatePerHour: number;
  currency: string;
  currencySymbol: string;
}

export interface OfflineQueueItem {
  id: string;
  timestamp: string;
  type: 'stock_update' | 'waste_log' | 'recipe_edit' | 'stock_transfer';
  description: string;
  payload: any;
  synced: boolean;
}

export interface StockTransfer {
  id: string;
  ingredientId: string;
  ingredientName: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  unit: string;
  requestedBy: string;
  timestamp: string;
  status: 'pending' | 'completed';
}

export type WasteCategory =
  | 'spoilage'
  | 'over_prep'
  | 'burnt'
  | 'expired'
  | 'dropped_damaged'
  | 'other';

export interface WasteLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  ingredientId: string;
  ingredientName: string;
  category: IngredientCategory;
  locationId: string;
  locationName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number; // quantity * unitCost in PHP ₱
  wasteCategory: WasteCategory;
  reason: string;
  notes?: string;
  loggedBy: string;
}

export type StockFlowType =
  | 'purchase_delivery'
  | 'transfer_in'
  | 'sales_consumption'
  | 'waste_spoilage'
  | 'transfer_out'
  | 'audit_reconciliation';

export type PredictiveUrgency = 'critical' | 'reorder' | 'optimal' | 'surplus';

export interface AuditDataPoint {
  id: string;
  date: string;
  timestamp: string;
  action: string;
  details: string;
  source: string;
  quantity?: number;
  userName: string;
}

export interface PredictiveStockInsight {
  ingredientId: string;
  ingredientName: string;
  category: IngredientCategory;
  supplier: string;
  unit: string;
  unitCost: number;
  currentStock: number;
  parLevel: number;
  minThreshold: number;
  avgDailyBurnRate: number; // units consumed per day
  daysRemaining: number; // runout horizon
  runoutDate: string; // e.g. "Sep 28, 2026"
  projectedWeeklyDemand: number; // 7-day projected consumption
  suggestedWeeklyPO: number; // recommended weekly purchase order quantity
  suggestedPOCost: number; // suggestedWeeklyPO * unitCost
  urgency: PredictiveUrgency;
  urgencyLabel: string;
  trendVelocity: 'up' | 'stable' | 'down';
  trendPercent: number; // e.g. +14% vs previous cycle
  leadTimeDays: number;
  recommendedOrderDate: string;
  safetyStockBuffer: number;
  historicalAuditEventsCount: number;
  recentAuditPoints: AuditDataPoint[];
  dailyProjectedUsage: {
    dayName: string;
    date: string;
    projectedQty: number;
    projectedStockRemaining: number;
    isWeekend: boolean;
  }[];
}

export interface StockMovementRecord {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  ingredientId: string;
  ingredientName: string;
  category: IngredientCategory;
  locationId: string;
  locationName: string;
  type: 'inflow' | 'outflow';
  flowType: StockFlowType;
  flowLabel: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalValue: number; // ₱ PHP
  reference: string;
  recordedBy: string;
  notes?: string;
}
