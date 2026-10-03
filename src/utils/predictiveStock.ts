import {
  Ingredient,
  AuditLog,
  StockMovementRecord,
  PredictiveStockInsight,
  PredictiveUrgency,
  AuditDataPoint,
} from '../types';

export interface PredictiveScenarioOptions {
  horizonDays: number; // default 7 days
  bufferPct: number; // default 20%
  weekendSurge: boolean; // default true (+15% weekend spike)
}

export const DEFAULT_PREDICTIVE_OPTIONS: PredictiveScenarioOptions = {
  horizonDays: 7,
  bufferPct: 20,
  weekendSurge: true,
};

// Day-of-week weight for restaurants (Fri, Sat, Sun are higher volume)
const DAY_WEIGHTS = [1.5, 0.85, 0.9, 0.95, 1.1, 1.45, 1.6]; // Sun=0, Mon=1, ..., Sat=6

/**
 * Extracts and parses audit log records related to inventory consumption or adjustments
 */
function extractAuditDataPointsForIngredient(
  ingredient: Ingredient,
  auditLogs: AuditLog[],
  locationId: string
): AuditDataPoint[] {
  const ingNameLower = ingredient.name.toLowerCase();
  const searchTerms = [
    ingNameLower,
    ingredient.name.split(' ')[0].toLowerCase(), // e.g. "caputo", "wagyu", "mozzarella"
    ingredient.category.toLowerCase(),
  ];

  const matched: AuditDataPoint[] = [];

  for (const log of auditLogs) {
    if (log.category !== 'inventory' && log.category !== 'costing') continue;
    if (locationId !== 'all' && log.locationId !== locationId) continue;

    const detailsLower = (log.details + ' ' + log.action).toLowerCase();
    const isMatch = searchTerms.some((term) => detailsLower.includes(term));

    if (isMatch) {
      // Try to parse quantity from text if available (e.g. "-4.8kg", "12.5 kg")
      let parsedQty: number | undefined;
      const qtyMatch = log.details.match(/([+-]?\d+(?:\.\d+)?)\s*(?:kg|g|l|ml|units?|portions?)/i);
      if (qtyMatch && qtyMatch[1]) {
        parsedQty = Math.abs(parseFloat(qtyMatch[1]));
      }

      matched.push({
        id: log.id,
        date: log.timestamp.slice(0, 10),
        timestamp: log.timestamp,
        action: log.action,
        details: log.details,
        source: 'Audit Log Ledger',
        quantity: parsedQty,
        userName: log.userName,
      });
    }
  }

  return matched;
}

/**
 * Computes predictive stock usage, daily burn rates, and suggested weekly purchase orders
 */
