import React, { useState, useEffect } from 'react';
import { AppUser, WorkerProfile, WorkerReview } from '../types';
import {
  User,
  ShieldCheck,
  Phone,
  Briefcase,
  Star,
  MapPin,
  Calendar,
  Camera,
  LogOut,
  Edit2,
  Check,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Shield
} from 'lucide-react';

interface ProfileViewProps {
  user: AppUser | null;
  onLoginClick: () => void;
  onLogout: () => void;
  workers: WorkerProfile[];
  onGoToRegister: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onLoginClick,
  onLogout,
  workers,
  onGoToRegister
}) => {
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [reviews, setReviews] = useState<WorkerReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Match worker profile by phone number or Worker ID
  useEffect(() => {
    if (user) {
      const cleanUserPhone = user.phone.replace(/[^0-9]/g, '').slice(-10);
      const found = workers.find((w) => {
        const cleanWPhone = w.phone.replace(/[^0-9]/g, '').slice(-10);
        return cleanWPhone === cleanUserPhone || (user.workerId && w.workerId === user.workerId);
      });
      if (found) {
        setWorkerProfile(found);
      }
    }
  }, [user, workers]);

  // Load reviews if user is a worker
  useEffect(() => {
    if (workerProfile?.id) {
      setLoadingReviews(true);
      fetch(`/api/workers/${workerProfile.id}/reviews`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setReviews(data))
        .catch(() => setReviews([]))
        .finally(() => setLoadingReviews(false));
    }
  }, [workerProfile?.id]);

  if (!user) {
    return (
      <div className="space-y-4 py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-2">
          <User className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Welcome to Quick Karya</h3>
        <p className="text-xs text-gray-500 max-w-xs mx-auto">
          Sign in with your mobile number to view your permanent Worker ID, reviews, manage profile photos, and track service calls.
        </p>
        <button
          onClick={onLoginClick}
          className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
        >
          Sign In with Mobile OTP
        </button>
      </div>
    );
  }

  const handleUpdatePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhotoError(null);
    if (!photoUrlInput.trim()) {
      setPhotoError('Please provide a valid image URL');
      return;
    }

    setUpdatingPhoto(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          profilePhoto: photoUrlInput.trim()
        })
      });
      if (!res.ok) throw new Error('Could not update profile photo');

      // Update user locally
      user.profilePhoto = photoUrlInput.trim();
      localStorage.setItem('quick_karya_user', JSON.stringify(user));
      setIsEditingPhoto(false);
      setPhotoUrlInput('');
    } catch (err: any) {
      setPhotoError(err?.message || 'Failed to update photo');
    } finally {
      setUpdatingPhoto(false);
    }
  };

  // Convert uploaded image file via FileReader (Base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose a valid PNG or JPEG image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUpdatingPhoto(true);
      try {
        await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            profilePhoto: base64
          })
        });
        user.profilePhoto = base64;
        localStorage.setItem('quick_karya_user', JSON.stringify(user));
        setIsEditingPhoto(false);
      } catch (err) {
        setPhotoError('Error saving photo.');
      } finally {
        setUpdatingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const isWorker = user.role === 'worker' || Boolean(workerProfile);
  const activeWorkerId = workerProfile?.workerId || user.workerId || `QK-${user.id.slice(-5).toUpperCase()}`;

  return (
    <div id="my-profile-container" className="space-y-4 pb-12 animate-in fade-in duration-150">
      {/* Profile Card Header */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-950 p-5 text-white">
          <div className="flex items-center gap-4">
            {/* Avatar Photo */}
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-emerald-700 border-2 border-emerald-400/40 overflow-hidden flex items-center justify-center text-xl font-bold shadow-inner">
                {user.profilePhoto || workerProfile?.photo ? (
                  <img
                    src={user.profilePhoto || workerProfile?.photo}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  user.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <button
                onClick={() => setIsEditingPhoto(!isEditingPhoto)}
                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                title="Change Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold truncate">{user.name}</h2>
                {user.verified && (
                  <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                )}
              </div>
              <p className="text-xs text-emerald-200 font-mono mt-0.5">{user.phone}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-800/80 text-emerald-200 border border-emerald-700">
                  {user.role === 'worker' ? 'Artisan / Worker' : 'Customer'}
                </span>
                {isWorker && (
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 border border-amber-300/40">
                    ID: {activeWorkerId}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Change Photo Accordion Form */}
        {isEditingPhoto && (
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800">
                Upload or Change Profile Photo
              </span>
              <button
                onClick={() => setIsEditingPhoto(false)}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>

            {photoError && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{photoError}</span>
              </p>
            )}

            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-gray-600">
                Option 1: Choose from device (PNG, JPG)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-800 file:text-white hover:file:bg-emerald-900 cursor-pointer"
              />

              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Option 2: Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 px-3 py-1.5 text-xs bg-white rounded-lg border border-gray-300"
                  />
                  <button
                    onClick={handleUpdatePhoto}
                    disabled={updatingPhoto}
                    className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold"
                  >
                    {updatingPhoto ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Worker Permanent Identity Card */}
        {isWorker && (
          <div className="p-4 space-y-3">
            <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Permanent Worker ID</span>
                </span>
                <span className="text-xs font-mono font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300 shadow-2xs">
                  {activeWorkerId}
                </span>
              </div>
              <p className="text-[11px] text-gray-600">
                This ID is permanently saved on the backend and remains constant across all your sessions.
              </p>
            </div>

            {/* Profile Statistics */}
            {workerProfile ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                    Category
                  </span>
                  <span className="font-bold text-gray-900">{workerProfile.category}</span>
                  {workerProfile.subRole && (
                    <span className="text-[11px] text-emerald-700 block mt-0.5">
                      • {workerProfile.subRole}
                    </span>
                  )}
                </div>

                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                    Experience
                  </span>
                  <span className="font-bold text-gray-900">
                    {workerProfile.experience} Years
                  </span>
                </div>

                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                    Location
                  </span>
                  <span className="font-bold text-gray-900">
                    {workerProfile.city}, {workerProfile.pincode}
                  </span>
                </div>

                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                    Customer Rating
                  </span>
                  <span className="font-bold text-amber-700 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>{workerProfile.rating.toFixed(1)}</span>
                    <span className="text-gray-400 font-normal">
                      ({workerProfile.reviewCount})
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-1">
                <p className="text-xs font-bold text-amber-900">
                  Worker profile not published yet
                </p>
                <p className="text-[11px] text-amber-700">
                  Complete your registration to appear live in the proximity directory.
                </p>
                <button
                  onClick={onGoToRegister}
                  className="mt-2 px-3 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Register Profile Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Verified Reviews Section (if worker) */}
      {isWorker && (
        <div className="bg-white rounded-2xl border border-emerald-900/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Customer Reviews & Ratings ({reviews.length})</span>
            </h3>
          </div>

          {loadingReviews ? (
            <p className="text-xs text-gray-400 py-3 text-center">Loading reviews...</p>
          ) : reviews.length === 0 ? (
            <div className="text-center py-5 border border-dashed border-gray-200 rounded-xl">
              <p className="text-xs text-gray-500 font-medium">No reviews received yet</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Customers can rate you after completing a service call.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{rev.customerName}</span>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < rev.rating
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {rev.comment && <p className="text-gray-700">{rev.comment}</p>}
                  <p className="text-[10px] text-gray-400">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Account Settings & Sign Out */}
      <div className="bg-white rounded-2xl border border-emerald-900/10 p-4 space-y-2">
        <h3 className="text-xs font-bold text-gray-700">Account Actions</h3>
        <button
          onClick={onLogout}
          className="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
