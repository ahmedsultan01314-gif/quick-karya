import React from 'react';
import { WorkerProfile } from '../types';
import { Phone, Star, ShieldCheck, MapPin, Briefcase, Zap, Bike, Car, Truck, HardHat } from 'lucide-react';
import { formatDistance } from '../utils/geo';
import { formatWorkerPricing } from '../utils/pricing';

interface WorkerCardProps {
  worker: WorkerProfile;
  onCallNow: (worker: WorkerProfile) => void;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onCallNow }) => {
  const isEmergency = worker.category === 'Emergency Highway Assistance';
  const pricing = formatWorkerPricing(worker);

  const initials = worker.name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      id={`worker-card-${worker.id}`}
      className={`rounded-2xl bg-white border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
        isEmergency
          ? 'border-amber-400/80 ring-1 ring-amber-300/40 bg-gradient-to-b from-amber-50/20 to-white'
          : 'border-emerald-900/10 hover:border-emerald-700/40'
      }`}
    >
      {/* Top Banner for Emergency Highway Assistance */}
      {isEmergency && (
        <div className="bg-gradient-to-r from-amber-600 to-emerald-800 text-white text-[11px] font-bold px-3 py-1 flex items-center justify-between tracking-wide">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 fill-white text-white" />
            24/7 RAPID HIGHWAY RESPONSE
          </span>
          <span className="bg-white/20 text-white px-1.5 py-0.2 rounded text-[10px]">ON CALL</span>
        </div>
      )}

      <div className="p-4 space-y-3.5">
        {/* Header: Avatar, Name, Category, Verified */}
        <div className="flex items-start gap-3">
          {/* Worker Avatar: Profile Photo or Forest Green Initial Placeholder */}
          <div
            id={`worker-avatar-${worker.id}`}
            className="relative flex-shrink-0 w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white flex items-center justify-center font-bold text-lg shadow-sm border border-emerald-700/30 overflow-hidden"
          >
            {worker.photo ? (
              <img
                src={worker.photo}
                alt={worker.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
            {!worker.photo && <span>{initials || 'WK'}</span>}
            {worker.available && (
              <span
                title="Available Now"
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs z-10"
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 truncate leading-tight tracking-tight">
                {worker.name}
              </h3>
              {(worker.isVerified ?? worker.verified) ? (
                <span
                  id={`worker-verified-${worker.id}`}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-full text-[11px] font-semibold"
                  title="Quick Karya Verified Professional"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Verified</span>
                </span>
              ) : null}
            </div>

            {/* Profession, Driver Vehicle Badge & Experience */}
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-600 flex-wrap">
              <span className="font-semibold text-emerald-800">{worker.category}</span>

              {worker.subRole && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                    {worker.subRole}
                  </span>
                </>
              )}

              {pricing.vehicleBadge && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100/80 text-emerald-900 font-bold text-[10px] rounded-md">
                    {pricing.vehicleBadge.includes('JCB') || pricing.vehicleBadge.includes('Bulldozer') ? (
                      <HardHat className="w-3 h-3 text-amber-700" />
                    ) : pricing.vehicleBadge.includes('Truck') ||
                      pricing.vehicleBadge.includes('Freight') ||
                      pricing.vehicleBadge.includes('Trailer') ||
                      pricing.vehicleBadge.includes('Pickup') ? (
                      <Truck className="w-3 h-3 text-emerald-700" />
                    ) : pricing.vehicleBadge.includes('2-Wheeler') ? (
                      <Bike className="w-3 h-3 text-emerald-700" />
                    ) : (
                      <Car className="w-3 h-3 text-emerald-700" />
                    )}
                    <span>{pricing.vehicleBadge}</span>
                  </span>
                </>
              )}

              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1 text-gray-600">
                <Briefcase className="w-3 h-3 text-gray-400" />
                {worker.experience} yrs exp
              </span>
            </div>

            {/* Location & Live GPS Distance */}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="inline-flex items-center gap-1 text-emerald-900 font-medium">
                <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>
                  {worker.city}
                  {worker.state ? `, ${worker.state}` : ''}
                </span>
                {worker.pincode && <span className="text-gray-400">({worker.pincode})</span>}
              </span>

              {worker.distanceKm !== undefined && (
                <>
                  <span className="text-gray-300">•</span>
                  <span
                    id={`worker-distance-${worker.id}`}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-100/70 text-emerald-900 font-bold text-[11px]"
                  >
                    {formatDistance(worker.distanceKm)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Middle Stats: Rating & Availability */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {/* Rating & Reviews */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200/70 rounded-lg text-amber-900 text-xs font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>{worker.rating.toFixed(1)}</span>
            </div>
            <span className="text-[11px] text-gray-500">
              ({worker.reviewCount} reviews)
            </span>
          </div>

          {/* Availability Status */}
          <div>
            {worker.available ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Available Now
              </span>
            ) : (
              <span className="text-[11px] font-medium text-gray-400">Next available soon</span>
            )}
          </div>
        </div>

        {/* Skills Pills */}
        {worker.skills && worker.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {worker.skills.slice(0, 3).map((skill, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-normal"
              >
                {skill}
              </span>
            ))}
            {worker.skills.length > 3 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-md text-gray-500">
                +{worker.skills.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Prominent Call Button */}
        <div className="pt-1">
          <button
            id={`call-now-btn-${worker.id}`}
            onClick={() => onCallNow(worker)}
            className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer ${
              isEmergency
                ? 'bg-gradient-to-r from-amber-600 via-emerald-700 to-emerald-800 hover:from-amber-700 hover:to-emerald-900 text-white shadow-emerald-900/20'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-emerald-950/20'
            }`}
          >
            <Phone className="w-4 h-4 fill-current" />
            <span>Call Worker</span>
          </button>
        </div>
      </div>
    </div>
  );
};
