import { Ingredient, Location, StockMovementRecord, StockFlowType } from '../types';
import { INITIAL_INGREDIENTS, INITIAL_LOCATIONS } from '../data/initialData';

const STORAGE_KEY = 'pepais_stock_movements_php_v1';

// Deterministic seed generator for 30 days of realistic restaurant stock movement
export function generateSeedStockMovements(
  ingredients: Ingredient[] = INITIAL_INGREDIENTS,
  locations: Location[] = INITIAL_LOCATIONS
): StockMovementRecord[] {
  const records: StockMovementRecord[] = [];
  const baseDate = new Date(2026, 8, 24); // Sept 24, 2026
  const locMap = new Map(locations.map((l) => [l.id, l]));

  // Common high-activity ingredients to ensure rich trends
  const keyIngredients = ingredients.length > 0 ? ingredients : INITIAL_INGREDIENTS;

  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const currentDate = new Date(baseDate);
    currentDate.setDate(baseDate.getDate() - dayOffset);
    const dateStr = currentDate.toISOString().slice(0, 10);
    const dayOfWeek = currentDate.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Fri, Sat, Sun
    const weekendMultiplier = isWeekend ? 1.6 : 1.0;

    locations.forEach((loc, locIndex) => {
      // Scale factor per location (BGC highest volume, Alabang boutique)
      const locVolumeMultiplier = locIndex === 0 ? 1.3 : locIndex === 1 ? 1.1 : 0.85;

      // 1. INFLOW: Scheduled Deliveries
      // Mondays (1) and Thursdays (4): Major stock delivery days
      // Saturdays (6): Emergency produce/dairy top-up
      const isDeliveryDay = dayOfWeek === 1 || dayOfWeek === 4 || (dayOfWeek === 6 && locIndex === 0);

      if (isDeliveryDay) {
        // Pick 4-7 ingredients for delivery
        const deliveryCount = 4 + ((dayOffset + locIndex) % 4);
        for (let i = 0; i < deliveryCount; i++) {
          const ing = keyIngredients[(dayOffset * 3 + i * 2 + locIndex) % keyIngredients.length];
          const baseDeliverQty = Math.round((ing.parLevel * 0.45 * locVolumeMultiplier + (i * 2.5)) * 10) / 10;
          const totalVal = Math.round(baseDeliverQty * ing.costPerUnit * 100) / 100;

          records.push({
            id: `mov-in-${dateStr}-${loc.id}-${ing.id}-${i}`,
            date: dateStr,
            timestamp: `${dateStr} 07:${(30 + i * 5).toString().padStart(2, '0')}:00`,
            ingredientId: ing.id,
            ingredientName: ing.name,
            category: ing.category,
            locationId: loc.id,
            locationName: loc.name,
            type: 'inflow',
            flowType: 'purchase_delivery',
            flowLabel: 'Supplier Restock Delivery',
            quantity: baseDeliverQty,
            unit: ing.unit,
            unitCost: ing.costPerUnit,
            totalValue: totalVal,
            reference: `PO-${dateStr.replace(/-/g, '').slice(2)}-${100 + i}`,
            recordedBy: loc.manager || 'Receiving Staff',
            notes: `Delivered by ${ing.supplier} with cold-chain verification.`,
          });
        }
      }

      // Inter-unit transfer in (occasional on Wednesdays)
      if (dayOfWeek === 3 && locIndex === 1) {
        const ing = keyIngredients[0]; // Flour
        const transferQty = 15;
        records.push({
          id: `mov-trf-in-${dateStr}-${loc.id}`,
          date: dateStr,
          timestamp: `${dateStr} 14:15:00`,
          ingredientId: ing.id,
          ingredientName: ing.name,
          category: ing.category,
          locationId: loc.id,
          locationName: loc.name,
          type: 'inflow',
          flowType: 'transfer_in',
          flowLabel: 'Inter-Branch Transfer In',
          quantity: transferQty,
          unit: ing.unit,
          unitCost: ing.costPerUnit,
          totalValue: transferQty * ing.costPerUnit,
          reference: `TRF-BGC-${loc.code}`,
          recordedBy: loc.manager,
          notes: 'Emergency transfer from BGC central commissary.',
        });
      }

      // 2. OUTFLOW: Kitchen Prep & Dine-In Sales Depletion (Every day)
      // High volume items like flour, cheese, tomatoes, meats depleted daily
      keyIngredients.forEach((ing, ingIdx) => {
        // Not all ingredients used in massive quantities every single day
        if (ingIdx % 2 === (dayOffset % 2) || ing.category === 'Dairy & Cheese' || ing.category === 'Produce' || ing.category === 'Dry Goods & Flour') {
          const baseDailyUse = (ing.parLevel * 0.12 + (ingIdx * 0.8)) * locVolumeMultiplier * weekendMultiplier;
          const consumptionQty = Math.round(baseDailyUse * 10) / 10;
          if (consumptionQty > 0) {
            records.push({
              id: `mov-out-sales-${dateStr}-${loc.id}-${ing.id}`,
              date: dateStr,
              timestamp: `${dateStr} 22:30:00`,
              ingredientId: ing.id,
              ingredientName: ing.name,
              category: ing.category,
              locationId: loc.id,
              locationName: loc.name,
              type: 'outflow',
              flowType: 'sales_consumption',
              flowLabel: 'Kitchen Orders Depletion',
              quantity: consumptionQty,
              unit: ing.unit,
              unitCost: ing.costPerUnit,
              totalValue: Math.round(consumptionQty * ing.costPerUnit * 100) / 100,
              reference: `POS-CLOSE-${loc.code}-${dateStr.slice(5).replace('-', '')}`,
              recordedBy: 'Automated POS Recipe Deduction',
              notes: 'POS ticket recipe explosion sync.',
            });
          }
        }
      });

      // 3. OUTFLOW: Waste / Spoilage / Trim Loss (approx 2-3 times a week)
      if (dayOfWeek === 2 || dayOfWeek === 5) {
        const wasteIng = keyIngredients[(dayOffset + locIndex * 2) % 4]; // Produce or dairy
        const wasteQty = Math.round((wasteIng.parLevel * 0.035 + 0.4) * 10) / 10;
        records.push({
          id: `mov-out-waste-${dateStr}-${loc.id}-${wasteIng.id}`,
          date: dateStr,
          timestamp: `${dateStr} 15:00:00`,
          ingredientId: wasteIng.id,
          ingredientName: wasteIng.name,
          category: wasteIng.category,
          locationId: loc.id,
          locationName: loc.name,
          type: 'outflow',
          flowType: 'waste_spoilage',
          flowLabel: 'Prep Trim & Spoilage',
          quantity: wasteQty,
          unit: wasteIng.unit,
          unitCost: wasteIng.costPerUnit,
          totalValue: Math.round(wasteQty * wasteIng.costPerUnit * 100) / 100,
          reference: `WST-${loc.code}-${dateStr.slice(8)}`,
          recordedBy: loc.manager,
          notes: 'Standard prep trim & shelf-life audit discrepancy.',
        });
      }
    });
  }

  // Sort descending by timestamp
  return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// Storage service accessor
