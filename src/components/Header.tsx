import React from 'react';
import { UserLocation, ServiceCategory } from '../types';
import { MapPin, Navigation, RotateCw, ShieldAlert, ChevronDown } from 'lucide-react';

interface HeaderProps {
  userLocation: UserLocation;
  onOpenLocationModal: () => void;
  onRefreshGps: () => void;
  onSelectCategory: (category: ServiceCategory) => void;
}

export const Header: React.FC<HeaderProps> = ({
  userLocation,
  onOpenLocationModal,
  onRefreshGps,
  onSelectCategory
}) => {
  return (
    <header className="sticky top-0 z-30 bg-emerald-900 text-white shadow-md border-b border-emerald-950">
      {/* Top emergency flash strip */}
      <div className="bg-emerald-950/80 px-4 py-1 text-[11px] text-emerald-200 flex items-center justify-between border-b border-emerald-800/40">
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Verified Local Artisans • On-Demand Calling</span>
        </span>

        <button
          id="header-highway-emergency-btn"
          onClick={() => onSelectCategory('Emergency Highway Assistance')}
          className="flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 text-[11px] cursor-pointer"
        >
          <ShieldAlert className="w-3 h-3 text-amber-400" />
          <span>Highway SOS</span>
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 border border-emerald-400/40 flex items-center justify-center font-black text-lg text-white shadow-xs">
            QK
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none text-white flex items-center gap-1">
              Quick Karya
            </h1>
            <p className="text-[10px] text-emerald-300 font-medium tracking-wide">
              PROXIMITY ARTISAN NETWORK
            </p>
          </div>
        </div>

        {/* Location Pill & Refresh Action */}
        <div className="flex items-center gap-1.5">
          <button
            id="header-location-pill"
            onClick={onOpenLocationModal}
            className="flex items-center gap-1.5 bg-emerald-800/80 hover:bg-emerald-800 border border-emerald-700/60 rounded-full px-2.5 py-1 text-xs transition-colors cursor-pointer"
            title="Click to change location or use GPS"
          >
            {userLocation.isLiveGps ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            ) : (
              <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            )}

            <div className="text-left max-w-[120px] truncate leading-tight">
              <span className="font-bold text-white text-[11px] block truncate">
                {userLocation.city || 'Select Area'}
              </span>
              {userLocation.pincode && (
                <span className="text-[9px] text-emerald-300 block -mt-0.5">
                  {userLocation.pincode}
                </span>
              )}
            </div>

            <ChevronDown className="w-3 h-3 text-emerald-300 shrink-0" />
          </button>

          <button
            id="header-gps-refresh-btn"
            onClick={onRefreshGps}
            className="p-1.5 rounded-full bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 hover:text-white border border-emerald-700/60 transition-colors cursor-pointer"
            title="Refresh GPS Coordinates"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