export function calculatePredictiveStockUsage(
  ingredients: Ingredient[],
  auditLogs: AuditLog[],
  stockMovements: StockMovementRecord[],
  locationId: string = 'all',
  options: PredictiveScenarioOptions = DEFAULT_PREDICTIVE_OPTIONS
): PredictiveStockInsight[] {
  const { horizonDays, bufferPct, weekendSurge } = options;
  const baseDate = new Date(); // Current date context

  return ingredients.map((ing) => {
    // 1. Current stock at the requested location or sum across all
    let currentStock = 0;
    if (locationId === 'all') {
      currentStock = Object.values(ing.stockByLocation).reduce(
        (sum, locStock) => sum + (locStock?.quantity || 0),
        0
      );
    } else {
      currentStock = ing.stockByLocation[locationId]?.quantity || 0;
    }

    // 2. Audit logs correlation
    const auditPoints = extractAuditDataPointsForIngredient(ing, auditLogs, locationId);

    // 3. Stock movements outflow correlation (last 30 days)
    const matchingMovements = stockMovements.filter((m) => {
      const matchLoc = locationId === 'all' || m.locationId === locationId;
      return m.ingredientId === ing.id && matchLoc;
    });

    const outflowMovements = matchingMovements.filter((m) => m.type === 'outflow');

    // 4. Calculate historical daily burn rate
    let dailyBurnRate = 0;
    let recentWeekOutflow = 0;
    let priorWeekOutflow = 0;

    // Filter by days
    const nowMs = baseDate.getTime();
    const msInDay = 86400000;

    if (outflowMovements.length > 0) {
      let totalOutflow = 0;
      const activeDays = new Set<string>();

      outflowMovements.forEach((m) => {
        totalOutflow += m.quantity;
        activeDays.add(m.date);

        const recordDate = new Date(m.date).getTime();
        const diffDays = (nowMs - recordDate) / msInDay;
        if (diffDays <= 7) {
          recentWeekOutflow += m.quantity;
        } else if (diffDays <= 14) {
          priorWeekOutflow += m.quantity;
        }
      });

      const dayCount = Math.max(14, activeDays.size);
      dailyBurnRate = totalOutflow / dayCount;
    } else {
      // Fallback: estimate from par level velocity
      dailyBurnRate = Math.max(0.2, ing.parLevel * 0.16);
      recentWeekOutflow = dailyBurnRate * 7;
      priorWeekOutflow = dailyBurnRate * 7;
    }

    // Blend in parsed quantities from audit logs if present
    const auditQtys = auditPoints.map((p) => p.quantity).filter((q): q is number => q !== undefined && q > 0);
    if (auditQtys.length > 0) {
      const avgAuditBurn = auditQtys.reduce((a, b) => a + b, 0) / auditQtys.length;
      // Weighted average with movements
      dailyBurnRate = dailyBurnRate * 0.75 + avgAuditBurn * 0.25;
    }

    // Ensure clean decimal
    dailyBurnRate = Math.round(dailyBurnRate * 100) / 100;

    // 5. Trend Velocity (% change recent vs prior week)
    let trendPercent = 0;
    if (priorWeekOutflow > 0) {
      trendPercent = Math.round(((recentWeekOutflow - priorWeekOutflow) / priorWeekOutflow) * 100);
    }
    const trendVelocity: 'up' | 'stable' | 'down' =
      trendPercent > 6 ? 'up' : trendPercent < -6 ? 'down' : 'stable';

    // 6. Days of stock remaining (Runout horizon)
    const daysRemaining = dailyBurnRate > 0
      ? Math.max(0, Math.round((currentStock / dailyBurnRate) * 10) / 10)
      : 99;

    // Runout date string
    const runoutDateObj = new Date(baseDate);
    runoutDateObj.setDate(runoutDateObj.getDate() + Math.min(365, Math.floor(daysRemaining)));
    const runoutDate = runoutDateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });

    // 7. Projected Demand over scenario horizon
    const surgeFactor = weekendSurge ? 1.12 : 1.0;
    const projectedWeeklyDemand = Math.round(dailyBurnRate * horizonDays * surgeFactor * 10) / 10;

    // 8. Dynamic Safety Buffer (based on supplier lead time & par level volatility)
    const leadTimeDays = ing.category === 'Produce' || ing.category === 'Dairy & Cheese' ? 1 : 2;
    const safetyStockBuffer = Math.round(projectedWeeklyDemand * (bufferPct / 100) * 10) / 10;

    // 9. Suggested Weekly PO Quantity
    // Target stock needed to comfortably survive horizon + safety buffer
    const grossNeeded = projectedWeeklyDemand + safetyStockBuffer;
    const rawSuggestedPO = Math.max(0, grossNeeded - currentStock);

    // Practical purchasing pack size rounding (minimum increment 0.5 or 1.0)
    let suggestedWeeklyPO = rawSuggestedPO;
    if (ing.unit === 'g' || ing.unit === 'ml') {
      suggestedWeeklyPO = Math.ceil(rawSuggestedPO / 50) * 50;
    } else if (suggestedWeeklyPO > 0) {
      suggestedWeeklyPO = Math.ceil(suggestedWeeklyPO * 2) / 2; // round to nearest 0.5
    }

    const suggestedPOCost = Math.round(suggestedWeeklyPO * ing.costPerUnit * 100) / 100;

    // 10. Urgency Rating & Action Recommendation
    let urgency: PredictiveUrgency = 'optimal';
    let urgencyLabel = 'Optimal Par';
    let recommendedOrderDate = 'Next Scheduled PO Cycle';

    if (daysRemaining <= 2.0 || currentStock <= ing.minThreshold) {
      urgency = 'critical';
      urgencyLabel = 'Immediate Restock Needed';
      recommendedOrderDate = 'Dispatch PO Today';
    } else if (daysRemaining <= 4.5 || currentStock < ing.parLevel) {
      urgency = 'reorder';
      urgencyLabel = 'Reorder This Week';
      const orderDay = new Date(baseDate);
      orderDay.setDate(orderDay.getDate() + 1);
      recommendedOrderDate = `Order by ${orderDay.toLocaleDateString('en-US', { weekday: 'short' })} 3:00 PM`;
    } else if (daysRemaining > 12.0) {
      urgency = 'surplus';
      urgencyLabel = 'Surplus Capital / Well-Stocked';
      recommendedOrderDate = 'Snooze Reorder';
    }

    // 11. Day-by-Day 7-Day Depletion Forecast Array
    const dailyProjectedUsage: PredictiveStockInsight['dailyProjectedUsage'] = [];
    let rollingStock = currentStock;

    for (let d = 1; d <= 7; d++) {
      const forecastDay = new Date(baseDate);
      forecastDay.setDate(forecastDay.getDate() + d);
      const dayOfWeek = forecastDay.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
      const dayWeight = DAY_WEIGHTS[dayOfWeek];

      const dayBurn = Math.round(dailyBurnRate * dayWeight * 10) / 10;
      rollingStock = Math.max(0, Math.round((rollingStock - dayBurn) * 10) / 10);

      dailyProjectedUsage.push({
        dayName: forecastDay.toLocaleDateString('en-US', { weekday: 'short' }),
        date: forecastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        projectedQty: dayBurn,
        projectedStockRemaining: rollingStock,
        isWeekend,
      });
    }

    return {
      ingredientId: ing.id,
      ingredientName: ing.name,
      category: ing.category,
      supplier: ing.supplier,
      unit: ing.unit,
      unitCost: ing.costPerUnit,
      currentStock,
      parLevel: ing.parLevel,
      minThreshold: ing.minThreshold,
      avgDailyBurnRate: dailyBurnRate,
      daysRemaining,
      runoutDate,
      projectedWeeklyDemand,
      suggestedWeeklyPO,
      suggestedPOCost,
      urgency,
      urgencyLabel,
      trendVelocity,
      trendPercent,
      leadTimeDays,
      recommendedOrderDate,
      safetyStockBuffer,
      historicalAuditEventsCount: auditPoints.length + matchingMovements.length,
      recentAuditPoints: auditPoints.slice(0, 5),
      dailyProjectedUsage,
    };
  });
}
