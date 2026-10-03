import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  X,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Store,
  Layers,
  Edit2,
  Save,
  Boxes,
} from 'lucide-react';
import { Location, Ingredient, MenuItem, User as UserType } from '../types';

interface LocationsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  onAddLocation: (locData: Omit<Location, 'id'>) => void;
  onRemoveLocation: (locationId: string) => void;
  onUpdateLocation?: (loc: Location) => void;
  ingredients: Ingredient[];
  currentUser: UserType;
}

interface LocationBlueprint {
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  manager: string;
}

const PHILIPPINE_LOCATION_PRESETS: LocationBlueprint[] = [
  {
    name: "Pepai's Eastwood Cyberpark",
    code: 'QC-04',
    city: 'Quezon City',
    address: 'Citywalk 2, Eastwood Ave, Bagumbayan, Quezon City',
    phone: '+63 2 8671 4410',
    manager: 'Carlos Mendoza',
  },
  {
    name: "Pepai's Cebu IT Park",
    code: 'CEB-05',
    city: 'Cebu City',
    address: 'Skyrise 4, Jose Maria del Mar St, Lahug, Cebu City',
    phone: '+63 32 412 8820',
    manager: 'Maria Santos',
  },
  {
    name: "Pepai's SM Mall of Asia",
    code: 'MOA-06',
    city: 'Pasay City',
    address: 'Seaside Blvd, Coral Way, Mall of Asia Complex, Pasay City',
    phone: '+63 2 8556 1234',
    manager: 'Rafael Bautista',
  },
  {
    name: "Pepai's Ayala Center Cebu",
    code: 'AYC-07',
    city: 'Cebu City',
    address: 'The Terraces, Cebu Business Park, Cebu City',
    phone: '+63 32 233 4567',
    manager: 'Bianca Ramos',
  },
  {
    name: "Pepai's Clark Freeport Zone",
    code: 'CLK-08',
    city: 'Angeles City, Pampanga',
    address: 'Manuel A. Roxas Hwy, Clark Freeport Zone, Pampanga',
    phone: '+63 45 499 7780',
    manager: 'Joshua De Leon',
  },
];

