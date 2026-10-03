import { MenuItem, Ingredient, RecipeIngredient } from '../types';

export interface RecipeCostBreakdown {
  rawIngredientsCost: number;
  wasteAdjustedCost: number;
  prepLaborCost: number;
  packagingCost: number;
  totalCostPerPortion: number;
  sellingPrice: number;
  foodCostPercent: number;
  grossMarginAmount: number;
  grossMarginPercent: number;
  markupMultiplier: number;
  monthlyRevenue: number;
  monthlyCOGS: number;
  monthlyGrossProfit: number;
  totalMonthlyUnits: number;
  ingredientDetails: {
    ingredient: Ingredient | undefined;
    quantity: number;
    unit: string;
    wastePercent: number;
    baseUnitCost: number;
    rawCost: number;
    effectiveCost: number; // cost after accounting for yield/shrinkage
  }[];
}

export function calculateRecipeCost(
  menuItem: MenuItem,
  ingredients: Ingredient[],
  laborRatePerHour: number = 24.00,
  targetLocationId?: string
): RecipeCostBreakdown {
  const ingMap = new Map(ingredients.map((ing) => [ing.id, ing]));

  let rawTotal = 0;
  let wasteAdjustedTotal = 0;

  const ingredientDetails = menuItem.ingredients.map((item) => {
    const ing = ingMap.get(item.ingredientId);
    const baseCost = ing ? ing.costPerUnit : 0;
    const rawCost = item.quantity * baseCost;
    
    // Shrinkage/trim waste adjustment formula:
    // If waste is 10%, edible yield is 90%. Real cost per usable portion is rawCost / (1 - waste% / 100)
    const yieldMultiplier = item.wastePercent > 0 ? 1 / Math.max(0.01, (1 - item.wastePercent / 100)) : 1;
    const effectiveCost = rawCost * yieldMultiplier;

    rawTotal += rawCost;
    wasteAdjustedTotal += effectiveCost;

    return {
      ingredient: ing,
      quantity: item.quantity,
      unit: item.unit,
      wastePercent: item.wastePercent,
      baseUnitCost: baseCost,
      rawCost,
      effectiveCost,
    };
  });

  const portions = menuItem.portionYield || 1;
  const rawCostPerPortion = rawTotal / portions;
  const wasteAdjustedCostPerPortion = wasteAdjustedTotal / portions;

  // Prep labor cost = (laborRate / 60) * minutes
  const prepLaborCost = (laborRatePerHour / 60) * (menuItem.prepLaborMinutes || 0);
  const packagingCost = menuItem.packagingCost || 0;

  const totalCostPerPortion = wasteAdjustedCostPerPortion + prepLaborCost + packagingCost;
  const sellingPrice = menuItem.sellingPrice || 0;
  
  const foodCostPercent = sellingPrice > 0 ? (totalCostPerPortion / sellingPrice) * 100 : 0;
  const grossMarginAmount = Math.max(0, sellingPrice - totalCostPerPortion);
  const grossMarginPercent = sellingPrice > 0 ? (grossMarginAmount / sellingPrice) * 100 : 0;
  const markupMultiplier = totalCostPerPortion > 0 ? sellingPrice / totalCostPerPortion : 0;

  // Calculate monthly metrics
  let totalMonthlyUnits = 0;
  if (targetLocationId && menuItem.monthlySalesUnits[targetLocationId] !== undefined) {
    totalMonthlyUnits = menuItem.monthlySalesUnits[targetLocationId];
  } else {
    totalMonthlyUnits = Object.values(menuItem.monthlySalesUnits).reduce((sum, v) => sum + v, 0);
  }

  const monthlyRevenue = totalMonthlyUnits * sellingPrice;
  const monthlyCOGS = totalMonthlyUnits * totalCostPerPortion;
  const monthlyGrossProfit = totalMonthlyUnits * grossMarginAmount;

  return {
    rawIngredientsCost: rawCostPerPortion,
    wasteAdjustedCost: wasteAdjustedCostPerPortion,
    prepLaborCost,
    packagingCost,
    totalCostPerPortion,
    sellingPrice,
    foodCostPercent,
    grossMarginAmount,
    grossMarginPercent,
    markupMultiplier,
    monthlyRevenue,
    monthlyCOGS,
    monthlyGrossProfit,
    totalMonthlyUnits,
    ingredientDetails,
  };
}

