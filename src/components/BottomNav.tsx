import React from 'react';
import { ActiveTab } from '../types';
import { Home, UserPlus, LayoutGrid, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  workersCount?: number;
  userName?: string;
  isLoggedIn?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  workersCount,
  userName,
  isLoggedIn
}) => {
  const isHomeActive = activeTab === 'home' || activeTab === 'workers';

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#001F3F] border-t border-[#0a2e5c] shadow-[0_-4px_20px_rgba(0,0,0,0.35)]"
    >
      <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-around">
        {/* Tab 1: Home (Proximity Directory) */}
        <button
          id="nav-tab-home"
          onClick={() => onChangeTab('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            isHomeActive
              ? 'text-amber-400 font-bold scale-102'
              : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                isHomeActive
                  ? 'bg-gradient-to-b from-[#133d73] to-[#00162e] border border-amber-400/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.5)]'
                  : 'bg-gradient-to-b from-[#0a2e5c]/70 to-[#00162e]/90 border border-[#1e4d8c]/40'
              }`}
            >
              <Home
                className={`w-4.5 h-4.5 transition-transform ${
                  isHomeActive ? 'stroke-[2.5] text-amber-400 drop-shadow-sm' : 'text-slate-300'
                }`}
              />
            </div>
            {workersCount !== undefined && (
              <span className="absolute -top-1 -right-2 bg-gradient-to-r from-amber-500 to-amber-600 text-[#001F3F] text-[9px] font-black px-1.5 rounded-full border border-amber-300 shadow-xs">
                {workersCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Home</span>
          {isHomeActive && (
            <span className="w-5 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mt-0.5 shadow-[0_0_6px_rgba(255,193,7,0.8)]" />
          )}
        </button>

        {/* Tab 2: Register (Worker Onboarding) */}
        <button
          id="nav-tab-register"
          onClick={() => onChangeTab('register')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'register'
              ? 'text-amber-400 font-bold scale-102'
              : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'register'
                  ? 'bg-gradient-to-b from-[#133d73] to-[#00162e] border border-amber-400/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.5)]'
                  : 'bg-gradient-to-b from-[#0a2e5c]/70 to-[#00162e]/90 border border-[#1e4d8c]/40'
              }`}
            >
              <UserPlus
                className={`w-4.5 h-4.5 stroke-[2.2] ${
                  activeTab === 'register' ? 'text-amber-400 drop-shadow-sm' : 'text-slate-300'
                }`}
              />
            </div>
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Register</span>
          {activeTab === 'register' && (
            <span className="w-5 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mt-0.5 shadow-[0_0_6px_rgba(255,193,7,0.8)]" />
          )}
        </button>

        {/* Tab 3: Categories */}
        <button
          id="nav-tab-categories"
          onClick={() => onChangeTab('categories')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'text-amber-400 font-bold scale-102'
              : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'categories'
                  ? 'bg-gradient-to-b from-[#133d73] to-[#00162e] border border-amber-400/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.5)]'
                  : 'bg-gradient-to-b from-[#0a2e5c]/70 to-[#00162e]/90 border border-[#1e4d8c]/40'
              }`}
            >
              <LayoutGrid
                className={`w-4.5 h-4.5 transition-transform ${
                  activeTab === 'categories' ? 'stroke-[2.5] text-amber-400 drop-shadow-sm' : 'text-slate-300'
                }`}
              />
            </div>
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Categories</span>
          {activeTab === 'categories' && (
            <span className="w-5 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mt-0.5 shadow-[0_0_6px_rgba(255,193,7,0.8)]" />
          )}
        </button>

        {/* Tab 4: My Profile */}
        <button
          id="nav-tab-profile"
          onClick={() => onChangeTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'profile'
              ? 'text-amber-400 font-bold scale-102'
              : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                activeTab === 'profile'
                  ? 'bg-gradient-to-b from-[#133d73] to-[#00162e] border border-amber-400/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.5)]'
                  : 'bg-gradient-to-b from-[#0a2e5c]/70 to-[#00162e]/90 border border-[#1e4d8c]/40'
              }`}
            >
              <User
                className={`w-4.5 h-4.5 transition-transform ${
                  activeTab === 'profile' ? 'stroke-[2.5] text-amber-400 drop-shadow-sm' : 'text-slate-300'
                }`}
              />
            </div>
            {isLoggedIn && (
              <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#001F3F] shadow-xs" />
            )}
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">My Profile</span>
          {activeTab === 'profile' && (
            <span className="w-5 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-full mt-0.5 shadow-[0_0_6px_rgba(255,193,7,0.8)]" />
          )}
        </button>
      </div>
    </nav>
  );
};
