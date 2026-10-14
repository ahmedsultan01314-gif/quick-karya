import React from 'react';
import { WorkerProfile } from '../types';
import { Phone, Star, ShieldCheck, MapPin, Briefcase, Zap, Info } from 'lucide-react';
import { formatDistance } from '../utils/geo';
import { formatWorkerPricing } from '../utils/pricing';

interface WorkerCardProps {
  worker: WorkerProfile;
  onCallNow: (worker: WorkerProfile) => void;
  onOpenRating?: (worker: WorkerProfile) => void;
  onOpenDetails?: (worker: WorkerProfile) => void;
}

export const WorkerCard: React.FC<WorkerCardProps> = ({
  worker,
  onCallNow,
  onOpenRating,
  onOpenDetails
}) => {
  const isEmergency = worker.category === 'Emergency Highway Assistance';
  const pricing = formatWorkerPricing(worker);

  const initials = worker.name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent triggering if clicked button
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    if (onOpenDetails) onOpenDetails(worker);
  };

  return (
    <div
      id={`worker-card-${worker.id}`}
      onClick={handleCardClick}
      className={`rounded-2xl bg-white border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md cursor-pointer ${
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
          {/* Worker Avatar: Profile Photo inside Circular Avatar Frame with Golden Rim */}
          {(() => {
            const avatarUrl = worker.photo || worker.avatar || worker.avatarUrl || worker.photoUrl;
            return (
              <div
                id={`worker-avatar-${worker.id}`}
                className="relative shrink-0 w-13 h-13 rounded-full bg-[#001F3F] text-amber-300 flex items-center justify-center font-black text-base shadow-md border-2 border-amber-400/80 overflow-hidden ring-1 ring-amber-500/30"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={worker.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span>{initials || 'WK'}</span>
                )}
                {worker.available && (
                  <span
                    title="Available Now"
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs z-10"
                  />
                )}
              </div>
            );
          })()}

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-bold text-gray-900 text-sm truncate">
                  {worker.name}
                </h3>
                {(worker.isVerified ?? worker.verified) && (
                  <span
                    id={`verified-badge-${worker.id}`}
                    title="Quick Karya Verified Artisan"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 shrink-0"
                  >
                    <ShieldCheck className="w-3 h-3 text-emerald-700" />
                    Verified
                  </span>
                )}
              </div>
            </div>

            {/* Sub-role & Experience */}
            <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-0.5 flex-wrap">
              <span className="font-semibold text-emerald-900 bg-emerald-50 px-1.5 py-0.2 rounded text-[11px]">
                {worker.category}
              </span>
              {worker.subRole && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-[11px] text-gray-600 font-medium">
                    {worker.subRole}
                  </span>
                </>
              )}
              <span className="text-gray-300">•</span>
              <span className="text-[11px] text-gray-500 font-medium">
                {worker.experience} yrs exp
              </span>
            </div>

            {/* Location & GPS Proximity */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1 flex-wrap">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate text-[11px]">
                {worker.city}{worker.state ? `, ${worker.state}` : ''}
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
              <span>{(worker.rating || 5.0).toFixed(1)}</span>
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              ({worker.reviewCount || 0} reviews)
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

        {/* Two-Button Action Row: Rate Artisan ⭐ and Call Worker 📞 */}
        <div className="pt-1.5 grid grid-cols-2 gap-2">
          {/* Rate Artisan Button with Vibrant Orange Outline */}
          <button
            type="button"
            id={`rate-artisan-btn-${worker.id}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenRating) onOpenRating(worker);
            }}
            className="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-amber-50/80 hover:bg-amber-100 text-[#001F3F] border-2 border-[#FFA500] hover:border-[#FFD700] shadow-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            <span>Rate Artisan ⭐</span>
          </button>

          {/* Primary Action: Call Worker in Deep Navy Blue #001F3F */}
          <button
            type="button"
            id={`call-now-btn-${worker.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onCallNow(worker);
            }}
            className="py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-[#001F3F] hover:bg-[#002e5d] active:bg-[#00162e] text-white shadow-md transition-all active:scale-[0.98] cursor-pointer ring-1 ring-blue-900/50"
          >
            <Phone className="w-3.5 h-3.5 fill-current text-amber-400" />
            <span>Call Worker</span>
          </button>
        </div>
      </div>
    </div>
  );
};
