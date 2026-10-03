import React, { useState } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  Sliders,
  DollarSign,
  Percent,
  Layers,
  Sparkles,
  AlertTriangle,
  Scale,
  Save,
  CheckCircle2,
  ChefHat,
  Lock,
  ArrowRight,
  TrendingUp,
  Copy,
  Tag,
  Star,
  Target,
  Check,
  Zap,
} from 'lucide-react';
import { MenuItem, Ingredient, RecipeIngredient, User, AppSettings } from '../types';
import { calculateRecipeCost } from '../utils/costing';
import { AddRecipeModal } from './AddRecipeModal';

interface FoodCostCalculatorProps {
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  selectedItemId: string;
  onSelectMenuItem: (id: string) => void;
  onSaveMenuItem: (updatedItem: MenuItem) => void;
  onAddMenuItem?: (newItem: MenuItem) => void;
  onDeleteMenuItem?: (itemId: string) => void;
  currentUser: User;
  laborRatePerHour: number;
  targetFoodCostPct: number;
  targetProfitMarginPct?: number;
  settings?: AppSettings;
}

export const FoodCostCalculator: React.FC<FoodCostCalculatorProps> = ({
  menuItems,
  ingredients,
  selectedItemId,
  onSelectMenuItem,
  onSaveMenuItem,
  onAddMenuItem,
  onDeleteMenuItem,
  currentUser,
  laborRatePerHour,
  targetFoodCostPct,
  targetProfitMarginPct,
  settings,
}) => {
  const currentItem =
    menuItems.find((m) => m.id === selectedItemId) || menuItems[0];

  // Local draft state for editing recipe
  const [draftRecipe, setDraftRecipe] = useState<MenuItem>(currentItem);
  const [batchScale, setBatchScale] = useState<number>(1);
  const [whatIfCostChange, setWhatIfCostChange] = useState<number>(0); // e.g. +10% wholesale cost increase
  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState<boolean>(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState<boolean>(false);
  const [cloneTemplateItem, setCloneTemplateItem] = useState<MenuItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Target profit margin from AppSettings, with interactive simulation override support
  const baseTargetProfitMarginPct =
    targetProfitMarginPct ?? (settings?.targetProfitMarginPct ?? parseFloat((100 - targetFoodCostPct).toFixed(1)));
  const [simulatedMarginPct, setSimulatedMarginPct] = useState<number | null>(null);
  const activeTargetProfitMarginPct = simulatedMarginPct ?? baseTargetProfitMarginPct;

  // Rounding options for optimal pricing strategy
  const [roundingStrategy, setRoundingStrategy] = useState<'nearest5' | 'nearest10' | 'exact'>('nearest5');
  const [optimalPriceAppliedNotice, setOptimalPriceAppliedNotice] = useState<string | null>(null);

  // Sync draft recipe when selected item changes
  React.useEffect(() => {
    if (currentItem) {
      setDraftRecipe(currentItem);
    }
  }, [selectedItemId]);

  // Check RBAC permissions: Kitchen staff have restricted access to financial margins & wholesale price changes
  const canEditFinancials = currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'chef';

  // Apply What-If scenario to ingredients
  const simulatedIngredients = ingredients.map((ing) => {
    if (whatIfCostChange === 0) return ing;
    return {
      ...ing,
      costPerUnit: ing.costPerUnit * (1 + whatIfCostChange / 100),
    };
  });

  const breakdown = calculateRecipeCost(draftRecipe, simulatedIngredients, laborRatePerHour);

  // Target price calculation to hit target food cost % (e.g. 28.5%)
  const suggestedTargetPrice =
    targetFoodCostPct > 0 ? breakdown.totalCostPerPortion / (targetFoodCostPct / 100) : 0;

  // Optimal price calculation based on calculated food cost and target profit margin % from AppSettings:
  // Formula: Optimal Price = Cost / (1 - (Profit Margin % / 100))
  const costPerPortion = breakdown.totalCostPerPortion;
  const marginFraction = Math.min(0.95, Math.max(0.05, activeTargetProfitMarginPct / 100));
  const exactOptimalPrice = costPerPortion > 0 ? costPerPortion / (1 - marginFraction) : 0;

  // Rounding options for real-world restaurant pricing in PHP
  const nearest5OptimalPrice = Math.ceil(exactOptimalPrice / 5) * 5;
  const nearest10OptimalPrice = Math.ceil(exactOptimalPrice / 10) * 10;

  const selectedOptimalPrice =
    roundingStrategy === 'exact'
      ? exactOptimalPrice
      : roundingStrategy === 'nearest5'
      ? nearest5OptimalPrice
      : nearest10OptimalPrice;

  // Pricing analysis vs current menu price
  const isTargetMarginAchieved = draftRecipe.sellingPrice >= exactOptimalPrice - 0.05;
  const priceVariance = draftRecipe.sellingPrice - selectedOptimalPrice;
  const marginVariance = breakdown.grossMarginPercent - activeTargetProfitMarginPct;
  const optimalProfitAmount = selectedOptimalPrice - costPerPortion;
  const currentProfitAmount = breakdown.grossMarginAmount;
  const profitShortfall = Math.max(0, optimalProfitAmount - currentProfitAmount);

  // 1-Click apply handler to set optimal price
  const handleApplyOptimalPrice = (priceToApply: number) => {
    setDraftRecipe((prev) => ({
      ...prev,
      sellingPrice: priceToApply,
    }));
    setOptimalPriceAppliedNotice(`Optimal price ₱${priceToApply.toFixed(2)} applied to recipe!`);
    setTimeout(() => setOptimalPriceAppliedNotice(null), 3500);
  };

  // Handlers for modifying recipe ingredients
  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...draftRecipe.ingredients];
    updated[index] = { ...updated[index], quantity: Math.max(0, quantity) };
    setDraftRecipe({ ...draftRecipe, ingredients: updated });
  };

  const handleWasteChange = (index: number, wastePercent: number) => {
    const updated = [...draftRecipe.ingredients];
    updated[index] = { ...updated[index], wastePercent: Math.max(0, Math.min(90, wastePercent)) };
    setDraftRecipe({ ...draftRecipe, ingredients: updated });
  };

  const handleRemoveIngredient = (index: number) => {
    const updated = draftRecipe.ingredients.filter((_, i) => i !== index);
    setDraftRecipe({ ...draftRecipe, ingredients: updated });
  };

  const handleAddIngredient = (ingredientId: string) => {
    const ing = ingredients.find((i) => i.id === ingredientId);
    if (!ing) return;
    const newEntry: RecipeIngredient = {
      ingredientId: ing.id,
      quantity: 0.1,
      unit: ing.unit,
      wastePercent: 5,
    };
    setDraftRecipe({
      ...draftRecipe,
      ingredients: [...draftRecipe.ingredients, newEntry],
    });
    setShowAddIngredientModal(false);
  };

  const handleSave = () => {
    onSaveMenuItem(draftRecipe);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleCreatedRecipe = (newRecipe: MenuItem) => {
    if (onAddMenuItem) {
      onAddMenuItem(newRecipe);
    } else {
      onSaveMenuItem(newRecipe);
    }
    onSelectMenuItem(newRecipe.id);
    setDraftRecipe(newRecipe);
    setShowAddRecipeModal(false);
  };

  const handleDeleteCurrentRecipe = () => {
    if (onDeleteMenuItem && currentItem) {
      onDeleteMenuItem(currentItem.id);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Recipe Header & Selector */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              Real-Time Food Costing Calculator
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
              Formula Engine v2.4
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time portion cost, trim shrinkage yield adjustment, and gross profit margin forecasting.
          </p>
        </div>

        {/* Recipe Picker & Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl border border-neutral-300 dark:border-neutral-700">
            <span className="text-[10px] font-bold text-neutral-500 uppercase px-1.5 hidden sm:inline">
              Recipe:
            </span>
            <select
              value={selectedItemId}
              onChange={(e) => onSelectMenuItem(e.target.value)}
              className="px-2.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-white dark:bg-neutral-900 border-none text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (₱{item.sellingPrice.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {canEditFinancials && (
            <>
              {/* PRIMARY ADD RECIPE BUTTON */}
              <button
                type="button"
                onClick={() => {
                  setCloneTemplateItem(null);
                  setShowAddRecipeModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-all shadow-sm active:scale-95 cursor-pointer"
                title="Create and formulate a new recipe"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Recipe</span>
              </button>

              {/* CLONE AS NEW TEMPLATE */}
              <button
                type="button"
                onClick={() => {
                  setCloneTemplateItem(draftRecipe);
                  setShowAddRecipeModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 transition-colors"
                title="Duplicate this recipe as a starting blueprint"
              >
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
                <span className="hidden md:inline">Clone</span>
              </button>

              {/* SAVE MODIFICATIONS */}
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 transition-colors shadow-sm"
              >
                {isSavedNotice ? <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-700" /> : <Save className="w-4 h-4" />}
                <span>{isSavedNotice ? 'Saved!' : 'Save Recipe'}</span>
              </button>

              {/* DELETE RECIPE */}
              {onDeleteMenuItem && menuItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-500/10 border border-neutral-200 dark:border-neutral-800 transition-colors"
                  title="Delete current recipe"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Active Recipe Header Strip */}
      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold shrink-0">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-black text-neutral-900 dark:text-white">
                {draftRecipe.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300">
                {draftRecipe.category}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  draftRecipe.status === 'active'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : draftRecipe.status === 'seasonal'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-neutral-500/15 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {draftRecipe.status === 'active'
                  ? 'Active Menu'
                  : draftRecipe.status === 'seasonal'
                  ? 'Seasonal Special'
                  : 'R&D Draft'}
              </span>
              {draftRecipe.rating && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {draftRecipe.rating.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
              {draftRecipe.description || 'Formulated with authentic Italian and local ingredients.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={() => {
              setCloneTemplateItem(null);
              setShowAddRecipeModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Recipe Formulation</span>
          </button>
        </div>
      </div>

      {/* Main Calculation Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Cost Per Portion */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
            Cost Per Portion
          </span>
          <div className="mt-2 text-2xl font-black text-neutral-900 dark:text-white">
            ₱{breakdown.totalCostPerPortion.toFixed(2)}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            Raw: ₱{breakdown.rawIngredientsCost.toFixed(2)} + Waste/Labor
          </span>
        </div>

        {/* Selling Price */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
                Menu Selling Price
              </span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isTargetMarginAchieved
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                {isTargetMarginAchieved ? 'Target Met' : 'Under Target'}
              </span>
            </div>
            {canEditFinancials ? (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-xl font-black text-neutral-400">₱</span>
                <input
                  type="number"
                  step="5.00"
                  min="0"
                  value={draftRecipe.sellingPrice}
                  onChange={(e) =>
                    setDraftRecipe({ ...draftRecipe, sellingPrice: parseFloat(e.target.value) || 0 })
                  }
                  className="w-28 px-2 py-1 text-xl font-black text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700"
                />
              </div>
            ) : (
              <div className="mt-2 text-2xl font-black text-neutral-900 dark:text-white">
                ₱{draftRecipe.sellingPrice.toFixed(2)}
              </div>
            )}
          </div>
          <div className="mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
            <span className="text-neutral-400">
              Optimal: <strong className="text-amber-500">₱{selectedOptimalPrice.toFixed(2)}</strong>
            </span>
            {canEditFinancials && draftRecipe.sellingPrice !== selectedOptimalPrice && (
              <button
                type="button"
                onClick={() => handleApplyOptimalPrice(selectedOptimalPrice)}
                className="font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 text-[10px]"
                title="Apply suggested optimal price"
              >
                <Zap className="w-2.5 h-2.5" />
                <span>Apply</span>
              </button>
            )}
          </div>
        </div>

        {/* Food Cost % Gauge */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
            Food Cost %
          </span>
          <div
            className={`mt-2 text-2xl font-black ${
              breakdown.foodCostPercent <= targetFoodCostPct
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {breakdown.foodCostPercent.toFixed(1)}%
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            {breakdown.foodCostPercent <= targetFoodCostPct ? '✅ Healthy Margin' : '⚠️ Exceeds Benchmark'}
          </span>
        </div>

        {/* Gross Profit Margin ₱ */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
            Gross Margin ₱
          </span>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            ₱{breakdown.grossMarginAmount.toFixed(2)}
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            {breakdown.grossMarginPercent.toFixed(1)}% margin contribution
          </span>
        </div>

        {/* Markup Multiplier */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
            Markup Multiplier
          </span>
          <div className="mt-2 text-2xl font-black text-sky-600 dark:text-sky-400">
            {breakdown.markupMultiplier.toFixed(2)}x
          </div>
          <span className="text-[11px] text-neutral-500 mt-1 block">
            Portions: {draftRecipe.portionYield}
          </span>
        </div>
      </div>

      {/* Optimal Selling Price Suggester Feature Panel */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-amber-500/30 dark:border-amber-500/20 shadow-sm space-y-4 relative overflow-hidden">
        {/* Subtle accent background pill */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs">
              <Target className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-neutral-900 dark:text-white tracking-tight">
                  Optimal Selling Price Suggester
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  Target Margin Engine
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Calculates the profit-maximizing menu price to achieve your target profit margin based on calculated portion cost.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
              AppSettings Target: <strong className="text-amber-600 dark:text-amber-400">{baseTargetProfitMarginPct}% Margin</strong>
            </span>
          </div>
        </div>

        {/* Notice Banner when optimal price is applied */}
        {optimalPriceAppliedNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{optimalPriceAppliedNotice}</span>
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Remember to click "Save Changes"</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Hero Recommended Price Box (5 cols) */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/70 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">
                  Suggested Optimal Selling Price
                </span>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  Target: {activeTargetProfitMarginPct}% Margin
                </span>
              </div>

              {/* Big Price Display */}
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black text-neutral-900 dark:text-white tracking-tight">
                  ₱{selectedOptimalPrice.toFixed(2)}
                </span>
                <span className="text-xs text-neutral-400 font-semibold">/ portion</span>
              </div>

              <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Calculated Portion Cost:</span>
                  <span className="font-bold">₱{costPerPortion.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Projected Gross Profit:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +₱{optimalProfitAmount.toFixed(2)} per plate
                  </span>
                </div>
              </div>
            </div>

            {/* Smart Rounding Strategy Selector */}
            <div className="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-700/60">
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 block">
                Psychological Rounding Strategy:
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRoundingStrategy('nearest5')}
                  className={`py-1.5 px-2 rounded-lg text-center transition-colors ${
                    roundingStrategy === 'nearest5'
                      ? 'bg-amber-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                  title="Round up to nearest ₱5 (e.g. ₱585.00)"
                >
                  Nearest ₱5
                </button>
                <button
                  type="button"
                  onClick={() => setRoundingStrategy('nearest10')}
                  className={`py-1.5 px-2 rounded-lg text-center transition-colors ${
                    roundingStrategy === 'nearest10'
                      ? 'bg-amber-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                  title="Round up to nearest ₱10 (e.g. ₱590.00)"
                >
                  Nearest ₱10
                </button>
                <button
                  type="button"
                  onClick={() => setRoundingStrategy('exact')}
                  className={`py-1.5 px-2 rounded-lg text-center transition-colors ${
                    roundingStrategy === 'exact'
                      ? 'bg-amber-500 text-neutral-950 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                  title="Exact unrounded mathematical price"
                >
                  Exact (₱{exactOptimalPrice.toFixed(2)})
                </button>
              </div>
            </div>

            {/* Apply Button CTA */}
            {canEditFinancials && (
              <button
                type="button"
                onClick={() => handleApplyOptimalPrice(selectedOptimalPrice)}
                disabled={draftRecipe.sellingPrice === selectedOptimalPrice}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-sm ${
                  draftRecipe.sellingPrice === selectedOptimalPrice
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-default'
                    : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 active:scale-98 cursor-pointer'
                }`}
              >
                {draftRecipe.sellingPrice === selectedOptimalPrice ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Optimal Price Active on Recipe</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-neutral-950" />
                    <span>Apply ₱{selectedOptimalPrice.toFixed(2)} to Recipe</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Right Column: Comparative Margin Benchmark & What-If Slider (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Target Margin Adjustment Simulator & Presets */}
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                  <span>Target Profit Margin Simulation</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                    {activeTargetProfitMarginPct}% Profit Margin
                  </span>
                  {simulatedMarginPct !== null && (
                    <button
                      type="button"
                      onClick={() => setSimulatedMarginPct(null)}
                      className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 underline"
                      title="Reset to AppSettings default target"
                    >
                      Reset to Default ({baseTargetProfitMarginPct}%)
                    </button>
                  )}
                </div>
              </div>

              {/* Slider */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-neutral-400">45%</span>
                <input
                  type="range"
                  min="45"
                  max="90"
                  step="0.5"
                  value={activeTargetProfitMarginPct}
                  onChange={(e) => setSimulatedMarginPct(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg"
                />
                <span className="text-[10px] font-bold text-neutral-400">90%</span>
              </div>

              {/* Quick Preset Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-neutral-400 mr-1">Presets:</span>
                {[
                  { label: '65% Volume', value: 65 },
                  { label: '70% Standard', value: 70 },
                  { label: `${baseTargetProfitMarginPct}% AppSettings`, value: baseTargetProfitMarginPct },
                  { label: '75% Specialty', value: 75 },
                  { label: '80% High Margin', value: 80 },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSimulatedMarginPct(preset.value)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors ${
                      activeTargetProfitMarginPct === preset.value
                        ? 'bg-amber-500 text-neutral-950 font-black'
                        : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comparison Matrix: Current vs Optimal */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Current Status Box */}
              <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Current Menu Pricing
                </span>
                <div className="text-base font-black text-neutral-900 dark:text-white">
                  ₱{draftRecipe.sellingPrice.toFixed(2)}
                </div>
                <div className="text-[11px] text-neutral-500 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Gross Margin:</span>
                    <strong className={isTargetMarginAchieved ? 'text-emerald-500' : 'text-amber-500'}>
                      {breakdown.grossMarginPercent.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Food Cost %:</span>
                    <span>{breakdown.foodCostPercent.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit / Plate:</span>
                    <span>₱{currentProfitAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Optimal Status Box */}
              <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                  Target Optimal Pricing
                </span>
                <div className="text-base font-black text-emerald-700 dark:text-emerald-300">
                  ₱{selectedOptimalPrice.toFixed(2)}
                </div>
                <div className="text-[11px] text-neutral-600 dark:text-neutral-300 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Target Margin:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{activeTargetProfitMarginPct}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Food Cost:</span>
                    <span>{(100 - activeTargetProfitMarginPct).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit / Plate:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₱{optimalProfitAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gap Analysis Verdict Banner */}
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                isTargetMarginAchieved
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
              }`}
            >
              {isTargetMarginAchieved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold block">
                  {isTargetMarginAchieved
                    ? 'Target Profit Margin Achieved'
                    : 'Target Profit Margin Shortfall'}
                </span>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                  {isTargetMarginAchieved
                    ? `Your current menu price of ₱${draftRecipe.sellingPrice.toFixed(2)} achieves your ${activeTargetProfitMarginPct}% target margin (${breakdown.grossMarginPercent.toFixed(1)}% actual), generating +₱${priceVariance.toFixed(2)} extra margin contribution per plate.`
                    : `Current selling price is under-priced by ₱${Math.abs(priceVariance).toFixed(2)}. You are leaving ₱${profitShortfall.toFixed(2)} gross profit per plate on the table (${Math.abs(marginVariance).toFixed(1)}% margin deficit).`}
                </p>
              </div>
            </div>

            {/* Formula Explanation Accordion/Card */}
            <div className="p-2.5 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/40 text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
              <strong>Calculation Formula:</strong> Optimal Price = Portion Cost (₱{costPerPortion.toFixed(2)}) ÷ (1 - {(activeTargetProfitMarginPct / 100).toFixed(3)}) = <strong>₱{exactOptimalPrice.toFixed(2)}</strong> (raw), rounded to <strong>₱{selectedOptimalPrice.toFixed(2)}</strong> ({roundingStrategy}).
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Controls Bar: What-If Simulator & Batch Prep Scaler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* What-If Wholesale Price Simulator */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                "What-If" Wholesale Price Inflation Simulator
              </h3>
            </div>
            <span className="text-xs font-black text-amber-700 dark:text-amber-300">
              {whatIfCostChange > 0 ? `+${whatIfCostChange}%` : `${whatIfCostChange}%`}
            </span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Simulate wholesale ingredient cost spikes to analyze the immediate impact on profit margins.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-bold text-neutral-500">0%</span>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={whatIfCostChange}
              onChange={(e) => setWhatIfCostChange(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-neutral-500">+50%</span>
          </div>

          {whatIfCostChange > 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-white dark:bg-neutral-900/80 border border-amber-500/30 text-xs flex justify-between items-center">
              <span>
                At +{whatIfCostChange}% inflation: Portion Cost increases to{' '}
                <strong className="text-red-500">₱{breakdown.totalCostPerPortion.toFixed(2)}</strong>
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                Suggested Reprice: ₱{suggestedTargetPrice.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Kitchen Batch Prep Scaler */}
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-sky-500" />
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Kitchen Batch Prep Scaler
              </h3>
            </div>
            <span className="text-xs font-black text-sky-600 dark:text-sky-400">
              {batchScale}x Batch ({batchScale * draftRecipe.portionYield} portions)
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Scale recipes automatically for large prep batches, catering trays, or lunch line service.
          </p>

          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
            {[1, 2, 5, 10, 20, 50].map((scale) => (
              <button
                key={scale}
                onClick={() => setBatchScale(scale)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  batchScale === scale
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {scale}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recipe Ingredients & Formulation Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-500" />
              <span>Recipe Formulation &amp; Shrinkage Analysis</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Ingredient quantities, trim/shrinkage waste percentages, and effective portion costing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canEditFinancials && (
              <button
                onClick={() => setShowAddIngredientModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ingredient</span>
              </button>
            )}
          </div>
        </div>

        {/* Ingredients Table - Desktop/Tablet */}
        <div className="mt-4 hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Ingredient</th>
                <th className="py-2.5 px-3">Base Cost / Unit</th>
                <th className="py-2.5 px-3">Qty (1 Portion)</th>
                {batchScale > 1 && <th className="py-2.5 px-3 text-sky-500 font-bold">Scaled Qty ({batchScale}x)</th>}
                <th className="py-2.5 px-3">Trim Waste %</th>
                <th className="py-2.5 px-3">Effective Cost</th>
                {canEditFinancials && <th className="py-2.5 px-3 text-right">Remove</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
              {breakdown.ingredientDetails.map((detail, idx) => {
                const ing = detail.ingredient;
                const scaledQty = (detail.quantity * batchScale).toFixed(3);

                return (
                  <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-neutral-900 dark:text-white">
                      {ing ? ing.name : 'Unknown Ingredient'}
                      <span className="text-[10px] text-neutral-400 block font-normal">
                        {ing?.supplier || 'Direct'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-neutral-600 dark:text-neutral-400">
                      ₱{detail.baseUnitCost.toFixed(2)} / {detail.unit}
                    </td>
                    <td className="py-3 px-3">
                      {canEditFinancials ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={detail.quantity}
                            onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white font-bold"
                          />
                          <span className="text-neutral-500">{detail.unit}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">
                          {detail.quantity} {detail.unit}
                        </span>
                      )}
                    </td>
                    {batchScale > 1 && (
                      <td className="py-3 px-3 font-black text-sky-600 dark:text-sky-400">
                        {scaledQty} {detail.unit}
                      </td>
                    )}
                    <td className="py-3 px-3">
                      {canEditFinancials ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="90"
                            value={detail.wastePercent}
                            onChange={(e) => handleWasteChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-14 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white font-bold"
                          />
                          <span className="text-neutral-500">%</span>
                        </div>
                      ) : (
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {detail.wastePercent}%
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold text-neutral-900 dark:text-white">
                      ₱{detail.effectiveCost.toFixed(2)}
                    </td>
                    {canEditFinancials && (
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleRemoveIngredient(idx)}
                          className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Remove ingredient from recipe"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Ingredients Cards - Mobile (< 768px) */}
        <div className="md:hidden mt-4 space-y-3">
          {breakdown.ingredientDetails.map((detail, idx) => {
            const ing = detail.ingredient;
            const scaledQty = (detail.quantity * batchScale).toFixed(3);

            return (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/70 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-white text-xs block">
                      {ing ? ing.name : 'Unknown Ingredient'}
                    </span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {ing?.supplier || 'Direct'} • ₱{detail.baseUnitCost.toFixed(2)} / {detail.unit}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-neutral-900 dark:text-white block">
                      ₱{detail.effectiveCost.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-neutral-400">Effective</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700/50 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
                      Portion Qty:
                    </label>
                    {canEditFinancials ? (
                      <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 px-2 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={detail.quantity}
                          onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold text-neutral-900 dark:text-white bg-transparent focus:outline-none"
                        />
                        <span className="text-[10px] text-neutral-500 font-semibold">{detail.unit}</span>
                      </div>
                    ) : (
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {detail.quantity} {detail.unit}
                      </span>
                    )}
                    {batchScale > 1 && (
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 block mt-0.5">
                        Scaled: {scaledQty} {detail.unit}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
                        Trim Waste:
                      </label>
                      {canEditFinancials && (
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(idx)}
                          className="text-red-500 hover:text-red-700 p-0.5"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {canEditFinancials ? (
                      <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 px-2 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="90"
                          value={detail.wastePercent}
                          onChange={(e) => handleWasteChange(idx, parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-bold text-neutral-900 dark:text-white bg-transparent focus:outline-none"
                        />
                        <span className="text-[10px] text-neutral-500 font-semibold">%</span>
                      </div>
                    ) : (
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">
                        {detail.wastePercent}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Labor & Packaging inputs */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
              Prep Labor Time (minutes)
            </span>
            <input
              type="number"
              min="0"
              disabled={!canEditFinancials}
              value={draftRecipe.prepLaborMinutes}
              onChange={(e) =>
                setDraftRecipe({ ...draftRecipe, prepLaborMinutes: parseInt(e.target.value) || 0 })
              }
              className="mt-1 w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
            />
            <span className="text-[11px] text-neutral-500 mt-1 block">
              Labor Cost: ₱{( (laborRatePerHour / 60) * draftRecipe.prepLaborMinutes ).toFixed(2)} (@ ₱{laborRatePerHour}/hr)
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
              Packaging &amp; To-Go Box Cost (₱)
            </span>
            <input
              type="number"
              step="1.00"
              min="0"
              disabled={!canEditFinancials}
              value={draftRecipe.packagingCost}
              onChange={(e) =>
                setDraftRecipe({ ...draftRecipe, packagingCost: parseFloat(e.target.value) || 0 })
              }
              className="mt-1 w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
            />
            <span className="text-[11px] text-neutral-500 mt-1 block">
              Eco pizza box, liners &amp; sealed sauces
            </span>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
              Portion Yield per Batch
            </span>
            <input
              type="number"
              min="1"
              disabled={!canEditFinancials}
              value={draftRecipe.portionYield}
              onChange={(e) =>
                setDraftRecipe({ ...draftRecipe, portionYield: parseInt(e.target.value) || 1 })
              }
              className="mt-1 w-full px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
            />
            <span className="text-[11px] text-neutral-500 mt-1 block">
              Standard yield: {draftRecipe.portionYield} plate(s)
            </span>
          </div>
        </div>
      </div>

      {/* Add Ingredient Modal */}
      {showAddIngredientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Select Ingredient to Add
              </h3>
              <button
                onClick={() => setShowAddIngredientModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
              {ingredients.map((ing) => (
                <div
                  key={ing.id}
                  onClick={() => handleAddIngredient(ing.id)}
                  className="py-2.5 px-3 flex items-center justify-between hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-white">{ing.name}</div>
                    <div className="text-[10px] text-neutral-400">
                      {ing.category} • ₱{ing.costPerUnit.toFixed(2)} / {ing.unit}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-amber-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Clone Recipe Modal */}
      {showAddRecipeModal && (
        <AddRecipeModal
          isOpen={showAddRecipeModal}
          onClose={() => {
            setShowAddRecipeModal(false);
            setCloneTemplateItem(null);
          }}
          onAddRecipe={handleCreatedRecipe}
          ingredients={ingredients}
          laborRatePerHour={laborRatePerHour}
          targetFoodCostPct={targetFoodCostPct}
          initialTemplate={cloneTemplateItem}
        />
      )}

      {/* Delete Recipe Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-2.5 rounded-xl bg-red-500/10">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Delete Recipe Formulation?
              </h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Are you sure you want to remove <strong className="text-neutral-900 dark:text-white">{currentItem?.name}</strong> from the recipe catalog? This action will log an audit entry.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrentRecipe}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors shadow-sm"
              >
                Delete Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
