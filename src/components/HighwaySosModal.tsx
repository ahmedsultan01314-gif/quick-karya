import React, { useState } from 'react';
import { UserLocation, AppUser, WorkerProfile } from '../types';
import {
  ShieldAlert,
  Phone,
  MessageCircle,
  Truck,
  Wrench,
  Fuel,
  MapPin,
  Copy,
  Check,
  X,
  Clock,
  Navigation,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { triggerCallWorkerNotification } from '../utils/notifications';

interface HighwaySosModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: UserLocation;
  currentUser: AppUser | null;
  emergencyWorkers: WorkerProfile[];
  onCallWorker: (worker: WorkerProfile) => void;
}

export const HighwaySosModal: React.FC<HighwaySosModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  currentUser,
  emergencyWorkers,
  onCallWorker
}) => {
  const [copiedCoords, setCopiedCoords] = useState(false);

  if (!isOpen) return null;

  const lat = userLocation.latitude ? userLocation.latitude.toFixed(5) : '23.83150';
  const lng = userLocation.longitude ? userLocation.longitude.toFixed(5) : '91.28680';
  const locationLabel = `${userLocation.city || 'Agartala'}, ${userLocation.state || 'Tripura'}${
    userLocation.pincode ? ` (${userLocation.pincode})` : ''
  }`;

  const copyCoordinates = () => {
    const text = `GPS: ${lat}, ${lng} (${locationLabel}) https://maps.google.com/?q=${lat},${lng}`;
    navigator.clipboard?.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2500);
  };

  const handleSosCall = (phone: string, serviceTitle: string) => {
    triggerCallWorkerNotification(
      serviceTitle,
      phone,
      'Emergency Highway Assistance',
      currentUser?.name || 'Driver in Distress',
      currentUser?.phone || ''
    );
    window.location.href = `tel:${phone}`;
  };

  const handleSosWhatsApp = (phone: string, serviceTitle: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const coords = `${lat}, ${lng}`;
    const msg = `🚨 *HIGHWAY SOS (24/7) - ${serviceTitle.toUpperCase()} REQUEST*
Hello, I am stranded on the highway and need urgent assistance:
📍 Location: ${locationLabel}
🌐 GPS Coordinates: ${coords}
🗺️ Google Maps: https://maps.google.com/?q=${coords}
👤 Driver: ${currentUser?.name || 'Driver in Distress'}
📱 Phone: ${currentUser?.phone || ''}
Please dispatch assistance immediately!`;

    const targetPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const emergencyServices = [
    {
      id: 'towing',
      title: 'Towing Support',
      hindiTitle: 'टोइंग सहायता',
      desc: '24/7 Flatbed towing, hydraulic crane recovery, highway ditch winch & pull-out.',
      phone: '+919862154321',
      dispatchTime: '15–30 Min Rapid Dispatch',
      icon: Truck,
      color: 'amber'
    },
    {
      id: 'mechanic',
      title: 'On-Spot Mechanic',
      hindiTitle: 'ऑन-स्पॉट मैकेनिक',
      desc: 'Highway puncture repair, tyre change, battery jump start, engine overheating & clutch repair.',
      phone: '+919862154322',
      dispatchTime: 'Mobile Garage Van',
      icon: Wrench,
      color: 'blue'
    },
    {
      id: 'fuel',
      title: 'Fuel Delivery',
      hindiTitle: 'आपातकालीन पेट्रोल-डीजल',
      desc: 'Emergency 5L–10L sealed canister petrol/diesel delivered directly to your stranded car or truck.',
      phone: '+919862154323',
      dispatchTime: 'Rapid Canister Delivery',
      icon: Fuel,
      color: 'amber'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-red-500/20 overflow-hidden">
        {/* Urgent Alert Header */}
        <div className="bg-gradient-to-r from-red-700 via-red-800 to-amber-700 text-white p-4 shrink-0 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
                <ShieldAlert className="w-6 h-6 animate-pulse text-amber-300" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-950/60 border border-red-400/30 text-[10px] font-black text-amber-300 tracking-wider uppercase">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
                  24/7 Roadside Assistance
                </div>
                <h2 className="text-lg font-black tracking-tight leading-tight mt-0.5">
                  Highway SOS Emergency
                </h2>
                <p className="text-xs text-red-100 font-medium">
                  Instant Towing, On-Spot Mechanic &amp; Fuel Delivery
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/90 hover:text-white transition-colors cursor-pointer"
              title="Close SOS screen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Helpline Pills */}
          <div className="mt-3 flex items-center gap-2 text-xs">
            <a
              href="tel:1033"
              className="flex-1 py-1.5 px-3 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-center font-bold text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-amber-300" />
              <span>NHAI Highway: 1033</span>
            </a>
            <a
              href="tel:112"
              className="flex-1 py-1.5 px-3 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl text-center font-bold text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-red-300" />
              <span>National SOS: 112</span>
            </a>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Live GPS Coordinates Card */}
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-950 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-amber-700" />
                Live Breakdown Location
              </span>
              <button
                type="button"
                onClick={copyCoordinates}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              >
                {copiedCoords ? <Check className="w-3 h-3 text-[#FFA500]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCoords ? 'Copied!' : 'Copy GPS'}</span>
              </button>
            </div>

            <div className="text-xs text-amber-900">
              <div className="font-semibold text-gray-900">{locationLabel}</div>
              <div className="font-mono text-[11px] text-amber-800 mt-0.5">
                Lat: {lat}, Lng: {lng}
              </div>
            </div>
            <p className="text-[10px] text-amber-700 leading-tight">
              Share these exact coordinates with rescue mechanics &amp; towing dispatchers so they locate you easily on the highway.
            </p>
          </div>

          {/* Emergency Services (Towing Support, On-Spot Mechanic, Fuel Delivery) */}
          <div className="space-y-3">
            <div className="text-xs font-black uppercase text-gray-500 tracking-wider">
              Emergency Highway Services (Quick Dial &amp; WhatsApp)
            </div>

            {emergencyServices.map((srv) => {
              const Icon = srv.icon;
              return (
                <div
                  key={srv.id}
                  className="bg-white rounded-2xl p-3.5 border border-gray-200 shadow-xs hover:border-red-300 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900">{srv.title}</h3>
                          <span className="text-[11px] text-gray-500">{srv.hindiTitle}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-red-700 font-bold mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{srv.dispatchTime}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">{srv.desc}</p>

                  {/* Action buttons: Quick-Dial Call & WhatsApp */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSosCall(srv.phone, srv.title)}
                      className="py-2.5 px-3 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSosWhatsApp(srv.phone, srv.title)}
                      className="py-2.5 px-3 bg-[#FFA500] hover:bg-[#FF8C00] active:bg-[#e07b00] text-[#001F3F] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp SOS</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Genuine Registered Highway Artisans or Clean Empty State */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-700">
                Independent Highway Rescue Artisans ({emergencyWorkers.length})
              </span>
              <span className="text-[10px] text-[#001F3F] font-semibold">100% Genuine Direct Contacts</span>
            </div>

            {emergencyWorkers.length > 0 ? (
              <div className="space-y-2">
                {emergencyWorkers.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-gray-900">{w.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {w.city}, {w.state} • {w.experience} yrs exp
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCallWorker(w)}
                      className="px-3 py-1.5 bg-[#FFA500] hover:bg-[#FF8C00] text-[#001F3F] text-xs font-black rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call Artisan</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* Clean Empty State - Zero fake/dummy listings */
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-center space-y-1.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-[#001F3F] flex items-center justify-center mx-auto text-sm font-bold">
                  ✓
                </div>
                <div className="text-xs font-bold text-gray-800">
                  0 Independent Rescue Teams in Sector
                </div>
                <p className="text-[11px] text-gray-500 max-w-xs mx-auto leading-relaxed">
                  No independent roadside workers currently registered here. Zero dummy profiles maintained. Please use the 24/7 Rapid Emergency Dispatch services above or National Highway Helpline 1033.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="p-3 bg-gray-100 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500 shrink-0">
          <span>Quick Karya Highway Emergency Network</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-700 font-semibold transition-colors cursor-pointer"
          >
            Close SOS Screen
          </button>
        </div>
      </div>
    </div>
  );
};
