import React, { useState } from 'react';
import { WorkerProfile, ServiceRequest, AppUser } from '../types';
import { Star, X, Check, AlertCircle, MessageSquare } from 'lucide-react';
import { getApiUrl } from '../config';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker?: WorkerProfile | null;
  serviceRequest?: ServiceRequest | null;
  currentUser?: AppUser | null;
  onRatingSubmitted: (updatedWorker?: { rating: number; reviewCount: number }) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '1 Star - Poor Service',
  2: '2 Stars - Fair / Needs Improvement',
  3: '3 Stars - Good Service',
  4: '4 Stars - Very Good & Punctual',
  5: '5 Stars - Excellent & Highly Recommended! ⭐'
};

export const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  worker,
  serviceRequest,
  currentUser,
  onRatingSubmitted
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const targetWorkerId = worker?.id || serviceRequest?.workerId;
  const targetWorkerName = worker?.name || serviceRequest?.workerName || 'Artisan';
  const targetCategory = worker?.category || serviceRequest?.workerCategory || 'Artisan';

  if (!targetWorkerId) return null;

  const activeRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const customerName = currentUser?.name || serviceRequest?.customerName || 'Verified Customer';
      const customerId = currentUser?.id || serviceRequest?.customerId || `cust-${Date.now()}`;

      const res = await fetch(getApiUrl('/api/reviews'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: targetWorkerId,
          customerId,
          customerName,
          rating,
          comment: comment.trim() || undefined,
          serviceRequestId: serviceRequest?.id || `direct-review-${Date.now()}`
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      setSuccess(true);
      setTimeout(() => {
        onRatingSubmitted(
          data.updatedRating && data.updatedReviewCount
            ? { rating: data.updatedRating, reviewCount: data.updatedReviewCount }
            : undefined
        );
        onClose();
        setSuccess(false);
        setComment('');
        setRating(5);
      }, 1400);
    } catch (err: any) {
      setError(err?.message || 'Could not submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="rating-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
    >
      <div
        id="rating-modal-card"
        className="w-full max-w-sm bg-[#0B192C] rounded-3xl shadow-2xl overflow-hidden border border-[#0a2e5c] flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-[#001F3F] p-5 text-white relative border-b border-[#FFA500]/30">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#FFD700] hover:text-white p-1 rounded-full cursor-pointer text-sm"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h3 className="text-base font-bold text-white">Rate Artisan</h3>
          </div>
          <p className="text-xs text-[#FFD700] mt-1 font-medium">
            {targetWorkerName} • <span className="font-semibold text-amber-200">{targetCategory}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/80 border border-red-500/60 text-red-200 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-6 space-y-2">
              <div className="w-14 h-14 bg-[#002b54] text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-xs border border-[#FFA500]">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <h4 className="text-base font-bold text-white">Review Submitted!</h4>
              <p className="text-xs text-slate-300">
                Your star rating and feedback have been saved to Cloud Firestore in real-time.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Picker */}
              <div className="text-center space-y-2 bg-[#001428] p-3.5 rounded-2xl border border-[#FFA500]/30">
                <label className="text-xs font-bold text-slate-200 block">
                  Tap to Select Stars (1 to 5)
                </label>
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-hidden cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= activeRating
                            ? 'fill-amber-400 text-amber-400 filter drop-shadow-xs'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs font-semibold text-amber-300 min-h-[18px]">
                  {RATING_LABELS[activeRating] || `${activeRating} Stars`}
                </p>
              </div>

              {/* Written Comment / Feedback */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  Written Feedback / Comment (Optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share feedback on their craftsmanship, punctuality, and behavior..."
                  rows={3}
                  className="w-full text-xs p-3 bg-[#001428] border border-[#0a2e5c] rounded-xl text-white placeholder-slate-400 focus:border-[#FFA500] focus:ring-1 focus:ring-[#FFA500] outline-hidden resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 px-3 bg-[#002b54] border border-[#0a2e5c] text-slate-200 rounded-xl text-xs font-semibold hover:bg-[#003d7a] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-3 bg-[#FFA500] hover:bg-[#FF8C00] active:bg-[#e07b00] text-[#001F3F] rounded-xl text-xs font-black disabled:opacity-50 cursor-pointer shadow-md transition-all"
                >
                  {loading ? 'Submitting...' : 'Submit Rating ⭐'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
