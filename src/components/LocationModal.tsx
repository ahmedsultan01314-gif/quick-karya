import React, { useState } from 'react';
import { KNOWN_LOCATIONS, CityCoord } from '../utils/geo';
import { UserLocation } from '../types';
import { MapPin, Navigation, Search, X, Check } from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: UserLocation;
  onRequestLiveGps: () => void;
  onSelectManualLocation: (coord: CityCoord) => void;
  onSearchCustomText: (text: string) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onRequestLiveGps,
  onSelectManualLocation,
  onSearchCustomText
}) => {
  const [searchInput, setSearchInput] = useState('');

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearchCustomText(searchInput.trim());
      onClose();
    }
  };

  return (
    <div
      id="location-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        id="location-modal-container"
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-emerald-950/10 transform transition-all animate-in slide-in-from-bottom-5 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-emerald-900 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-300" />
              Select Your Location
            </h3>
            <p className="text-xs text-emerald-200">
              Find nearest artisans with real GPS distance filtering
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-emerald-800 text-emerald-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Live Device GPS Option */}
          <button
            id="use-live-device-gps-btn"
            onClick={() => {
              onRequestLiveGps();
              onClose();
            }}
            className="w-full p-3.5 rounded-xl border-2 border-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center justify-between group transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Navigation className="w-5 h-5 group-hover:rotate-45 transition-transform" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-950">
                    Use Live Device GPS
                  </span>
                  {currentLocation.isLiveGps && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[10px] font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-800">
                  Detect current latitude/longitude &amp; pincode dynamically
                </p>
              </div>
            </div>
            {currentLocation.isLiveGps && (
              <Check className="w-5 h-5 text-emerald-700 shrink-0" />
            )}
          </button>

          {/* Search Input for Manual Area/Pincode */}
          <form onSubmit={handleCustomSubmit} className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700">
              Search City, District or Pincode
            </label>
            <div className="relative">
              <input
                id="location-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g., Agartala, Tripura or 799001"
                className="w-full pl-9 pr-20 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 px-3 py-1 bg-emerald-800 text-white text-xs font-semibold rounded-lg hover:bg-emerald-900"
              >
                Search
              </button>
            </div>
          </form>

          {/* Preset Major Service Hubs */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Popular Service Regions
            </p>
            <div className="space-y-1.5">
              {KNOWN_LOCATIONS.map((loc) => {
                const isSelected =
                  !currentLocation.isLiveGps &&
                  currentLocation.city.toLowerCase() === loc.city.toLowerCase();

                return (
                  <button
                    key={loc.city}
                    id={`select-location-${loc.city.toLowerCase()}`}
                    onClick={() => {
                      onSelectManualLocation(loc);
                      onClose();
                    }}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin
                        className={`w-4 h-4 ${
                          isSelected ? 'text-emerald-700' : 'text-gray-400'
                        }`}
                      />
                      <div>
                        <span className="text-sm font-medium">
                          {loc.city}, {loc.state}
                        </span>
                        <span className="text-xs text-gray-500 ml-1.5">
                          ({loc.pincode})
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-700" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
