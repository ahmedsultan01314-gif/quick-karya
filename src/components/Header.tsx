import React from 'react';
import { UserLocation, ServiceCategory } from '../types';
import { MapPin, Navigation, RotateCw, ShieldAlert, ChevronDown } from 'lucide-react';

interface HeaderProps {
  userLocation: UserLocation;
  onOpenLocationModal: () => void;
  onRefreshGps: () => void;
  onSelectCategory: (category: ServiceCategory) => void;
  onOpenHighwaySos?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userLocation,
  onOpenLocationModal,
  onRefreshGps,
  onSelectCategory,
  onOpenHighwaySos
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#001F3F] text-white shadow-md border-b border-[#0a2e5c]">
      {/* Top emergency flash strip */}
      <div className="bg-[#00162e] px-4 py-1 text-[11px] text-amber-200 flex items-center justify-between border-b border-[#0a2e5c]/60">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
          <span className="font-medium text-amber-300">Verified Local Artisans • On-Demand Direct Calling</span>
        </span>

        <button
          id="header-highway-emergency-btn"
          onClick={() => {
            if (onOpenHighwaySos) {
              onOpenHighwaySos();
            } else {
              onSelectCategory('Emergency Highway Assistance');
            }
          }}
          className="flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 text-[11px] cursor-pointer"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Highway SOS (24/7)</span>
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 border border-amber-300/60 shadow-md shrink-0 overflow-hidden ring-1 ring-amber-400/40">
            <img
              src="/assets/icon.png"
              alt="Quick Karya Running Technician Emblem"
              className="w-full h-full rounded-lg object-cover"
            />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none text-white flex items-center gap-1">
              Quick Karya
            </h1>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 mt-0.5">
              DIRECT ARTISAN CALL DIRECTORY
            </p>
          </div>
        </div>

        {/* Location Pill & Refresh Action */}
        <div className="flex items-center gap-1.5">
          <button
            id="header-location-pill"
            onClick={onOpenLocationModal}
            className="flex items-center gap-1.5 bg-[#0a2e5c] hover:bg-[#0f3d7a] border border-[#1e4d8c] rounded-full px-2.5 py-1 text-xs transition-colors cursor-pointer"
            title="Click to change location or use GPS"
          >
            {userLocation.isLiveGps ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              </span>
            ) : (
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}

            <div className="text-left max-w-[120px] truncate leading-tight">
              <span className="font-bold text-white text-[11px] block truncate">
                {userLocation.city || 'Select Area'}
              </span>
              {userLocation.pincode && (
                <span className="text-[9px] text-amber-300/80 block -mt-0.5">
                  {userLocation.pincode}
                </span>
              )}
            </div>

            <ChevronDown className="w-3 h-3 text-amber-300 shrink-0" />
          </button>

          <button
            id="header-gps-refresh-btn"
            onClick={onRefreshGps}
            className="p-1.5 rounded-full bg-[#0a2e5c] hover:bg-[#0f3d7a] text-amber-300 hover:text-white border border-[#1e4d8c] transition-colors cursor-pointer"
            title="Refresh GPS Coordinates"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
