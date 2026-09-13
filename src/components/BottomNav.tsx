import React from 'react';
import { ActiveTab } from '../types';
import { Users, UserPlus, LayoutGrid } from 'lucide-react';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  workersCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, workersCount }) => {
  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-emerald-900/10 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {/* Tab 1: Workers (Home) */}
        <button
          id="nav-tab-workers"
          onClick={() => onChangeTab('workers')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'workers'
              ? 'text-emerald-800 font-bold scale-102'
              : 'text-gray-500 hover:text-emerald-700 font-medium'
          }`}
        >
          <div className="relative">
            <Users
              className={`w-5 h-5 transition-transform ${
                activeTab === 'workers' ? 'stroke-[2.5] text-emerald-800' : ''
              }`}
            />
            {workersCount !== undefined && (
              <span className="absolute -top-1 -right-2 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1 rounded-full border border-emerald-300">
                {workersCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Workers</span>
          {activeTab === 'workers' && (
            <span className="w-4 h-0.5 bg-emerald-700 rounded-full mt-0.5" />
          )}
        </button>

        {/* Tab 2: Register (Worker Onboarding) */}
        <button
          id="nav-tab-register"
          onClick={() => onChangeTab('register')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'register'
              ? 'text-emerald-800 font-bold scale-102'
              : 'text-gray-500 hover:text-emerald-700 font-medium'
          }`}
        >
          <div className="relative">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                activeTab === 'register'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800'
              }`}
            >
              <UserPlus className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <span className="text-[11px] mt-0.5 tracking-tight">Register</span>
          {activeTab === 'register' && (
            <span className="w-4 h-0.5 bg-emerald-700 rounded-full mt-0.5" />
          )}
        </button>

        {/* Tab 3: Categories */}
        <button
          id="nav-tab-categories"
          onClick={() => onChangeTab('categories')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'text-emerald-800 font-bold scale-102'
              : 'text-gray-500 hover:text-emerald-700 font-medium'
          }`}
        >
          <div className="relative">
            <LayoutGrid
              className={`w-5 h-5 transition-transform ${
                activeTab === 'categories' ? 'stroke-[2.5] text-emerald-800' : ''
              }`}
            />
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Categories</span>
          {activeTab === 'categories' && (
            <span className="w-4 h-0.5 bg-emerald-700 rounded-full mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
};
