import React, { useState } from 'react';
import { WorkerProfile, ServiceRequest } from '../types';
import { Star, X, Check, AlertCircle } from 'lucide-react';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceRequest: ServiceRequest | null;
  onRatingSubmitted: () => void;
}

export const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  serviceRequest,
  onRatingSubmitted
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen || !serviceRequest) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: serviceRequest.workerId,
          customerId: serviceRequest.customerId,
          customerName: serviceRequest.customerName,
          rating,
          comment: comment.trim() || undefined,
          serviceRequestId: serviceRequest.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      setSuccess(true);
      setTimeout(() => {
        onRatingSubmitted();
        onClose();
        setSuccess(false);
        setComment('');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Could not submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="rating-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div
        id="rating-modal-card"
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-900/10 flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-200 hover:text-white p-1 rounded-full cursor-pointer text-sm"
          >
            ✕
          </button>
          <h3 className="text-base font-bold">Rate Your Completed Service</h3>
          <p className="text-xs text-emerald-200 mt-0.5">
            Artisan: {serviceRequest.workerName} ({serviceRequest.workerCategory})
          </p>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center py-6 space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Thank You!</h4>
              <p className="text-xs text-gray-500">
                Your genuine star rating has been permanently recorded.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Picker */}
              <div className="text-center space-y-2">
                <label className="text-xs font-bold text-gray-700 block">
                  Select Rating (1 to 5 Stars)
                </label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 transition-transform hover:scale-110 cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= (hoverRating ?? rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-bold text-amber-700">
                  {rating === 5
                    ? '5.0 - Excellent Service'
                    : rating === 4
                    ? '4.0 - Good Experience'
                    : rating === 3
                    ? '3.0 - Average'
                    : rating === 2
                    ? '2.0 - Needs Improvement'
                    : '1.0 - Poor'}
                </span>
              </div>

              {/* Written Review */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Optional Written Review
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details about punctuality, work quality, or polite behavior..."
                  rows={3}
                  maxLength={300}
                  className="w-full p-3 text-xs bg-gray-50 rounded-xl border border-gray-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Submitting Review...' : 'Submit Rating & Review'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
