import React, { useState, useEffect } from 'react';
import {
  NotificationBannerData,
  subscribeToNotificationBanners
} from '../utils/notifications';
import { CheckCircle2, Phone, Bell, X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const [activeBanner, setActiveBanner] = useState<NotificationBannerData | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationBanners((banner) => {
      setActiveBanner(banner);
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setActiveBanner((current) => (current?.id === banner.id ? null : current));
      }, 5000);
      return () => clearTimeout(timer);
    });

    return unsubscribe;
  }, []);

  if (!activeBanner) return null;

  const isSuccess = activeBanner.type === 'success';
  const isCall = activeBanner.type === 'call';

  return (
    <div
      id="in-app-notification-toast"
      className="fixed top-4 left-4 right-4 z-50 max-w-sm mx-auto animate-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div
        className={`p-3.5 rounded-2xl shadow-xl border backdrop-blur-md flex items-start gap-3 text-left ${
          isSuccess
            ? 'bg-emerald-950/95 border-emerald-500/50 text-white'
            : isCall
            ? 'bg-emerald-900/95 border-emerald-400/50 text-white'
            : 'bg-gray-900/95 border-gray-700 text-white'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isSuccess
              ? 'bg-emerald-600 text-white'
              : isCall
              ? 'bg-emerald-700 text-white'
              : 'bg-gray-800 text-white'
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          ) : isCall ? (
            <Phone className="w-5 h-5 text-emerald-200" />
          ) : (
            <Bell className="w-5 h-5 text-gray-200" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-xs font-bold leading-tight tracking-tight text-white">
            {activeBanner.title}
          </h4>
          <p className="text-[11px] text-emerald-100/90 mt-0.5 leading-snug">
            {activeBanner.body}
          </p>
          <span className="text-[9px] text-emerald-300 font-mono mt-1 block">
            Just now • Quick Karya Alert
          </span>
        </div>

        <button
          onClick={() => setActiveBanner(null)}
          className="text-white/60 hover:text-white p-1 rounded-full shrink-0 cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
