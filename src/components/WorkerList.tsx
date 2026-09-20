import React, { useState } from 'react';
import { WorkerProfile, ServiceCategory, DriverSubCategory } from '../types';
import { WorkerCard } from './WorkerCard';
import { CATEGORIES } from '../data/categories';
import { getDriverSubCategory } from '../utils/pricing';
import { Filter, Users, ShieldAlert, Sparkles, RefreshCw, Car, Truck, HardHat } from 'lucide-react';

interface WorkerListProps {
  workers: WorkerProfile[];
  selectedCategory: ServiceCategory | 'All';
  onSelectCategory: (category: ServiceCategory | 'All') => void;
  onCallNow: (worker: WorkerProfile) => void;
  onGoToRegister: () => void;
  onResetFilters: () => void;
  isLoading: boolean;
}

export const WorkerList: React.FC<WorkerListProps> = ({
  workers,
  selectedCategory,
  onSelectCategory,
  onCallNow,
  onGoToRegister,
  onResetFilters,
  isLoading
}) => {
  const [driverSubFilter, setDriverSubFilter] = useState<DriverSubCategory>('all');

  // Compute counts for driver sub-categories
  const driverWorkers = workers.filter((w) => w.category === 'Driver');
  const personalDriversCount = driverWorkers.filter(
    (w) => getDriverSubCategory(w.vehicleType) === 'personal'
  ).length;
  const commercialDriversCount = driverWorkers.filter(
    (w) => getDriverSubCategory(w.vehicleType) === 'commercial'
  ).length;
  const heavyMachineryCount = driverWorkers.filter(
    (w) => getDriverSubCategory(w.vehicleType) === 'heavy'
  ).length;

  // Active display workers filtered by driver subcategory when applicable
  const displayWorkers = workers.filter((worker) => {
    if (selectedCategory === 'Driver' && driverSubFilter !== 'all') {
      const sub = getDriverSubCategory(worker.vehicleType);
      return sub === driverSubFilter;
    }
    return true;
  });

  return (
    <div className="space-y-3.5 pb-24">
      {/* Category Horizontal Filter Chips */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-gray-700 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-emerald-800" />
            Category Filter
          </span>
          {selectedCategory !== 'All' && (
            <button
              onClick={() => {
                onSelectCategory('All');
                setDriverSubFilter('all');
              }}
              className="text-[11px] text-emerald-800 hover:text-emerald-950 font-semibold cursor-pointer"
            >
              Reset to All
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* All chip */}
          <button
            id="cat-chip-all"
            onClick={() => {
              onSelectCategory('All');
              setDriverSubFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50'
            }`}
          >
            All Trades ({workers.length})
          </button>

          {/* Emergency Highway Assistance Highlighted Chip */}
          <button
            id="cat-chip-emergency-highway"
            onClick={() => {
              onSelectCategory('Emergency Highway Assistance');
              setDriverSubFilter('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
              selectedCategory === 'Emergency Highway Assistance'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Emergency Highway Assistance</span>
          </button>

          {/* Standard trade categories */}
          {CATEGORIES.filter((c) => c.name !== 'Emergency Highway Assistance').map(
            (cat) => (
              <button
                key={cat.id}
                id={`cat-chip-${cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => {
                  onSelectCategory(cat.name);
                  if (cat.name !== 'Driver') setDriverSubFilter('all');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.name
                    ? 'bg-emerald-800 text-white font-semibold shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-900'
                }`}
              >
                {cat.name}
              </button>
            )
          )}
        </div>
      </div>

      {/* DRIVER SPECIALIZATION SUB-FILTERS (WHEN DRIVER IS SELECTED) */}
      {selectedCategory === 'Driver' && (
        <div
          id="driver-specialization-filters"
          className="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-200 space-y-2 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-bold text-emerald-950 flex items-center gap-1.5 text-[11px]">
              <Truck className="w-3.5 h-3.5 text-emerald-700" />
              Driver Specialization / Vehicle Category:
            </span>
            {driverSubFilter !== 'all' && (
              <button
                onClick={() => setDriverSubFilter('all')}
                className="text-[10px] text-emerald-800 font-bold hover:underline cursor-pointer"
              >
                Show All ({driverWorkers.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {/* All Drivers */}
            <button
              id="driver-subfilter-all"
              type="button"
              onClick={() => setDriverSubFilter('all')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                driverSubFilter === 'all'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white border border-emerald-200 text-emerald-950 hover:bg-emerald-100/60'
              }`}
            >
              <span>All Drivers</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  driverSubFilter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {driverWorkers.length}
              </span>
            </button>

            {/* Category A: Personal & Family */}
            <button
              id="driver-subfilter-personal"
              type="button"
              onClick={() => setDriverSubFilter('personal')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                driverSubFilter === 'personal'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white border border-emerald-200 text-emerald-950 hover:bg-emerald-100/60'
              }`}
            >
              <Car className="w-3.5 h-3.5 text-emerald-600" />
              <span>Personal &amp; Family Car</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  driverSubFilter === 'personal'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {personalDriversCount}
              </span>
            </button>

            {/* Category B: Commercial Freight & Trucks */}
            <button
              id="driver-subfilter-commercial"
              type="button"
              onClick={() => setDriverSubFilter('commercial')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                driverSubFilter === 'commercial'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white border border-emerald-200 text-emerald-950 hover:bg-emerald-100/60'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Commercial Freight &amp; Trucks</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  driverSubFilter === 'commercial'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {commercialDriversCount}
              </span>
            </button>

            {/* Category C: Heavy Machinery & Earthmovers */}
            <button
              id="driver-subfilter-heavy"
              type="button"
              onClick={() => setDriverSubFilter('heavy')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                driverSubFilter === 'heavy'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-white border border-emerald-200 text-emerald-950 hover:bg-emerald-100/60'
              }`}
            >
              <HardHat className="w-3.5 h-3.5 text-amber-600" />
              <span>Heavy Machinery &amp; Earthmovers</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  driverSubFilter === 'heavy'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {heavyMachineryCount}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-emerald-800 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-xs font-semibold">Updating nearest providers...</span>
        </div>
      )}

      {/* Workers List */}
      {!isLoading && displayWorkers.length > 0 && (
        <div className="space-y-3">
          {displayWorkers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} onCallNow={onCallNow} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && displayWorkers.length === 0 && (
        <div
          id="no-workers-found-state"
          className="bg-white rounded-2xl p-6 border border-gray-200 text-center space-y-3 shadow-xs my-4"
        >
          <div className="w-12 h-12 bg-emerald-50 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">No Workers Found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              {selectedCategory === 'Driver' && driverSubFilter !== 'all'
                ? 'No drivers found under this specific specialization. Try switching to "All Drivers".'
                : 'No registered service providers found matching the selected category or area.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {selectedCategory === 'Driver' && driverSubFilter !== 'all' ? (
              <button
                onClick={() => setDriverSubFilter('all')}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs"
              >
                View All Drivers ({driverWorkers.length})
              </button>
            ) : (
              <>
                <button
                  onClick={onResetFilters}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Reset Filters
                </button>
                <button
                  onClick={onGoToRegister}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs"
                >
                  Register as First Worker Here
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
