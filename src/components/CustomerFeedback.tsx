import React, { useState } from 'react';
import {
  Star,
  MessageSquare,
  ThumbsUp,
  Smile,
  Meh,
  Frown,
  Plus,
  Filter,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { CustomerFeedback, MenuItem, Location, User } from '../types';

interface CustomerFeedbackProps {
  feedbackList: CustomerFeedback[];
  menuItems: MenuItem[];
  locations: Location[];
  onAddFeedback: (feedback: Omit<CustomerFeedback, 'id' | 'date'>) => void;
  currentUser: User;
}

export const CustomerFeedbackModule: React.FC<CustomerFeedbackProps> = ({
  feedbackList,
  menuItems,
  locations,
  onAddFeedback,
}) => {
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form states
  const [selectedDishId, setSelectedDishId] = useState<string>(menuItems[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id || '');
  const [rating, setRating] = useState<number>(5);
  const [npsScore, setNpsScore] = useState<number>(10);
  const [customerName, setCustomerName] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [category, setCategory] = useState<CustomerFeedback['category']>('Food Quality');

  // Compute metrics
  const totalCount = feedbackList.length;
  const avgRating = totalCount > 0 ? feedbackList.reduce((sum, f) => sum + f.rating, 0) / totalCount : 0;

  // NPS: % Promoters (9-10) - % Detractors (0-6)
  const promoters = feedbackList.filter((f) => f.npsScore >= 9).length;
  const detractors = feedbackList.filter((f) => f.npsScore <= 6).length;
  const npsCalculated = totalCount > 0 ? Math.round(((promoters - detractors) / totalCount) * 100) : 0;

  const positiveCount = feedbackList.filter((f) => f.sentiment === 'positive').length;
  const neutralCount = feedbackList.filter((f) => f.sentiment === 'neutral').length;
  const negativeCount = feedbackList.filter((f) => f.sentiment === 'negative').length;

  const filteredList = feedbackList.filter((f) => {
    if (selectedSentiment !== 'all' && f.sentiment !== selectedSentiment) return false;
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dish = menuItems.find((m) => m.id === selectedDishId);
    const loc = locations.find((l) => l.id === selectedLocationId);

    const sentiment = npsScore >= 8 ? 'positive' : npsScore >= 6 ? 'neutral' : 'negative';

    onAddFeedback({
      dishId: selectedDishId,
      dishName: dish?.name || 'Chef Special',
      locationId: selectedLocationId,
      locationName: loc?.name || "Pepai's Downtown",
      rating,
      npsScore,
      comment,
      category,
      sentiment,
      customerName: customerName.trim() || 'Anonymous Diner',
    });

    setComment('');
    setCustomerName('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">
              Customer Satisfaction &amp; NPS Module
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time dining room satisfaction scores, dish quality correlation, and sentiment analysis.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Dining Feedback</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* NPS Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
            Net Promoter Score (NPS)
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              +{npsCalculated}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              (World-Class Benchmark)
            </span>
          </div>
          <div className="mt-3 w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden flex">
            <div style={{ width: `${(promoters / totalCount) * 100}%` }} className="bg-emerald-500 h-full" />
            <div style={{ width: `${(neutralCount / totalCount) * 100}%` }} className="bg-amber-500 h-full" />
            <div style={{ width: `${(detractors / totalCount) * 100}%` }} className="bg-rose-500 h-full" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-neutral-400">
            <span>{promoters} Promoters</span>
            <span>{neutralCount} Passives</span>
            <span>{detractors} Detractors</span>
          </div>
        </div>

        {/* Average Rating Card */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
            Overall Dish Satisfaction
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-900 dark:text-white">
              {avgRating.toFixed(1)}
            </span>
            <div className="flex items-center text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i < Math.round(avgRating) ? 'fill-amber-500' : 'text-neutral-300 dark:text-neutral-700'}`}
                />
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Across {totalCount} verified table &amp; delivery orders
          </p>
        </div>

        {/* Sentiment Breakdown */}
        <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
            Guest Sentiment
          </span>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Smile className="w-4 h-4 text-emerald-600 mx-auto" />
              <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-1">
                {positiveCount}
              </div>
              <span className="text-[10px] text-neutral-500">Positive</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Meh className="w-4 h-4 text-amber-600 mx-auto" />
              <div className="text-sm font-black text-amber-700 dark:text-amber-400 mt-1">
                {neutralCount}
              </div>
              <span className="text-[10px] text-neutral-500">Neutral</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10">
              <Frown className="w-4 h-4 text-rose-600 mx-auto" />
              <div className="text-sm font-black text-rose-700 dark:text-rose-400 mt-1">
                {negativeCount}
              </div>
              <span className="text-[10px] text-neutral-500">Needs Care</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'positive', 'neutral', 'negative'] as const).map((sent) => (
          <button
            key={sent}
            onClick={() => setSelectedSentiment(sent)}
            className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
              selectedSentiment === sent
                ? 'bg-amber-500 text-neutral-950'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {sent} Feedback
          </button>
        ))}
      </div>

      {/* Feedback Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredList.map((fb) => (
          <div
            key={fb.id}
            className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2.5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white">
                  {fb.dishName}
                </h3>
                <span className="text-[11px] text-neutral-400">
                  {fb.locationName} • {fb.customerName}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded text-amber-700 dark:text-amber-300 font-bold text-xs">
                <Star className="w-3 h-3 fill-amber-500" />
                <span>{fb.rating}.0</span>
              </div>
            </div>

            <p className="text-xs text-neutral-700 dark:text-neutral-300 italic">
              "{fb.comment}"
            </p>

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
              <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {fb.category}
              </span>
              <span className="text-neutral-400">{fb.date}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Feedback Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Record Guest Feedback / QR Survey
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Menu Item Evaluated
                </label>
                <select
                  value={selectedDishId}
                  onChange={(e) => setSelectedDishId(e.target.value)}
                  className="mt-1 w-full p-2 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                >
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Restaurant Location
                </label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="mt-1 w-full p-2 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                    Rating (1 to 5 Stars)
                  </label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value))}
                    className="mt-1 w-full p-2 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5 Stars)</option>
                    <option value={4}>⭐⭐⭐⭐ (4 Stars)</option>
                    <option value={3}>⭐⭐⭐ (3 Stars)</option>
                    <option value={2}>⭐⭐ (2 Stars)</option>
                    <option value={1}>⭐ (1 Star)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                    NPS Score (0 - 10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={npsScore}
                    onChange={(e) => setNpsScore(parseInt(e.target.value) || 10)}
                    className="mt-1 w-full p-2 text-xs font-bold rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Guest Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rachel G."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 w-full p-2 text-xs rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Customer Comments
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed feedback about taste, sauce balance, portion size..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-1 w-full p-2 text-xs rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors"
                >
                  Save Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
