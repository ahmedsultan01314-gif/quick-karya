import React, { useState, useEffect } from 'react';
import { WorkerProfile, WorkerReview } from '../types';
import { Star, Phone, MapPin, Briefcase, Award, ShieldCheck, X, Clock, MessageSquare } from 'lucide-react';
import { fetchReviewsForWorker } from '../firebase';

interface WorkerDetailModalProps {
  worker: WorkerProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onCallWorker: (worker: WorkerProfile) => void;
  onOpenRating: (worker: WorkerProfile) => void;
}

export const WorkerDetailModal: React.FC<WorkerDetailModalProps> = ({
  worker,
  isOpen,
  onClose,
  onCallWorker,
  onOpenRating
}) => {
  const [reviews, setReviews] = useState<WorkerReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && worker) {
      setLoadingReviews(true);
      fetchReviewsForWorker(worker.id)
        .then((data) => setReviews(data))
        .catch(() => setReviews([]))
        .finally(() => setLoadingReviews(false));
    }
  }, [isOpen, worker]);

  if (!isOpen || !worker) return null;

  const initials = worker.name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'WK';

  return (
    <div
      id="worker-detail-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="worker-detail-card"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-900/10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#001428] via-[#001F3F] to-[#002b57] p-5 text-white relative border-b border-[#0a2e5c]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-1.5 rounded-full cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            {/* Worker Avatar / Photo inside Circular Frame with Orange Rim */}
            <div className="relative shrink-0 w-18 h-18 rounded-full bg-[#001F3F] border-2 border-[#FFA500] shadow-md overflow-hidden flex items-center justify-center">
              {(() => {
                const avatarUrl = worker.photo || worker.avatar || worker.avatarUrl || worker.photoUrl;
                return avatarUrl ? (
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
                  <span className="font-black text-xl text-amber-300">{initials}</span>
                );
              })()}
              {worker.available && (
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white z-10" />
              )}
            </div>

            {/* Title Info */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-lg font-bold truncate text-white">{worker.name}</h3>
                {(worker.isVerified ?? worker.verified) && (
                  <span className="inline-flex items-center gap-1 bg-emerald-400/20 border border-emerald-400/50 text-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-emerald-300" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                {worker.category} {worker.subRole ? `• ${worker.subRole}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-bold text-xs border border-amber-400/40">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {(worker.rating || 5.0).toFixed(1)}
                </span>
                <span className="text-[11px] text-emerald-200">
                  ({worker.reviewCount || 0} reviews)
                </span>
                <span className="text-[11px] px-1.5 py-0.5 bg-emerald-800/80 rounded text-emerald-300 font-mono text-[10px]">
                  {worker.workerId || `QK-${worker.id.slice(-5).toUpperCase()}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Details Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-gray-800">
          {/* Key Facts Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-800 shrink-0" />
              <div>
                <span className="text-gray-400 text-[10px] block">Experience</span>
                <span className="font-bold text-gray-800">{worker.experience} Years</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-800 shrink-0" />
              <div className="min-w-0">
                <span className="text-gray-400 text-[10px] block">Location</span>
                <span className="font-bold text-gray-800 truncate block">
                  {worker.city}, {worker.state || 'India'}
                </span>
              </div>
            </div>
          </div>

          {/* Service Rates & Direct Call Guarantee */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-900 font-bold block">Service Charges</span>
              <span className="text-xs text-gray-600">
                100% Free Directory • Fair rate agreed upon call
              </span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-800 text-white rounded-lg text-xs font-bold shrink-0">
              Direct Contact
            </span>
          </div>

          {/* Skills Breakdown */}
          {worker.skills && worker.skills.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-700 mb-2">Skills & Specialties</h4>
              <div className="flex flex-wrap gap-1.5">
                {worker.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 font-medium border border-gray-200/60"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Customer Reviews Section */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-800" />
                  Customer Reviews & Ratings
                </h4>
                <p className="text-[11px] text-gray-500">
                  ⭐ {(worker.rating || 5.0).toFixed(1)} average from {worker.reviewCount || 0} customer reviews
                </p>
              </div>
              <button
                onClick={() => onOpenRating(worker)}
                className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Rate Artisan ⭐
              </button>
            </div>

            {loadingReviews ? (
              <div className="py-6 text-center text-xs text-gray-400">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-2xl text-center border border-gray-100 space-y-2">
                <p className="text-xs text-gray-500">
                  No written reviews yet for this artisan.
                </p>
                <button
                  onClick={() => onOpenRating(worker)}
                  className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  Be the first to submit a review →
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-800">{rev.customerName}</span>
                      <div className="flex items-center text-amber-500 font-bold">
                        {'★'.repeat(rev.rating)}
                        <span className="text-gray-300">{'★'.repeat(5 - rev.rating)}</span>
                      </div>
                    </div>
                    {rev.comment && (
                      <p className="text-gray-600 text-xs italic">
                        &quot;{rev.comment}&quot;
                      </p>
                    )}
                    <span className="text-[10px] text-gray-400 block">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          <button
            onClick={() => onOpenRating(worker)}
            className="flex-1 py-3 px-3 bg-amber-50 hover:bg-amber-100 text-[#001F3F] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border-2 border-[#FFA500] hover:border-[#FFD700] shadow-xs active:scale-[0.98]"
          >
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
            <span>Rate Artisan ⭐</span>
          </button>
          <button
            onClick={() => {
              onClose();
              onCallWorker(worker);
            }}
            className="flex-1 py-3 px-3 bg-[#001F3F] hover:bg-[#002e5d] active:bg-[#00162e] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-[0.98]"
          >
            <Phone className="w-3.5 h-3.5 fill-current text-amber-400" />
            <span>Call Worker</span>
          </button>
        </div>
      </div>
    </div>
  );
};