export const StockMovementService = {
  getMovements(): StockMovementRecord[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = generateSeedStockMovements();
      this.saveMovements(initial);
      return initial;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const initial = generateSeedStockMovements();
        this.saveMovements(initial);
        return initial;
      }
      return parsed;
    } catch {
      const initial = generateSeedStockMovements();
      this.saveMovements(initial);
      return initial;
    }
  },

  saveMovements(records: StockMovementRecord[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  },

  addMovement(record: Omit<StockMovementRecord, 'id' | 'timestamp'>): StockMovementRecord {
    const records = this.getMovements();
    const newRecord: StockMovementRecord = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ...record,
    };
    const updated = [newRecord, ...records];
    this.saveMovements(updated);
    return newRecord;
  },
};

// Aggregation interfaces for D3 rendering
export interface DailyStockAggregate {
  date: string; // YYYY-MM-DD
  dateObj: Date;
  formattedDate: string; // "Sep 18"
  inflowValue: number; // ₱ PHP
  outflowValue: number; // ₱ PHP
  netValue: number; // inflow - outflow
  inflowQty: number;
  outflowQty: number;
  netQty: number;
  cumulativeNetValue: number;
  locationBreakdown: Record<
    string,
    {
      inflowValue: number;
      outflowValue: number;
      netValue: number;
      inflowQty: number;
      outflowQty: number;
    }
  >;
  topInflows: { name: string; value: number; qty: number; unit: string }[];
  topOutflows: { name: string; value: number; qty: number; unit: string }[];
}