export const LocationsManagerModal: React.FC<LocationsManagerModalProps> = ({
  isOpen,
  onClose,
  locations,
  onAddLocation,
  onRemoveLocation,
  onUpdateLocation,
  ingredients,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');

  // New location form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [manager, setManager] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit location state
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editManager, setEditManager] = useState('');

  // Delete confirmation
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: LocationBlueprint) => {
    setName(preset.name);
    setCode(preset.code);
    setCity(preset.city);
    setAddress(preset.address);
    setPhone(preset.phone);
    setManager(preset.manager);
    setErrorMsg(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMsg('Store / Unit name is required.');
      return;
    }
    if (!code.trim()) {
      setErrorMsg('Store code is required (e.g. QC-04).');
      return;
    }
    if (!city.trim()) {
      setErrorMsg('City / Municipality is required.');
      return;
    }

    // Check code uniqueness
    const codeExists = locations.some(
      (l) => l.code.toLowerCase() === code.trim().toLowerCase()
    );
    if (codeExists) {
      setErrorMsg(`Store code "${code.trim().toUpperCase()}" is already assigned to another location.`);
      return;
    }

    onAddLocation({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      city: city.trim(),
      address: address.trim() || `${city.trim()}, Metro Manila, Philippines`,
      phone: phone.trim() || '+63 2 8000 0000',
      manager: manager.trim() || currentUser.name,
      active: true,
    });

    // Reset form
    setName('');
    setCode('');
    setCity('');
    setAddress('');
    setPhone('');
    setManager('');
    setErrorMsg(null);
    setActiveTab('list');
  };

  const startEdit = (loc: Location) => {
    setEditingLocId(loc.id);
    setEditName(loc.name);
    setEditCode(loc.code);
    setEditCity(loc.city);
    setEditAddress(loc.address);
    setEditPhone(loc.phone);
    setEditManager(loc.manager);
  };

  const saveEdit = (locId: string) => {
    if (!onUpdateLocation) return;
    const existing = locations.find((l) => l.id === locId);
    if (!existing) return;

    onUpdateLocation({
      ...existing,
      name: editName.trim() || existing.name,
      code: editCode.trim().toUpperCase() || existing.code,
      city: editCity.trim() || existing.city,
      address: editAddress.trim() || existing.address,
      phone: editPhone.trim() || existing.phone,
      manager: editManager.trim() || existing.manager,
    });

    setEditingLocId(null);
  };

  const confirmRemove = () => {
    if (!deletingLocation) return;
    if (locations.length <= 1) {
      setErrorMsg('Cannot remove the only remaining location. At least one operational unit must exist.');
      setDeletingLocation(null);
      return;
    }
    onRemoveLocation(deletingLocation.id);
    setDeletingLocation(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl my-auto bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Multi-Unit Restaurant Network
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500 text-neutral-950 uppercase">
                  {locations.length} Active {locations.length === 1 ? 'Store' : 'Stores'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Add, configure, or remove store locations across Pepai's cloud inventory and food costing ledger.
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

        {/* Tab Controls */}
        <div className="px-5 pt-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900/60">
          <button
            onClick={() => {
              setActiveTab('list');
              setErrorMsg(null);
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'list'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Active Store Units ({locations.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('add');
              setErrorMsg(null);
            }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'add'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add New Location</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: LIST ACTIVE LOCATIONS */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    Operational Restaurant Branches
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Each branch maintains isolated inventory stock levels, daily counts, and transfer requisitions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add Branch</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locations.map((loc) => {
                  const isEditing = editingLocId === loc.id;

                  // Compute location's total inventory value
                  let locInventoryVal = 0;
                  ingredients.forEach((ing) => {
                    const st = ing.stockByLocation[loc.id];
                    if (st) {
                      locInventoryVal += (st.quantity || 0) * ing.costPerUnit;
                    }
                  });

                  if (isEditing) {
                    return (
                      <div
                        key={loc.id}
                        className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                          <span className="text-xs font-black text-amber-700 dark:text-amber-300">
                            Editing Unit Details
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingLocId(null)}
                            className="text-xs text-neutral-400 hover:text-neutral-600"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="font-bold text-neutral-600 dark:text-neutral-400 block mb-0.5">
                              Store Name
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-bold"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-neutral-600 dark:text-neutral-400 block mb-0.5">
                              Store Code
                            </label>
                            <input
                              type="text"
                              value={editCode}
                              onChange={(e) => setEditCode(e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-bold uppercase"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="font-bold text-neutral-600 dark:text-neutral-400 block mb-0.5">
                              City
                            </label>
                            <input
                              type="text"
                              value={editCity}
                              onChange={(e) => setEditCity(e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                            />
                          </div>
                          <div>
                            <label className="font-bold text-neutral-600 dark:text-neutral-400 block mb-0.5">
                              Manager
                            </label>
                            <input
                              type="text"
                              value={editManager}
                              onChange={(e) => setEditManager(e.target.value)}
                              className="w-full px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                            />
                          </div>
                        </div>

                        <div className="text-xs">
                          <label className="font-bold text-neutral-600 dark:text-neutral-400 block mb-0.5">
                            Street Address
                          </label>
                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            className="w-full px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                          />
                        </div>

                        <div className="text-xs">
                          <label className="font-bold text-neutral-600 dark:text-neutral-400 block mb-0.5">
                            Phone / Hotline
                          </label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => saveEdit(loc.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-sm"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Changes</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={loc.id}
                      className="p-4 rounded-2xl bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/60 shadow-sm flex flex-col justify-between hover:border-amber-500/40 transition-colors"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                                {loc.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600">
                                {loc.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="line-clamp-1">{loc.address}</span>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shrink-0">
                            Active
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                              General Manager
                            </span>
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                              {loc.manager}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block">
                              Live Stock Value
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ₱{locInventoryVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="col-span-2 flex items-center gap-1 text-[11px] text-neutral-500">
                            <Phone className="w-3 h-3 text-neutral-400" />
                            <span>{loc.phone}</span>
                            <span className="mx-1">•</span>
                            <span>{loc.city}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => startEdit(loc)}
                          className="flex items-center gap-1 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit Details</span>
                        </button>

                        <button
                          type="button"
                          disabled={locations.length <= 1}
                          onClick={() => setDeletingLocation(loc)}
                          className={`flex items-center gap-1 text-xs font-bold transition-colors ${
                            locations.length <= 1
                              ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                              : 'text-red-500 hover:text-red-700 dark:hover:text-red-400'
                          }`}
                          title={
                            locations.length <= 1
                              ? 'Cannot remove the only operating location'
                              : `Remove ${loc.name}`
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove Unit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: ADD NEW LOCATION */}
          {activeTab === 'add' && (
            <div className="space-y-6">
              {/* Presets Strip */}
              <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Quick-Start Philippine Metro Locations:
                  </span>
                  <span className="text-[10px] text-neutral-500">Click to autofill unit blueprints</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PHILIPPINE_LOCATION_PRESETS.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors"
                    >
                      📍 {preset.name.replace("Pepai's ", '')} ({preset.code})
                    </button>
                  ))}
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Store / Branch Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pepai's Eastwood Cyberpark"
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
                      Store Code * (e.g. QC-04)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="QC-04"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      className="w-full px-3.5 py-2 text-sm font-black uppercase rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      City / Municipality *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Quezon City, Pasig, Cebu City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Branch General Manager
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dante Romano, Elena Rostova"
                      value={manager}
                      onChange={(e) => setManager(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Complete Street Address &amp; Mall Wing
                    </label>
                    <input
                      type="text"
                      placeholder="Unit 102, Ground Level, Citywalk 2..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                      Store Telephone / Hotline
                    </label>
                    <input
                      type="text"
                      placeholder="+63 2 8671 4410"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Cloud & Inventory Sync Note */}
                <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 text-xs flex items-start gap-2.5">
                  <Boxes className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-neutral-600 dark:text-neutral-400 text-[11px] leading-relaxed">
                    When this store unit is deployed, Pepai's inventory ledger will automatically provision stock balance rows for all <strong>{ingredients.length} active kitchen ingredients</strong>, allowing immediate stock counts, par alerts, and inter-unit transfers.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 text-xs font-bold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors shadow-md"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Deploy &amp; Activate Unit</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal Overlay */}
        {deletingLocation && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-red-500">
                <div className="p-2.5 rounded-xl bg-red-500/10">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                    Remove Restaurant Unit?
                  </h3>
                  <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                    {deletingLocation.name} ({deletingLocation.code})
                  </span>
                </div>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Are you sure you want to deactivate and remove this restaurant branch? Inter-store transfer history will be archived, and active stock counts will be removed from future aggregation.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingLocation(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRemove}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors shadow-sm"
                >
                  Confirm Removal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
