import React, { useState } from 'react';
import { UserLocation } from '../types';
import {
  Search,
  Navigation,
  MapPin,
  X,
  Compass,
  Check,
  AlertCircle
} from 'lucide-react';
import { KNOWN_LOCATIONS, CityCoord } from '../utils/geo';

interface LocationBarProps {
  userLocation: UserLocation;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRequestLiveGps: () => void;
  onSelectCity: (coord: CityCoord) => void;
}

export const LocationBar: React.FC<LocationBarProps> = ({
  userLocation,
  searchQuery,
  onSearchChange,
  onRequestLiveGps,
  onSelectCity
}) => {
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [cityInput, setCityInput] = useState('');

  const handleCitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      onSearchChange(cityInput.trim());
      setIsSearchingLocation(false);
    }
  };

  return (
    <div className="space-y-2.5 pt-1">
      {/* Search Bar for Workers / Skills / Pincode */}
      <div className="relative">
        <input
          id="main-worker-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by worker, skill, or area (e.g. Agartala, Plumber)..."
          className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-white border border-emerald-950/15 shadow-xs text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent transition-all"
        />
        <Search className="w-4 h-4 text-emerald-800 absolute left-3 top-3" />
        {searchQuery && (
          <button
            id="clear-search-btn"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* GPS Status & Fallback Location Quick Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
        {/* Live GPS Button Chip */}
        <button
          id="chip-live-gps"
          onClick={onRequestLiveGps}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
            userLocation.isLiveGps
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
          }`}
        >
          <Navigation className={`w-3.5 h-3.5 ${userLocation.isLiveGps ? 'fill-white' : ''}`} />
          <span>{userLocation.isLiveGps ? 'Live GPS Active' : 'Use Live GPS'}</span>
        </button>

        {/* Fallback manual city chips as requested: "e.g., Agartala, Tripura or Bengaluru" */}
        <button
          id="chip-city-agartala"
          onClick={() => {
            const ag = KNOWN_LOCATIONS.find((l) => l.city === 'Agartala');
            if (ag) onSelectCity(ag);
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
            !userLocation.isLiveGps && userLocation.city === 'Agartala'
              ? 'bg-emerald-800 text-white font-semibold'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-900'
          }`}
        >
          Agartala, Tripura
        </button>

        <button
          id="chip-city-bengaluru"
          onClick={() => {
            const blr = KNOWN_LOCATIONS.find((l) => l.city === 'Bengaluru');
            if (blr) onSelectCity(blr);
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
            !userLocation.isLiveGps && userLocation.city === 'Bengaluru'
              ? 'bg-emerald-800 text-white font-semibold'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-900'
          }`}
        >
          Bengaluru
        </button>

        <button
          id="chip-city-delhi"
          onClick={() => {
            const del = KNOWN_LOCATIONS.find((l) => l.city === 'Delhi');
            if (del) onSelectCity(del);
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
            !userLocation.isLiveGps && userLocation.city === 'Delhi'
              ? 'bg-emerald-800 text-white font-semibold'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-900'
          }`}
        >
          Delhi NCR
        </button>

        <button
          id="chip-city-mumbai"
          onClick={() => {
            const mum = KNOWN_LOCATIONS.find((l) => l.city === 'Mumbai');
            if (mum) onSelectCity(mum);
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
            !userLocation.isLiveGps && userLocation.city === 'Mumbai'
              ? 'bg-emerald-800 text-white font-semibold'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-900'
          }`}
        >
          Mumbai
        </button>
      </div>

      {/* Proximity Sorting Notification */}
      <div className="flex items-center justify-between text-[11px] text-emerald-900/80 px-1">
        <span className="flex items-center gap-1 font-medium">
          <Compass className="w-3.5 h-3.5 text-emerald-700" />
          <span>Showing nearest verified providers first</span>
        </span>

        {userLocation.latitude && userLocation.longitude && (
          <span className="text-[10px] text-gray-500 font-mono">
            {userLocation.latitude.toFixed(3)}°N, {userLocation.longitude.toFixed(3)}°E
          </span>
        )}
      </div>

      {/* Denied GPS Banner if user declined */}
      {userLocation.status === 'denied' && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">GPS permission was blocked or unavailable.</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Switched to manual search mode. Select Agartala, Bengaluru, or type your city above.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