export type MenuMatrixClassification = 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';

export interface MenuEngineeringItem {
  menuItem: MenuItem;
  breakdown: RecipeCostBreakdown;
  classification: MenuMatrixClassification;
  marginClassification: 'High' | 'Low';
  popularityClassification: 'High' | 'Low';
}

export function analyzeMenuEngineering(
  menuItems: MenuItem[],
  ingredients: Ingredient[],
  laborRatePerHour: number = 24.00,
  targetLocationId?: string
): {
  items: MenuEngineeringItem[];
  averageMargin: number;
  medianSalesUnits: number;
  totalMonthlyRevenue: number;
  totalMonthlyCOGS: number;
  overallFoodCostPercent: number;
} {
  const analyzed = menuItems.map((item) => {
    const breakdown = calculateRecipeCost(item, ingredients, laborRatePerHour, targetLocationId);
    return {
      menuItem: item,
      breakdown,
    };
  });

  if (analyzed.length === 0) {
    return {
      items: [],
      averageMargin: 0,
      medianSalesUnits: 0,
      totalMonthlyRevenue: 0,
      totalMonthlyCOGS: 0,
      overallFoodCostPercent: 0,
    };
  }

  const totalMargin = analyzed.reduce((sum, a) => sum + a.breakdown.grossMarginAmount, 0);
  const averageMargin = totalMargin / analyzed.length;

  const salesUnits = analyzed.map((a) => a.breakdown.totalMonthlyUnits).sort((a, b) => a - b);
  const midIndex = Math.floor(salesUnits.length / 2);
  const medianSalesUnits = salesUnits.length % 2 !== 0 
    ? salesUnits[midIndex] 
    : (salesUnits[midIndex - 1] + salesUnits[midIndex]) / 2;

  const totalMonthlyRevenue = analyzed.reduce((sum, a) => sum + a.breakdown.monthlyRevenue, 0);
  const totalMonthlyCOGS = analyzed.reduce((sum, a) => sum + a.breakdown.monthlyCOGS, 0);
  const overallFoodCostPercent = totalMonthlyRevenue > 0 ? (totalMonthlyCOGS / totalMonthlyRevenue) * 100 : 0;

  const items: MenuEngineeringItem[] = analyzed.map(({ menuItem, breakdown }) => {
    const isHighMargin = breakdown.grossMarginAmount >= averageMargin;
    const isHighPopularity = breakdown.totalMonthlyUnits >= medianSalesUnits;

    let classification: MenuMatrixClassification = 'Dog';
    if (isHighMargin && isHighPopularity) {
      classification = 'Star'; // Keep quality high, promote heavily
    } else if (!isHighMargin && isHighPopularity) {
      classification = 'Plowhorse'; // High volume, low margin -> increase price or reduce portion/waste
    } else if (isHighMargin && !isHighPopularity) {
      classification = 'Puzzle'; // High margin, low sales -> reposition, improve visibility
    } else {
      classification = 'Dog'; // Low margin, low sales -> consider 86-ing or reformulating
    }

    return {
      menuItem,
      breakdown,
      classification,
      marginClassification: isHighMargin ? 'High' : 'Low',
      popularityClassification: isHighPopularity ? 'High' : 'Low',
    };
  });

  return {
    items,
    averageMargin,
    medianSalesUnits,
    totalMonthlyRevenue,
    totalMonthlyCOGS,
    overallFoodCostPercent,
  };
}

export function calculateInventoryTurnover(
  monthlyCOGS: number,
  totalInventoryValue: number
): {
  turnoverRatio: number; // Annually: (monthlyCOGS * 12) / InventoryValue
  daysOnHand: number;
} {
  if (totalInventoryValue <= 0) return { turnoverRatio: 0, daysOnHand: 0 };
  const annualizedCOGS = monthlyCOGS * 12;
  const turnoverRatio = annualizedCOGS / totalInventoryValue;
  const daysOnHand = turnoverRatio > 0 ? 365 / turnoverRatio : 0;
  return { turnoverRatio, daysOnHand };
}
