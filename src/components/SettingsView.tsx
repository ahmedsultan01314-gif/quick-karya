import React, { useState } from 'react';
import { AppUser, UserLocation } from '../types';
import {
  Settings,
  Bell,
  MapPin,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  LogOut,
  Info,
  ChevronRight,
  Check,
  User,
  Radio,
  Sliders
} from 'lucide-react';

interface SettingsViewProps {
  user: AppUser | null;
  userLocation: UserLocation;
  onRequestLiveGps: () => void;
  onLogout: () => void;
  onDone: () => void;
  onRefreshDirectory?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  userLocation,
  onRequestLiveGps,
  onLogout,
  onDone,
  onRefreshDirectory
}) => {
  const [pushNotifs, setPushNotifs] = useState(true);
  const [callAlerts, setCallAlerts] = useState(true);
  const [sosAlerts, setSosAlerts] = useState(true);
  const [autoShareGps, setAutoShareGps] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);

  const handleClearCache = () => {
    setClearingCache(true);
    setTimeout(() => {
      try {
        if (typeof localStorage !== 'undefined') {
          const userBackup = localStorage.getItem('quick_karya_user');
          localStorage.clear();
          if (userBackup) {
            localStorage.setItem('quick_karya_user', userBackup);
          }
        }
      } catch {}
      if (onRefreshDirectory) onRefreshDirectory();
      setClearingCache(false);
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 3000);
    }, 600);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Instagram-Style Header with Done Button */}
      <div className="bg-[#001933] border-b border-[#FFA500]/30 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <button
          onClick={onDone}
          className="text-amber-400 font-semibold text-sm hover:text-amber-300 transition-colors cursor-pointer"
        >
          ‹ Home
        </button>
        <h2 className="text-white font-bold text-base tracking-wide flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-[#FFA500]" />
          Settings & Preferences
        </h2>
        <button
          onClick={onDone}
          className="bg-[#FFA500] hover:bg-[#FF8C00] active:scale-95 text-[#001F3F] font-black text-xs px-4 py-1.5 rounded-full shadow-md transition-all cursor-pointer"
        >
          Done
        </button>
      </div>

      <div className="px-3 space-y-4 max-w-md mx-auto">
        {/* Account Info Card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#FFA500] shadow-md shrink-0 bg-[#001F3F] flex items-center justify-center">
              {user?.profilePhoto || user?.avatar ? (
                <img
                  src={user.profilePhoto || user.avatar}
                  alt={user?.name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-7 h-7 text-amber-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-gray-900 text-sm truncate">
                  {user?.name || 'Quick Karya Member'}
                </h3>
                {user?.verified && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-300">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {user?.email || user?.phone || 'Direct Artisan Contact'}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#001F3F] text-amber-300 uppercase tracking-wide">
                  {user?.role === 'worker' ? 'Artisan / Worker' : 'Customer Account'}
                </span>
                {user?.workerId && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-[#001F3F] border border-amber-300">
                    ID: {user.workerId}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Settings */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Bell className="w-4 h-4 text-[#FFA500]" />
            <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
              Alerts & Notifications
            </h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">Push Notifications</p>
                <p className="text-[11px] text-gray-500">Receive in-app alerts on new calls and updates</p>
              </div>
              <button
                type="button"
                onClick={() => setPushNotifs(!pushNotifs)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  pushNotifs ? 'bg-[#FFA500]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    pushNotifs ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">Worker Call Prompt</p>
                <p className="text-[11px] text-gray-500">Alert worker when a client taps Call Worker</p>
              </div>
              <button
                type="button"
                onClick={() => setCallAlerts(!callAlerts)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  callAlerts ? 'bg-[#FFA500]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    callAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">Highway SOS Alerts</p>
                <p className="text-[11px] text-gray-500">Emergency roadside dispatch priority notifications</p>
              </div>
              <button
                type="button"
                onClick={() => setSosAlerts(!sosAlerts)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  sosAlerts ? 'bg-[#FFA500]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    sosAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Location & GPS Sharing Preferences */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <MapPin className="w-4 h-4 text-[#FFA500]" />
            <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
              Location & Service Navigation
            </h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-800">Detected Service Area</p>
                <p className="text-[11px] text-gray-500">
                  {userLocation.city || 'Agartala'}, {userLocation.state || 'Tripura'} ({userLocation.pincode || '799001'})
                </p>
              </div>
              <button
                onClick={onRequestLiveGps}
                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-[#001F3F] border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              >
                <Radio className="w-3.5 h-3.5 text-[#FFA500] animate-pulse" />
                <span>Re-check GPS</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <div>
                <p className="text-xs font-bold text-gray-800">Auto-Share GPS on Inquiries</p>
                <p className="text-[11px] text-gray-500">Generate Google Maps pin so artisans navigate directly</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoShareGps(!autoShareGps)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  autoShareGps ? 'bg-[#FFA500]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    autoShareGps ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Directory & App Management */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Sliders className="w-4 h-4 text-[#FFA500]" />
            <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider">
              Directory & Data Cache
            </h4>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="w-full py-2.5 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-800 flex items-center justify-between cursor-pointer transition-all"
            >
              <span className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 text-[#FFA500] ${clearingCache ? 'animate-spin' : ''}`} />
                {clearingCache ? 'Refreshing Directory...' : 'Refresh Directory & Clear Cache'}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            {clearedNotice && (
              <p className="text-[11px] text-emerald-600 font-bold text-center">
                ✓ Directory cache refreshed and synced with Cloud Firestore!
              </p>
            )}

            <button
              onClick={onLogout}
              className="w-full py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-600 flex items-center justify-between cursor-pointer transition-all"
            >
              <span className="flex items-center gap-2">
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                Switch Account / Sign Out
              </span>
              <ChevronRight className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>

        {/* App Information */}
        <div className="text-center py-3 space-y-1">
          <p className="text-xs font-black text-[#001F3F] tracking-wide">Quick Karya v3.2.0</p>
          <p className="text-[11px] text-gray-500">
            Direct Artisan Call Directory • Zero Middlemen • 100% Free Contact
          </p>
          <p className="text-[10px] text-gray-400">
            Connected to Cloud Firestore (Real-time Synced)
          </p>
        </div>
      </div>
    </div>
  );
};
