import React from 'react';
import { CATEGORIES } from '../data/categories';
import { ServiceCategory, WorkerProfile } from '../types';
import {
  Wrench,
  Zap,
  Hammer,
  UtensilsCrossed,
  Paintbrush,
  Car,
  HardHat,
  Users,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  PhoneCall
} from 'lucide-react';

interface CategoriesViewProps {
  onSelectCategory: (category: ServiceCategory) => void;
  workers: WorkerProfile[];
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  onSelectCategory,
  workers
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Wrench':
        return <Wrench className="w-6 h-6 text-emerald-800" />;
      case 'Zap':
        return <Zap className="w-6 h-6 text-emerald-800" />;
      case 'Hammer':
        return <Hammer className="w-6 h-6 text-emerald-800" />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className="w-6 h-6 text-emerald-800" />;
      case 'Paintbrush':
        return <Paintbrush className="w-6 h-6 text-emerald-800" />;
      case 'Car':
        return <Car className="w-6 h-6 text-emerald-800" />;
      case 'HardHat':
        return <HardHat className="w-6 h-6 text-emerald-800" />;
      case 'Users':
        return <Users className="w-6 h-6 text-emerald-800" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-6 h-6 text-amber-600" />;
      default:
        return <Sparkles className="w-6 h-6 text-emerald-800" />;
    }
  };

  const getWorkerCount = (catName: ServiceCategory) => {
    return workers.filter((w) => w.category === catName).length;
  };

  const emergencyCategory = CATEGORIES.find(
    (c) => c.name === 'Emergency Highway Assistance'
  );
  const regularCategories = CATEGORIES.filter(
    (c) => c.name !== 'Emergency Highway Assistance'
  );

  return (
    <div className="space-y-4 pb-20 pt-2">
      {/* Category Header Intro */}
      <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-emerald-800/40 rounded-full blur-xl pointer-events-none" />
        <h2 className="text-lg font-bold">Service Categories</h2>
        <p className="text-xs text-emerald-200 mt-0.5">
          Browse verified local trades &amp; artisans with direct phone contacts
        </p>
      </div>

      {/* Featured 24/7 Priority Section: Emergency Highway Assistance */}
      {emergencyCategory && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Featured 24/7 Priority Section
            </span>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300/60">
              Immediate Response
            </span>
          </div>

          <div
            id="category-card-emergency-highway-assistance"
            onClick={() => onSelectCategory(emergencyCategory.name)}
            className="rounded-2xl border-2 border-amber-500 bg-gradient-to-br from-amber-50/90 via-white to-amber-100/60 p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer relative overflow-hidden ring-2 ring-amber-400/20"
          >
            {/* Top alert badge bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-emerald-600 to-amber-600" />

            <div className="flex items-start justify-between gap-3 pt-0.5">
              <div className="flex items-center gap-3">
                <div className="w-13 h-13 rounded-2xl bg-amber-100 border border-amber-300/90 flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldAlert className="w-7 h-7 text-amber-600 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
                      Emergency Highway Assistance
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-bold tracking-wider">
                      24/7 PRIORITY
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 font-semibold">
                    {emergencyCategory.hindiName}
                  </p>
                </div>
              </div>

              <div className="p-2 bg-amber-200/70 rounded-full text-amber-900 shrink-0">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            <p className="text-xs text-gray-700 mt-2.5 leading-relaxed">
              {emergencyCategory.description}
            </p>

            <div className="mt-3 pt-2.5 border-t border-amber-200/80 flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-950 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {getWorkerCount(emergencyCategory.name)} active rescue teams on call
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-950 font-bold bg-amber-200/80 hover:bg-amber-300/80 px-2.5 py-1 rounded-lg border border-amber-300">
                <PhoneCall className="w-3 h-3 text-emerald-800" />
                Instant Dispatch
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Section Divider */}
      <div className="flex items-center gap-2 pt-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Standard Local Trades &amp; Artisans
        </span>
        <div className="h-px bg-gray-200 flex-1" />
      </div>

      {/* Grid of Regular Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {regularCategories.map((cat) => {
          const count = getWorkerCount(cat.name);
          return (
            <div
              key={cat.id}
              id={`category-card-${cat.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              onClick={() => onSelectCategory(cat.name)}
              className="bg-white rounded-2xl p-4 border border-emerald-950/10 hover:border-emerald-700/50 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {getIcon(cat.iconName)}
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-100/60 text-emerald-900 rounded-full">
                    {count} {count === 1 ? 'worker' : 'workers'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 leading-tight">
                  {cat.name}
                </h3>
                <p className="text-xs text-emerald-800 font-medium mt-0.5">
                  {cat.hindiName}
                </p>
                <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Avg: {cat.avgRate}</span>
                <span className="text-emerald-800 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  View <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