export interface StockMovementSummary {
  totalInflowValue: number;
  totalOutflowValue: number;
  netValue: number;
  totalInflowQty: number;
  totalOutflowQty: number;
  wasteValue: number;
  wastePercentage: number;
  inflowOutflowRatio: number;
  peakInflowDay: { date: string; value: number };
  peakOutflowDay: { date: string; value: number };
  locationStats: Record<
    string,
    {
      locationId: string;
      locationName: string;
      inflowValue: number;
      outflowValue: number;
      netValue: number;
      inflowQty: number;
      outflowQty: number;
      recordsCount: number;
    }
  >;
}

export function filterAndAggregateStockMovements(
  records: StockMovementRecord[],
  options: {
    locationId: string; // 'all' or specific location ID
    ingredientId: string; // 'all' or specific ingredient ID
    category: string; // 'all' or specific category
    timeRangeDays: number; // 7, 14, or 30
    locations: Location[];
  }
): {
  dailyAggregates: DailyStockAggregate[];
  summary: StockMovementSummary;
  filteredRecords: StockMovementRecord[];
} {
  const { locationId, ingredientId, category, timeRangeDays, locations } = options;

  // Compute cutoff date
  const now = new Date(2026, 8, 24); // Sept 24, 2026 anchor
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - timeRangeDays + 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // 1. Filter raw records
  const filtered = records.filter((r) => {
    if (r.date < cutoffStr) return false;
    if (locationId !== 'all' && r.locationId !== locationId) return false;
    if (ingredientId !== 'all' && r.ingredientId !== ingredientId) return false;
    if (category !== 'all' && r.category !== category) return false;
    return true;
  });

  // 2. Generate contiguous dates for the time window
  const dateMap = new Map<string, DailyStockAggregate>();
  for (let i = 0; i < timeRangeDays; i++) {
    const d = new Date(cutoff);
    d.setDate(cutoff.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const dayNum = d.getDate();

    const locInitialBreakdown: DailyStockAggregate['locationBreakdown'] = {};
    locations.forEach((loc) => {
      locInitialBreakdown[loc.id] = {
        inflowValue: 0,
        outflowValue: 0,
        netValue: 0,
        inflowQty: 0,
        outflowQty: 0,
      };
    });

    dateMap.set(dStr, {
      date: dStr,
      dateObj: d,
      formattedDate: `${month} ${dayNum}`,
      inflowValue: 0,
      outflowValue: 0,
      netValue: 0,
      inflowQty: 0,
      outflowQty: 0,
      netQty: 0,
      cumulativeNetValue: 0,
      locationBreakdown: locInitialBreakdown,
      topInflows: [],
      topOutflows: [],
    });
  }

  // Intermediate ingredient tracker per date
  const dailyIngTracker = new Map<string, { inflows: Map<string, { name: string; value: number; qty: number; unit: string }>; outflows: Map<string, { name: string; value: number; qty: number; unit: string }> }>();

  // Summary accumulator
  let totalInflowValue = 0;
  let totalOutflowValue = 0;
  let totalInflowQty = 0;
  let totalOutflowQty = 0;
  let wasteValue = 0;

  const locStats: StockMovementSummary['locationStats'] = {};
  locations.forEach((loc) => {
    locStats[loc.id] = {
      locationId: loc.id,
      locationName: loc.name,
      inflowValue: 0,
      outflowValue: 0,
      netValue: 0,
      inflowQty: 0,
      outflowQty: 0,
      recordsCount: 0,
    };
  });

  // Populate aggregates
  filtered.forEach((r) => {
    const agg = dateMap.get(r.date);
    if (!agg) return;

    if (!dailyIngTracker.has(r.date)) {
      dailyIngTracker.set(r.date, { inflows: new Map(), outflows: new Map() });
    }
    const dayTracker = dailyIngTracker.get(r.date)!;

    if (r.type === 'inflow') {
      agg.inflowValue += r.totalValue;
      agg.inflowQty += r.quantity;
      totalInflowValue += r.totalValue;
      totalInflowQty += r.quantity;

      if (agg.locationBreakdown[r.locationId]) {
        agg.locationBreakdown[r.locationId].inflowValue += r.totalValue;
        agg.locationBreakdown[r.locationId].inflowQty += r.quantity;
      }

      if (locStats[r.locationId]) {
        locStats[r.locationId].inflowValue += r.totalValue;
        locStats[r.locationId].inflowQty += r.quantity;
        locStats[r.locationId].recordsCount += 1;
      }

      // Track top ingredients
      const existing = dayTracker.inflows.get(r.ingredientId);
      if (existing) {
        existing.value += r.totalValue;
        existing.qty += r.quantity;
      } else {
        dayTracker.inflows.set(r.ingredientId, {
          name: r.ingredientName,
          value: r.totalValue,
          qty: r.quantity,
          unit: r.unit,
        });
      }
    } else {
      agg.outflowValue += r.totalValue;
      agg.outflowQty += r.quantity;
      totalOutflowValue += r.totalValue;
      totalOutflowQty += r.quantity;

      if (r.flowType === 'waste_spoilage') {
        wasteValue += r.totalValue;
      }

      if (agg.locationBreakdown[r.locationId]) {
        agg.locationBreakdown[r.locationId].outflowValue += r.totalValue;
        agg.locationBreakdown[r.locationId].outflowQty += r.quantity;
      }

      if (locStats[r.locationId]) {
        locStats[r.locationId].outflowValue += r.totalValue;
        locStats[r.locationId].outflowQty += r.quantity;
        locStats[r.locationId].recordsCount += 1;
      }

      // Track top ingredients
      const existing = dayTracker.outflows.get(r.ingredientId);
      if (existing) {
        existing.value += r.totalValue;
        existing.qty += r.quantity;
      } else {
        dayTracker.outflows.set(r.ingredientId, {
          name: r.ingredientName,
          value: r.totalValue,
          qty: r.quantity,
          unit: r.unit,
        });
      }
    }
  });

  // Calculate net, cumulative, top items, and peak days
  let runningCumulative = 0;
  let peakInflowDay = { date: '', value: 0 };
  let peakOutflowDay = { date: '', value: 0 };

  const sortedDates = Array.from(dateMap.keys()).sort();
  const dailyAggregates: DailyStockAggregate[] = sortedDates.map((dStr) => {
    const agg = dateMap.get(dStr)!;
    agg.netValue = agg.inflowValue - agg.outflowValue;
    agg.netQty = agg.inflowQty - agg.outflowQty;
    runningCumulative += agg.netValue;
    agg.cumulativeNetValue = runningCumulative;

    // Attach top inflows / outflows
    const tracker = dailyIngTracker.get(dStr);
    if (tracker) {
      agg.topInflows = Array.from(tracker.inflows.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
      agg.topOutflows = Array.from(tracker.outflows.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);
    }

    if (agg.inflowValue > peakInflowDay.value) {
      peakInflowDay = { date: agg.formattedDate, value: agg.inflowValue };
    }
    if (agg.outflowValue > peakOutflowDay.value) {
      peakOutflowDay = { date: agg.formattedDate, value: agg.outflowValue };
    }

    // Update location net values
    Object.keys(agg.locationBreakdown).forEach((locId) => {
      const item = agg.locationBreakdown[locId];
      item.netValue = item.inflowValue - item.outflowValue;
    });

    return agg;
  });

  // Update locStats net values
  Object.keys(locStats).forEach((locId) => {
    locStats[locId].netValue = locStats[locId].inflowValue - locStats[locId].outflowValue;
  });

  const netValue = totalInflowValue - totalOutflowValue;
  const wastePercentage = totalOutflowValue > 0 ? (wasteValue / totalOutflowValue) * 100 : 0;
  const inflowOutflowRatio = totalOutflowValue > 0 ? totalInflowValue / totalOutflowValue : 1;

  const summary: StockMovementSummary = {
    totalInflowValue,
    totalOutflowValue,
    netValue,
    totalInflowQty,
    totalOutflowQty,
    wasteValue,
    wastePercentage,
    inflowOutflowRatio,
    peakInflowDay,
    peakOutflowDay,
    locationStats: locStats,
  };

  return {
    dailyAggregates,
    summary,
    filteredRecords: filtered,
  };
}
