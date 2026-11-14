import React, { useState, useEffect } from 'react';
import { AppUser, WorkerProfile, WorkerReview } from '../types';
import { getApiUrl } from '../config';
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
  Shield,
  Settings,
  Crop,
  PhoneCall
} from 'lucide-react';
import { PhotoCropModal } from './PhotoCropModal';
import { getCallHistory } from '../utils/callHistory';

interface ProfileViewProps {
  user: AppUser | null;
  onLoginClick: () => void;
  onLogout: () => void;
  workers: WorkerProfile[];
  onGoToRegister: () => void;
  onOpenSettings?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onLoginClick,
  onLogout,
  workers,
  onGoToRegister,
  onOpenSettings
}) => {
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [reviews, setReviews] = useState<WorkerReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Edit Name in-place without duplicate profile/ID creation
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [updatingName, setUpdatingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Photo Crop Tool modal state
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // Match worker profile by phone number or Worker ID
  useEffect(() => {
    if (user) {
      const cleanUserPhone = user.phone ? user.phone.replace(/[^0-9]/g, '').slice(-10) : '';
      const found = workers.find((w) => {
        const cleanWPhone = w.phone ? w.phone.replace(/[^0-9]/g, '').slice(-10) : '';
        return (cleanUserPhone && cleanWPhone === cleanUserPhone) || (user.workerId && w.workerId === user.workerId);
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
        <div className="w-16 h-16 rounded-full bg-amber-100 text-[#001F3F] flex items-center justify-center mx-auto mb-2">
          <User className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Welcome to Quick Karya</h3>
        <p className="text-xs text-gray-500 max-w-xs mx-auto">
          Sign in with your Google Account to view your permanent Worker ID, reviews, manage profile photos, and track service calls.
        </p>
        <button
          onClick={onLoginClick}
          className="px-6 py-3 bg-[#001F3F] hover:bg-[#002b54] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <span>Continue with Google</span>
        </button>
      </div>
    );
  }

  const handleSaveCroppedPhoto = async (croppedBase64: string) => {
    if (!user) return;
    setUpdatingPhoto(true);
    setPhotoError(null);
    try {
      const res = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          profilePhoto: croppedBase64
        })
      });
      if (!res.ok) throw new Error('Could not update profile photo');

      user.profilePhoto = croppedBase64;
      user.avatar = croppedBase64;
      localStorage.setItem('quick_karya_user', JSON.stringify(user));
      if (workerProfile) {
        workerProfile.photo = croppedBase64;
        workerProfile.avatar = croppedBase64;
      }
      setIsEditingPhoto(false);
      setIsCropModalOpen(false);
      setImageToCrop(null);
      setPhotoUrlInput('');
    } catch (err: any) {
      setPhotoError(err?.message || 'Failed to save cropped photo');
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const handleUpdatePhotoFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhotoError(null);
    if (!photoUrlInput.trim()) {
      setPhotoError('Please provide a valid image URL');
      return;
    }
    // Launch crop tool for the URL
    setImageToCrop(photoUrlInput.trim());
    setIsCropModalOpen(true);
  };

  // Convert uploaded image file via FileReader and launch crop tool
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose a valid PNG or JPEG image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError('Image must be under 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageToCrop(result);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setNameError('Please enter a valid name');
      return;
    }
    setUpdatingName(true);
    setNameError(null);
    try {
      const res = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          name: nameInput.trim()
        })
      });
      if (!res.ok) throw new Error('Could not update profile name');

      user.name = nameInput.trim();
      localStorage.setItem('quick_karya_user', JSON.stringify(user));
      if (workerProfile) {
        workerProfile.name = nameInput.trim();
      }
      setIsEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err: any) {
      setNameError(err?.message || 'Failed to update name');
    } finally {
      setUpdatingName(false);
    }
  };

  const isWorker = user.role === 'worker' || Boolean(workerProfile);
  const activeWorkerId = workerProfile?.workerId || user.workerId || `QK-${user.id.slice(-5).toUpperCase()}`;

  return (
    <div id="my-profile-container" className="space-y-4 pb-12 animate-in fade-in duration-150">
      {/* Instagram-Style Navigation Header with bold 'Settings' and 'Done' action buttons */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#001933] border border-[#FFA500]/30 rounded-2xl shadow-sm text-white">
        <span className="text-xs font-semibold text-[#FFD700]">Account</span>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white tracking-wide">My Profile</h2>
          {onOpenSettings && (
            <button
              type="button"
              id="profile-header-settings-btn"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#002b54] hover:bg-[#003d7a] border border-[#FFA500]/50 text-amber-300 hover:text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Open Settings"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>Settings</span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            if (isEditingPhoto) {
              if (photoUrlInput.trim()) {
                handleUpdatePhotoFromUrl(e);
              } else {
                setIsEditingPhoto(false);
              }
            } else {
              // Profile settings up to date
            }
          }}
          className="text-xs font-extrabold text-[#001F3F] bg-[#FFA500] hover:bg-[#FF8C00] px-4 py-1.5 rounded-full cursor-pointer shadow-md transition-all active:scale-95"
        >
          Done
        </button>
      </div>
      {/* Profile Card Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="bg-[#001F3F] p-5 text-white">
          <div className="flex items-center gap-4">
            {/* Avatar Photo */}
            <div className="relative group">
              <div className="w-16 h-16 rounded-full bg-[#002b54] border-2 border-[#FFA500] overflow-hidden flex items-center justify-center text-xl font-bold shadow-md">
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
                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#FFA500] hover:bg-[#FF8C00] text-white shadow-xs cursor-pointer"
                title="Change Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="space-y-1.5 py-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="text-xs font-bold text-gray-900 bg-white rounded-lg px-2.5 py-1 border border-amber-400 focus:outline-none w-full"
                      placeholder="Enter new profile name..."
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={updatingName}
                      className="px-2.5 py-1 bg-[#FFA500] hover:bg-[#FF8C00] text-[#001F3F] text-[11px] font-extrabold rounded-lg shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      {updatingName ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  {nameError && <p className="text-[10px] text-red-300">{nameError}</p>}
                </form>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold truncate">{user.name}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(true);
                      setNameInput(user.name);
                    }}
                    className="p-1 hover:bg-white/10 rounded-md text-amber-300 hover:text-white transition-colors cursor-pointer"
                    title="Edit Name"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {user.verified && (
                    <ShieldCheck className="w-4 h-4 text-[#FFD700] shrink-0" />
                  )}
                </div>
              )}

              {nameSuccess && (
                <p className="text-[10.5px] text-emerald-300 font-bold flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3 h-3 text-emerald-300" />
                  <span>Name updated across directory (ID preserved)</span>
                </p>
              )}

              <p className="text-xs text-[#FFD700] font-mono mt-0.5">{user.phone}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#001F3F]/80 text-[#FFD700] border border-[#FFA500]/40">
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
          <div className="p-4 bg-amber-50/50 border-b border-amber-200 space-y-3">
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

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Option 1: Choose photo from device (Crop & Zoom tool will open)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#001F3F] file:text-[#FFD700] hover:file:bg-[#002b54] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Option 2: Image URL
                </label>
                <form onSubmit={handleUpdatePhotoFromUrl} className="flex gap-2">
                  <input
                    type="url"
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 px-3 py-1.5 text-xs bg-white rounded-lg border border-gray-300"
                  />
                  <button
                    type="submit"
                    disabled={updatingPhoto || !photoUrlInput.trim()}
                    className="px-3 py-1.5 bg-[#001F3F] hover:bg-[#002b54] text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    Adjust & Save
                  </button>
                </form>
              </div>

              {(user.profilePhoto || workerProfile?.photo) && (
                <div className="pt-1 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = user.profilePhoto || workerProfile?.photo;
                      if (cur) {
                        setImageToCrop(cur);
                        setIsCropModalOpen(true);
                      }
                    }}
                    className="w-full py-1.5 px-3 bg-amber-100 hover:bg-amber-200 text-[#001F3F] text-xs font-bold rounded-lg border border-amber-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Crop className="w-3.5 h-3.5 text-[#FFA500]" />
                    <span>Fine-tune & Crop Current Photo Frame</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Worker Permanent Identity Card */}
        {isWorker && (
          <div className="p-4 space-y-3">
            <div className="p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#001F3F] uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-[#FFA500]" />
                  <span>Permanent Worker ID</span>
                </span>
                <span className="text-xs font-mono font-bold text-[#001F3F] bg-white px-2 py-0.5 rounded border border-[#FFA500] shadow-2xs">
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
                    <span className="text-[11px] text-[#FFA500] block mt-0.5">
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
                  className="mt-2 px-3 py-1.5 bg-[#001F3F] text-white rounded-lg text-xs font-bold cursor-pointer"
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
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
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

      {/* Recent Worker Calls Shortcut & Log Preview Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-[#FFA500]" />
            <h3 className="text-xs font-bold text-gray-900">
              Worker Call History ({getCallHistory().length})
            </h3>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
            >
              View All Logs →
            </button>
          )}
        </div>
        {getCallHistory().length > 0 ? (
          <div className="space-y-1.5">
            {getCallHistory().slice(0, 3).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-100 text-[11px]"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-bold text-gray-900 truncate">{log.workerName}</p>
                  <p className="text-[10px] text-amber-700 truncate">
                    {log.workerCategory} • {log.workerPhone}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-500">
            No calls made yet. Artisan and emergency highway contacts will be logged here.
          </p>
        )}
      </div>

      {/* Account Settings & Sign Out */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
        <h3 className="text-xs font-bold text-gray-700">Account Actions</h3>
        <button
          onClick={onLogout}
          className="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Interactive Photo Crop & Adjustment Tool Modal */}
      <PhotoCropModal
        isOpen={isCropModalOpen}
        imageSrc={imageToCrop}
        onClose={() => {
          setIsCropModalOpen(false);
          setImageToCrop(null);
        }}
        onCropComplete={handleSaveCroppedPhoto}
      />
    </div>
  );
};
