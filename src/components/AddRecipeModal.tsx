import React, { useState, useMemo } from 'react';
import {
  ChefHat,
  Plus,
  Trash2,
  X,
  Sparkles,
  Calculator,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Layers,
  Percent,
  Search,
  Copy,
} from 'lucide-react';
import { MenuItem, Ingredient, RecipeIngredient, MenuCategory } from '../types';

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecipe: (newRecipe: MenuItem) => void;
  ingredients: Ingredient[];
  laborRatePerHour: number;
  targetFoodCostPct: number;
  initialTemplate?: MenuItem | null;
}

const CATEGORIES: MenuCategory[] = [
  'Pizza',
  'Pasta',
  'Mains',
  'Starters',
  'Desserts',
  'Beverages',
];

export const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  isOpen,
  onClose,
  onAddRecipe,
  ingredients,
  laborRatePerHour,
  targetFoodCostPct,
  initialTemplate,
}) => {
  // Form fields
  const [name, setName] = useState(initialTemplate?.name ? `${initialTemplate.name} (Copy)` : '');
  const [category, setCategory] = useState<MenuCategory>(initialTemplate?.category || 'Pizza');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [status, setStatus] = useState<'active' | 'seasonal' | 'draft'>(initialTemplate?.status || 'active');
  const [portionYield, setPortionYield] = useState<number>(initialTemplate?.portionYield || 1);
  const [prepLaborMinutes, setPrepLaborMinutes] = useState<number>(initialTemplate?.prepLaborMinutes || 10);
  const [packagingCost, setPackagingCost] = useState<number>(initialTemplate?.packagingCost || 30);
  const [sellingPrice, setSellingPrice] = useState<number>(initialTemplate?.sellingPrice || 550);
  const [targetCostPct, setTargetCostPct] = useState<number>(
    initialTemplate?.targetFoodCostPercent || targetFoodCostPct || 28
  );
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>(
    initialTemplate?.ingredients ? [...initialTemplate.ingredients] : []
  );

  // Ingredient picker search & selected ingredient to add
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>(ingredients[0]?.id || '');
  const [addQty, setAddQty] = useState<number>(0.1);
  const [addWastePct, setAddWastePct] = useState<number>(5);

  // Errors state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtered ingredients for search
  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return ingredients;
    const q = searchQuery.toLowerCase();
    return ingredients.filter(
      (ing) =>
        ing.name.toLowerCase().includes(q) ||
        ing.category.toLowerCase().includes(q) ||
        ing.supplier.toLowerCase().includes(q)
    );
  }, [ingredients, searchQuery]);

  // Current selected ingredient in the picker
  const activePickerIng = useMemo(
    () => ingredients.find((i) => i.id === selectedIngredientId) || ingredients[0],
    [ingredients, selectedIngredientId]
  );

  // Preset templates
  const applyPreset = (presetType: 'pasta' | 'pizza' | 'starter' | 'dessert' | 'blank') => {
    if (presetType === 'blank') {
      setName('');
      setCategory('Pizza');
      setDescription('');
      setPortionYield(1);
      setPrepLaborMinutes(10);
      setPackagingCost(25);
      setSellingPrice(480);
      setRecipeIngredients([]);
      setErrorMsg(null);
      return;
    }

    if (presetType === 'pasta') {
      // Look for guanciale, flour/pasta, parmigiano, eggs, evoo
      const flour = ingredients.find((i) => i.id === 'ing-14' || i.id === 'ing-01');
      const guanciale = ingredients.find((i) => i.id === 'ing-13' || i.id === 'ing-04');
      const parm = ingredients.find((i) => i.id === 'ing-05');
      const egg = ingredients.find((i) => i.id === 'ing-15');
      const evoo = ingredients.find((i) => i.id === 'ing-11');

      const items: RecipeIngredient[] = [];
      if (flour) items.push({ ingredientId: flour.id, quantity: 0.12, unit: flour.unit, wastePercent: 3 });
      if (guanciale) items.push({ ingredientId: guanciale.id, quantity: 0.08, unit: guanciale.unit, wastePercent: 12 });
      if (egg) items.push({ ingredientId: egg.id, quantity: 0.06, unit: egg.unit, wastePercent: 5 });
      if (parm) items.push({ ingredientId: parm.id, quantity: 0.04, unit: parm.unit, wastePercent: 2 });
      if (evoo) items.push({ ingredientId: evoo.id, quantity: 0.015, unit: evoo.unit, wastePercent: 0 });

      setName('Handcrafted Tagliatelle alla Carbonara');
      setCategory('Pasta');
      setDescription('House-extruded semolina tagliatelle, crispy Italian guanciale, pasteurized egg yolk emulsion, 24-month Parmigiano Reggiano, cracked black pepper.');
      setPortionYield(1);
      setPrepLaborMinutes(9);
      setPackagingCost(35);
      setSellingPrice(580);
      setRecipeIngredients(items.length > 0 ? items : (initialTemplate?.ingredients || []));
      setErrorMsg(null);
    } else if (presetType === 'pizza') {
      const flour = ingredients.find((i) => i.id === 'ing-01');
      const sauce = ingredients.find((i) => i.id === 'ing-02');
      const cheese = ingredients.find((i) => i.id === 'ing-03');
      const basil = ingredients.find((i) => i.id === 'ing-08');
      const evoo = ingredients.find((i) => i.id === 'ing-11');

      const items: RecipeIngredient[] = [];
      if (flour) items.push({ ingredientId: flour.id, quantity: 0.24, unit: flour.unit, wastePercent: 5 });
      if (sauce) items.push({ ingredientId: sauce.id, quantity: 0.09, unit: sauce.unit, wastePercent: 4 });
      if (cheese) items.push({ ingredientId: cheese.id, quantity: 0.14, unit: cheese.unit, wastePercent: 2 });
      if (basil) items.push({ ingredientId: basil.id, quantity: 0.20, unit: basil.unit, wastePercent: 10 });
      if (evoo) items.push({ ingredientId: evoo.id, quantity: 0.02, unit: evoo.unit, wastePercent: 0 });

      setName("Pepai's Quattro Formaggi & Basil Pizza");
      setCategory('Pizza');
      setDescription('48-hour fermented Caputo 00 crust, San Marzano tomato base, Fior di Latte mozzarella, Parmigiano Reggiano, wild honey drizzle, fresh Genovese basil.');
      setPortionYield(1);
      setPrepLaborMinutes(8);
      setPackagingCost(45);
      setSellingPrice(720);
      setRecipeIngredients(items);
      setErrorMsg(null);
    } else if (presetType === 'starter') {
      const burrata = ingredients.find((i) => i.id === 'ing-10');
      const tomatoes = ingredients.find((i) => i.id === 'ing-12');
      const basil = ingredients.find((i) => i.id === 'ing-08');
      const evoo = ingredients.find((i) => i.id === 'ing-11');

      const items: RecipeIngredient[] = [];
      if (burrata) items.push({ ingredientId: burrata.id, quantity: 1, unit: burrata.unit, wastePercent: 0 });
      if (tomatoes) items.push({ ingredientId: tomatoes.id, quantity: 0.18, unit: tomatoes.unit, wastePercent: 8 });
      if (basil) items.push({ ingredientId: basil.id, quantity: 0.25, unit: basil.unit, wastePercent: 10 });
      if (evoo) items.push({ ingredientId: evoo.id, quantity: 0.025, unit: evoo.unit, wastePercent: 0 });

      setName('Heirloom Burrata & Balsamic Crostini');
      setCategory('Starters');
      setDescription('Pugliese burrata heart, marinated Tagaytay heirloom tomatoes, wild basil oil, toasted house focaccia crisps.');
      setPortionYield(1);
      setPrepLaborMinutes(6);
      setPackagingCost(30);
      setSellingPrice(490);
      setRecipeIngredients(items);
      setErrorMsg(null);
    } else if (presetType === 'dessert') {
      const pistachio = ingredients.find((i) => i.id === 'ing-16');
      const chocolate = ingredients.find((i) => i.id === 'ing-18');
      const coffee = ingredients.find((i) => i.id === 'ing-17');
      const dairy = ingredients.find((i) => i.id === 'ing-10' || i.id === 'ing-03');

      const items: RecipeIngredient[] = [];
      if (pistachio) items.push({ ingredientId: pistachio.id, quantity: 0.04, unit: pistachio.unit, wastePercent: 2 });
      if (chocolate) items.push({ ingredientId: chocolate.id, quantity: 0.06, unit: chocolate.unit, wastePercent: 2 });
      if (coffee) items.push({ ingredientId: coffee.id, quantity: 0.03, unit: coffee.unit, wastePercent: 5 });

      setName('Sicilian Pistachio & Dark Chocolate Tart');
      setCategory('Desserts');
      setDescription('Pure Sicilian Bronte pistachio ganache, 70% dark Belgian chocolate shell, sea salt flakes, double espresso syrup.');
      setPortionYield(1);
      setPrepLaborMinutes(12);
      setPackagingCost(35);
      setSellingPrice(460);
      setRecipeIngredients(items);
      setErrorMsg(null);
    }
  };

  // Cost calculations
  const costingCalculation = useMemo(() => {
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));
    let rawTotal = 0;
    let wasteAdjustedTotal = 0;

    const ingredientBreakdown = recipeIngredients.map((item) => {
      const ing = ingMap.get(item.ingredientId);
      const baseCost = ing ? ing.costPerUnit : 0;
      const rawCost = item.quantity * baseCost;
      const yieldMultiplier =
        item.wastePercent > 0 ? 1 / Math.max(0.01, 1 - item.wastePercent / 100) : 1;
      const effectiveCost = rawCost * yieldMultiplier;

      rawTotal += rawCost;
      wasteAdjustedTotal += effectiveCost;

      return {
        ...item,
        ingredient: ing,
        baseCost,
        rawCost,
        effectiveCost,
      };
    });

    const portions = Math.max(1, portionYield);
    const rawCostPerPortion = rawTotal / portions;
    const wasteAdjustedCostPerPortion = wasteAdjustedTotal / portions;

    const prepLaborCost = (laborRatePerHour / 60) * Math.max(0, prepLaborMinutes);
    const totalCostPerPortion = wasteAdjustedCostPerPortion + prepLaborCost + packagingCost;

    const foodCostPct = sellingPrice > 0 ? (totalCostPerPortion / sellingPrice) * 100 : 0;
    const grossMarginAmount = Math.max(0, sellingPrice - totalCostPerPortion);
    const grossMarginPercent = sellingPrice > 0 ? (grossMarginAmount / sellingPrice) * 100 : 0;
    const markupMultiplier = totalCostPerPortion > 0 ? sellingPrice / totalCostPerPortion : 0;

    // Suggested price based on target food cost %
    const targetPctDecimal = (targetCostPct || 28) / 100;
    const suggestedPrice = targetPctDecimal > 0 ? totalCostPerPortion / targetPctDecimal : 0;
    const roundedSuggestedPrice = Math.ceil(suggestedPrice / 10) * 10;

    return {
      rawTotal,
      wasteAdjustedTotal,
      rawCostPerPortion,
      wasteAdjustedCostPerPortion,
      prepLaborCost,
      totalCostPerPortion,
      foodCostPct,
      grossMarginAmount,
      grossMarginPercent,
      markupMultiplier,
      suggestedPrice,
      roundedSuggestedPrice,
      ingredientBreakdown,
    };
  }, [
    recipeIngredients,
    ingredients,
    portionYield,
    prepLaborMinutes,
    laborRatePerHour,
    packagingCost,
    sellingPrice,
    targetCostPct,
  ]);

  // Handle adding an ingredient row
  const handleAddIngredientRow = () => {
    if (!activePickerIng) return;

    // Check if ingredient already in list
    const existingIndex = recipeIngredients.findIndex(
      (ri) => ri.ingredientId === activePickerIng.id
    );

    if (existingIndex >= 0) {
      // Increase quantity
      const updated = [...recipeIngredients];
      updated[existingIndex].quantity = +(
        updated[existingIndex].quantity + (addQty || 0.1)
      ).toFixed(3);
      setRecipeIngredients(updated);
    } else {
      const newEntry: RecipeIngredient = {
        ingredientId: activePickerIng.id,
        quantity: Math.max(0.001, addQty),
        unit: activePickerIng.unit,
        wastePercent: Math.max(0, Math.min(90, addWastePct)),
      };
      setRecipeIngredients([...recipeIngredients, newEntry]);
    }
  };

  const handleUpdateIngredientQty = (index: number, newQty: number) => {
    const updated = [...recipeIngredients];
    updated[index].quantity = Math.max(0.001, newQty);
    setRecipeIngredients(updated);
  };

  const handleUpdateIngredientWaste = (index: number, newWaste: number) => {
    const updated = [...recipeIngredients];
    updated[index].wastePercent = Math.max(0, Math.min(90, newWaste));
    setRecipeIngredients(updated);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const handleApplySuggestedPrice = () => {
    if (costingCalculation.roundedSuggestedPrice > 0) {
      setSellingPrice(costingCalculation.roundedSuggestedPrice);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMsg('Please enter a recipe name.');
      return;
    }

    if (recipeIngredients.length === 0) {
      setErrorMsg('Please add at least one ingredient to formulate the recipe.');
      return;
    }

    if (sellingPrice <= 0) {
      setErrorMsg('Please specify a valid menu selling price (₱) greater than zero.');
      return;
    }

    const newMenuItem: MenuItem = {
      id: `menu-${Date.now()}`,
      name: name.trim(),
      category,
      description: description.trim() || `${category} recipe curated by Pepai's culinary team.`,
      ingredients: recipeIngredients,
      prepLaborMinutes: Math.max(0, prepLaborMinutes),
      packagingCost: Math.max(0, packagingCost),
      sellingPrice: Math.max(1, sellingPrice),
      targetFoodCostPercent: targetCostPct,
      portionYield: Math.max(1, portionYield),
      yieldQuantity: Math.max(1, portionYield),
      yieldUnit: 'portions',
      monthlySalesUnits: {
        'loc-1': 240,
        'loc-2': 180,
        'loc-3': 110,
      },
      rating: 5.0,
      status,
    };

    onAddRecipe(newMenuItem);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl my-auto bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Add New Recipe Formulation
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500 text-neutral-950 uppercase hidden sm:inline-block">
                  Pepai's Kitchen OS
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                Calculate real-time ingredient shrinkage, portion costs, and target profit margins in Philippine Peso (₱).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Quick-Start Preset Ribbon */}
          <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Quick-Start Recipe Blueprints:
              </span>
              <span className="text-[10px] text-neutral-500">Click to autofill authentic formulas</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('blank')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                Blank Slate
              </button>
              <button
                type="button"
                onClick={() => applyPreset('pizza')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-200 transition-colors"
              >
                🍕 Napoletana Quattro Formaggi
              </button>
              <button
                type="button"
                onClick={() => applyPreset('pasta')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-200 transition-colors"
              >
                🍝 Tagliatelle Carbonara
              </button>
              <button
                type="button"
                onClick={() => applyPreset('starter')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-200 transition-colors"
              >
                🧀 Burrata Caprese Crostini
              </button>
              <button
                type="button"
                onClick={() => applyPreset('dessert')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-200 transition-colors"
              >
                🍫 Bronte Pistachio Tart
              </button>
            </div>
          </div>

          {/* Validation Alert */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: Identity & Parameters */}
          <div className="space-y-4">
            <h3 className="text-xs font-black tracking-wider uppercase text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
              <span>1. Dish Identity &amp; Classification</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Recipe / Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wood-Fired Truffle Margherita"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full px-3.5 py-2 text-sm font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Menu Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MenuCategory)}
                  className="w-full px-3 py-2 text-sm font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Culinary Description &amp; Plating Notes
                </label>
                <input
                  type="text"
                  placeholder="Key flavor profile, ingredients breakdown, sauce finish, allergy tags..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Recipe Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="active">Active Menu</option>
                  <option value="seasonal">Seasonal Special</option>
                  <option value="draft">R&amp;D Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Ingredients Formulation & Shrinkage */}
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-black tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
                2. Ingredients Formulation &amp; Yield Loss
              </h3>
              <span className="text-xs font-semibold text-neutral-500">
                {recipeIngredients.length} ingredient(s) in formula
              </span>
            </div>

            {/* Add Ingredient Bar */}
            <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <select
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs font-bold rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} (₱{ing.costPerUnit.toFixed(2)} / {ing.unit}) • {ing.category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl px-2 py-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Qty:</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.001"
                    value={addQty}
                    onChange={(e) => setAddQty(parseFloat(e.target.value) || 0.01)}
                    className="w-16 text-xs font-bold text-neutral-900 dark:text-white bg-transparent focus:outline-none"
                  />
                  <span className="text-[11px] text-neutral-500 font-medium">
                    {activePickerIng?.unit || 'unit'}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl px-2 py-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Trim %:</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="90"
                    value={addWastePct}
                    onChange={(e) => setAddWastePct(parseInt(e.target.value) || 0)}
                    className="w-12 text-xs font-bold text-neutral-900 dark:text-white bg-transparent focus:outline-none"
                  />
                  <span className="text-[11px] text-neutral-500 font-medium">%</span>
                </div>

                <button
                  type="button"
                  onClick={handleAddIngredientRow}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add To Recipe</span>
                </button>
              </div>
            </div>

            {/* Ingredients Table & Mobile Cards */}
            {recipeIngredients.length > 0 ? (
              <div>
                {/* Desktop Table View */}
                <div className="hidden md:block border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Ingredient</th>
                        <th className="py-2.5 px-3">Base Unit Cost</th>
                        <th className="py-2.5 px-3">Recipe Quantity</th>
                        <th className="py-2.5 px-3">Trim Waste %</th>
                        <th className="py-2.5 px-3">Effective Cost</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium">
                      {costingCalculation.ingredientBreakdown.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-neutral-900 dark:text-white block">
                              {row.ingredient?.name || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              {row.ingredient?.supplier || 'Local'} • {row.ingredient?.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400 font-mono">
                            ₱{row.baseCost.toFixed(2)} / {row.unit}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0.001"
                                value={row.quantity}
                                onChange={(e) =>
                                  handleUpdateIngredientQty(idx, parseFloat(e.target.value) || 0.01)
                                }
                                className="w-16 px-1.5 py-1 text-xs font-bold rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                              />
                              <span className="text-[11px] text-neutral-500">{row.unit}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                max="90"
                                value={row.wastePercent}
                                onChange={(e) =>
                                  handleUpdateIngredientWaste(idx, parseInt(e.target.value) || 0)
                                }
                                className="w-12 px-1.5 py-1 text-xs font-bold rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white"
                              />
                              <span className="text-[11px] text-neutral-500">%</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-neutral-900 dark:text-white font-mono">
                            ₱{row.effectiveCost.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(idx)}
                              className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Ingredient Cards (< 768px) */}
                <div className="md:hidden space-y-2.5">
                  {costingCalculation.ingredientBreakdown.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-neutral-900 dark:text-white text-xs block">
                            {row.ingredient?.name || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {row.ingredient?.category} • ₱{row.baseCost.toFixed(2)} / {row.unit}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-neutral-900 dark:text-white block">
                            ₱{row.effectiveCost.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-neutral-400">Effective</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700/50 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-0.5">
                            Quantity ({row.unit}):
                          </span>
                          <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 px-2 py-1 rounded-xl border border-neutral-300 dark:border-neutral-700">
                            <input
                              type="number"
                              step="0.01"
                              min="0.001"
                              value={row.quantity}
                              onChange={(e) =>
                                handleUpdateIngredientQty(idx, parseFloat(e.target.value) || 0.01)
                              }
                              className="w-full text-xs font-bold text-neutral-900 dark:text-white bg-transparent focus:outline-none"
                            />
                            <span className="text-[10px] text-neutral-500">{row.unit}</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] uppercase font-bold text-neutral-400">
                              Trim Waste %:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveIngredientRow(idx)}
                              className="text-red-500 hover:text-red-700 p-0.5"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 bg-white dark:bg-neutral-900 px-2 py-1 rounded-xl border border-neutral-300 dark:border-neutral-700">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              max="90"
                              value={row.wastePercent}
                              onChange={(e) =>
                                handleUpdateIngredientWaste(idx, parseInt(e.target.value) || 0)
                              }
                              className="w-full text-xs font-bold text-neutral-900 dark:text-white bg-transparent focus:outline-none"
                            />
                            <span className="text-[10px] text-neutral-500">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-center space-y-2">
                <ChefHat className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto" />
                <p className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                  No ingredients added to this recipe yet
                </p>
                <p className="text-[11px] text-neutral-400">
                  Pick ingredients above or select a preset blueprint to calculate portion costs.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 3: Operations, Labor, & Cost Breakdown */}
          <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h3 className="text-xs font-black tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
              3. Operational Costs &amp; Portioning
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Portion Yield per Batch
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={portionYield}
                  onChange={(e) => setPortionYield(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Yield: {portionYield} plate(s) per recipe preparation
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Kitchen Prep Time (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={prepLaborMinutes}
                  onChange={(e) => setPrepLaborMinutes(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Labor Cost: ₱{costingCalculation.prepLaborCost.toFixed(2)} (@ ₱{laborRatePerHour}/hr)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60">
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Packaging &amp; To-Go Box (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={packagingCost}
                  onChange={(e) => setPackagingCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Containers, labels, greaseproof liners
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 4: Real-time Margin & Selling Price Engine */}
          <div className="p-5 rounded-2xl bg-neutral-900 text-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div>
                <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-400" />
                  Live Profitability &amp; Selling Price Engine
                </h4>
                <p className="text-xs text-neutral-400">
                  Target Food Cost Benchmark: <strong>{targetCostPct}%</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplySuggestedPrice}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm"
                  title="Apply recommended price based on target margin"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply Target ₱{costingCalculation.roundedSuggestedPrice.toFixed(2)}</span>
                </button>
              </div>
            </div>

            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-neutral-800/80 border border-neutral-700/80">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Total Cost / Portion
                </span>
                <div className="text-xl font-black text-white mt-1">
                  ₱{costingCalculation.totalCostPerPortion.toFixed(2)}
                </div>
                <span className="text-[10px] text-neutral-400">
                  Raw: ₱{costingCalculation.wasteAdjustedCostPerPortion.toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-800/80 border border-neutral-700/80">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Menu Selling Price
                </span>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-base font-black text-neutral-400">₱</span>
                  <input
                    type="number"
                    step="5"
                    min="1"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-0.5 text-lg font-black text-white bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <span className="text-[10px] text-amber-400">
                  Target: ₱{costingCalculation.suggestedPrice.toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-800/80 border border-neutral-700/80">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Food Cost %
                </span>
                <div
                  className={`text-xl font-black mt-1 ${
                    costingCalculation.foodCostPct <= targetCostPct
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {costingCalculation.foodCostPct.toFixed(1)}%
                </div>
                <span className="text-[10px] text-neutral-400">
                  {costingCalculation.foodCostPct <= targetCostPct
                    ? '✅ Target Achieved'
                    : '⚠️ Above Target'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-800/80 border border-neutral-700/80">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                  Gross Profit Margin
                </span>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  ₱{costingCalculation.grossMarginAmount.toFixed(2)}
                </div>
                <span className="text-[10px] text-neutral-400">
                  {costingCalculation.grossMarginPercent.toFixed(1)}% contribution
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-neutral-100 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save &amp; Formulate Recipe</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
