import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CATEGORIES, CATEGORY_SUB_ROLES } from '../data/categories';
import { INDIAN_STATES, getCitiesForState } from '../data/indianStates';
import {
  ServiceCategory,
  UserLocation,
  WorkerProfile
} from '../types';
import {
  UserPlus,
  CheckCircle2,
  Phone,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  Camera,
  Upload,
  X,
  ChevronDown,
  AlertCircle,
  MapPin,
  Navigation,
  Loader2
} from 'lucide-react';

interface RegisterWorkerProps {
  userLocation: UserLocation;
  onRequestGps: () => void;
  onWorkerRegistered: (worker: WorkerProfile) => void;
  onGoToWorkers: () => void;
}

// Preset artisan avatar samples for instant one-tap testing
const SAMPLE_AVATARS = [
  {
    name: 'Artisan 1',
    url: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=200&auto=format&fit=crop&q=80'
  },
  {
    name: 'Artisan 2',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
  },
  {
    name: 'Artisan 3',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
  }
];

export const RegisterWorker: React.FC<RegisterWorkerProps> = ({
  userLocation,
  onRequestGps,
  onWorkerRegistered,
  onGoToWorkers
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('Plumber');
  const [subRole, setSubRole] = useState<string>('');
  const [experience, setExperience] = useState('4');

  // Contact and Location
  const [phone, setPhone] = useState('');
  const [state, setState] = useState(userLocation.state || 'Tripura');
  const [city, setCity] = useState(userLocation.city || 'Agartala');
  const [pincode, setPincode] = useState(userLocation.pincode || '799001');
  const [photo, setPhoto] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Dynamic City combo-box & GPS auto-detection states
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  // State-filtered cities
  const stateCities = useMemo(() => getCitiesForState(state), [state]);
  const filteredCities = useMemo(() => {
    if (!city.trim()) return stateCities;
    const q = city.toLowerCase().trim();
    return stateCities.filter((c) => c.toLowerCase().includes(q));
  }, [stateCities, city]);

  // Auto-Detect via GPS handler
  const handleUseGpsLocation = () => {
    setGpsDetecting(true);
    setGpsNotice(null);
    setError(null);
    onRequestGps();

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setGpsDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data.state) setState(data.state);
            if (data.city) setCity(data.city);
            if (data.pincode) setPincode(data.pincode);
            setGpsNotice(`✓ Auto-filled: ${data.city || 'Area'}, ${data.state || ''} ${data.pincode ? `(${data.pincode})` : ''}`);
          } else if (userLocation.city) {
            if (userLocation.state) setState(userLocation.state);
            if (userLocation.city) setCity(userLocation.city);
            if (userLocation.pincode) setPincode(userLocation.pincode);
            setGpsNotice(`✓ Auto-filled from GPS: ${userLocation.city}, ${userLocation.state || ''}`);
          }
        } catch {
          if (userLocation.city) {
            if (userLocation.state) setState(userLocation.state);
            if (userLocation.city) setCity(userLocation.city);
            if (userLocation.pincode) setPincode(userLocation.pincode);
            setGpsNotice(`✓ Auto-filled: ${userLocation.city}`);
          }
        } finally {
          setGpsDetecting(false);
        }
      },
      (err) => {
        if (userLocation.city) {
          if (userLocation.state) setState(userLocation.state);
          if (userLocation.city) setCity(userLocation.city);
          if (userLocation.pincode) setPincode(userLocation.pincode);
          setGpsNotice(`✓ Auto-filled: ${userLocation.city}`);
        } else {
          setError(`GPS detection: ${err.message}`);
        }
        setGpsDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successWorker, setSuccessWorker] = useState<WorkerProfile | null>(null);

  // Image processing & client-side compression
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image file is too large. Please select a photo under 8MB.');
      return;
    }
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 500;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setPhoto(compressed);
        } else {
          setPhoto(dataUrl);
        }
      };
      img.onerror = () => {
        setPhoto(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!name.trim()) {
      setError('Please enter your full name or artisan team name.');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    if (!city.trim()) {
      setError('Please provide your service city.');
      return;
    }

    if (!state.trim()) {
      setError('Please select your state or union territory.');
      return;
    }

    const expNum = parseInt(experience, 10);
    if (isNaN(expNum) || expNum < 0 || expNum > 60) {
      setError('Please enter valid experience in years (0 to 60).');
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = cleanPhone.startsWith('91')
        ? `+${cleanPhone}`
        : `+91 ${cleanPhone.slice(-10, -5)} ${cleanPhone.slice(-5)}`;

      const payload = {
        name: name.trim(),
        category,
        subRole: subRole ? subRole.trim() : undefined,
        experience: expNum,
        hourlyRate: 0,
        rate: 0,
        phone: formattedPhone,
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        photo: photo || undefined
      };

      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to register worker profile.');
      }

      const data = await res.json();
      setSuccessWorker(data.worker);
      onWorkerRegistered(data.worker);
    } catch (err: any) {
      setError(err.message || 'Something went wrong while submitting.');
    } finally {
      setLoading(false);
    }
  };

  if (successWorker) {
    return (
      <div className="pb-20 pt-4 space-y-4">
        <div
          id="registration-success-card"
          className="bg-white rounded-3xl p-6 border border-emerald-300 shadow-lg text-center space-y-4"
        >
          {/* Avatar / Photo with Checkmark Badge */}
          <div className="relative w-20 h-20 mx-auto">
            {successWorker.photo ? (
              <img
                src={successWorker.photo}
                alt={successWorker.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-600 shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white flex items-center justify-center font-bold text-2xl shadow-md border border-emerald-700/30">
                {successWorker.name
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'WK'}
              </div>
            )}
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified &amp; Published Listing
            </span>
            <h2 className="text-xl font-extrabold text-gray-900 mt-2">
              Welcome to Quick Karya!
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Your profile for <strong className="text-emerald-900">{successWorker.name}</strong> is now live in the 100% free contact directory. Clients can find and call you directly!
            </p>
          </div>

          {/* Directory Details Breakdown */}
          <div className="bg-emerald-50 rounded-2xl p-4 text-left border border-emerald-100 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Service Category:</span>
              <span className="font-bold text-emerald-900">{successWorker.category}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500">Direct Phone:</span>
              <span className="font-bold font-mono text-gray-800">{successWorker.phone}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500">Experience:</span>
              <span className="font-bold text-gray-800">{successWorker.experience} years</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500">Location:</span>
              <span className="font-bold text-gray-800">
                {successWorker.city}{successWorker.state ? `, ${successWorker.state}` : ''} ({successWorker.pincode})
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              id="view-in-workers-btn"
              onClick={onGoToWorkers}
              className="w-full py-3.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>View Your Profile in Directory</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setSuccessWorker(null);
                setName('');
                setPhone('');
                setPhoto('');
              }}
              className="w-full py-2.5 px-4 text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Register Another Worker
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-2 space-y-4">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-700/80 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <UserPlus className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Worker Registration</h2>
            <p className="text-xs text-emerald-200 mt-0.5">
              100% free proximity contact directory — connect directly with clients
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          id="registration-error-alert"
          className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form (Only Profile Photo, Name, Category, Experience, Mobile, City, State, Pincode) */}
      <form
        id="worker-registration-form"
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-4 border border-emerald-900/10 shadow-xs space-y-4"
      >
        {/* Profile Photo Upload Field */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-emerald-700" />
              Profile Photo
            </span>
            <span className="text-[11px] font-normal text-emerald-800">
              Verified badge booster
            </span>
          </label>

          <input
            ref={fileInputRef}
            id="reg-input-photo-file"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {photo ? (
            <div className="flex items-center gap-3.5 p-3 rounded-xl border border-emerald-300 bg-emerald-50/50">
              <img
                src={photo}
                alt="Selected profile preview"
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-600 shadow-xs shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-emerald-900 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  Photo Attached
                </div>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                  Ready to display on your worker card
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                  >
                    Change photo
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-xl border-2 border-dashed transition-all text-center cursor-pointer flex flex-col items-center justify-center ${
                isDragging
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-gray-300 hover:border-emerald-600 hover:bg-emerald-50/30'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-gray-800">
                Click or drag &amp; drop to upload profile photo
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                JPG, PNG, WebP (or fallback initial badge will be used)
              </p>

              {/* Instant sample avatars option */}
              <div
                className="mt-3 pt-2.5 border-t border-gray-100 w-full flex items-center justify-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] text-gray-500 font-medium">Or pick sample:</span>
                <div className="flex items-center gap-1.5">
                  {SAMPLE_AVATARS.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPhoto(sample.url)}
                      className="w-7 h-7 rounded-full overflow-hidden border border-gray-300 hover:border-emerald-600 hover:scale-110 transition-transform cursor-pointer"
                      title={`Select ${sample.name}`}
                    >
                      <img
                        src={sample.url}
                        alt={sample.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Full Name or Team Name <span className="text-red-500">*</span>
          </label>
          <input
            id="reg-input-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rajesh Sharma"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm"
          />
        </div>

        {/* Category Dropdown */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Service Category <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="reg-select-category"
              value={category}
              onChange={(e) => {
                const newCat = e.target.value as ServiceCategory;
                setCategory(newCat);
                setSubRole('');
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm font-medium text-gray-900 cursor-pointer appearance-none pr-9"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} {c.name === 'Emergency Highway Assistance' ? '🚨 (24/7 Urgent)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* Sub-Role Selector for Categories with Specialized Roles */}
        {CATEGORY_SUB_ROLES[category] && (
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Select Specific Role / Sub-Role
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_SUB_ROLES[category]!.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSubRole(subRole === role ? '' : role)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    subRole === role
                      ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {subRole === role ? `✓ ${role}` : role}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Experience (Years) */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Experience (Years) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reg-input-experience"
              type="number"
              min="0"
              max="50"
              required
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="4"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm bg-white"
            />
            <Briefcase className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
          </div>
        </div>

        {/* Mobile Number */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Mobile Number (Calls will connect here) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reg-input-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm bg-white font-medium"
            />
            <Phone className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
          </div>
        </div>

        {/* Location Section Header with Auto-Detect via GPS Button */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-800" />
              <span>Service Location Details</span>
            </label>
            <button
              id="btn-use-gps-location"
              type="button"
              onClick={handleUseGpsLocation}
              disabled={gpsDetecting}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Auto-detect State, City, and Pincode using device GPS"
            >
              {gpsDetecting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                  <span>Locating...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3 h-3 text-emerald-700" />
                  <span>Use GPS Location</span>
                </>
              )}
            </button>
          </div>

          {/* GPS Detection Confirmation Banner */}
          {gpsNotice && (
            <div className="mb-2 p-2 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-800 font-medium flex items-center justify-between">
              <span>{gpsNotice}</span>
              <button
                type="button"
                onClick={() => setGpsNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 ml-2"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* State Selection */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            State <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="reg-select-state"
              value={state}
              onChange={(e) => {
                const newState = e.target.value;
                setState(newState);
                const newCities = getCitiesForState(newState);
                if (newCities.length > 0 && !newCities.includes(city)) {
                  setCity(newCities[0]);
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-medium text-gray-900 cursor-pointer appearance-none pr-9"
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* Dynamic City Selection: Combo-Box with State Filtering & Free Manual Typing */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-gray-700">
              City / Town <span className="text-red-500">*</span>
            </label>
            <span className="text-[11px] text-emerald-800 font-medium">
              Pick from {state} or type custom
            </span>
          </div>

          <div className="relative">
            <input
              id="reg-input-city"
              type="text"
              required
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setCityDropdownOpen(true);
              }}
              onFocus={() => setCityDropdownOpen(true)}
              placeholder={`Type or pick city in ${state}...`}
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm bg-white font-medium"
            />
            <button
              type="button"
              onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
              className="absolute right-2 top-2 p-1 text-gray-500 hover:text-emerald-800 cursor-pointer"
              title="Toggle city suggestions"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${cityDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Quick-select chips for top cities in current state */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5 pb-0.5">
            <span className="text-[10px] text-gray-400 font-medium shrink-0">Popular:</span>
            {stateCities.slice(0, 5).map((quickCity) => (
              <button
                key={quickCity}
                type="button"
                onClick={() => {
                  setCity(quickCity);
                  setCityDropdownOpen(false);
                }}
                className={`px-2 py-0.5 text-[11px] rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  city === quickCity
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {quickCity}
              </button>
            ))}
          </div>

          {/* Dropdown suggestions menu */}
          {cityDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
              <div className="p-2 border-b border-gray-100 flex items-center justify-between bg-gray-50 text-[11px] text-gray-500 font-medium sticky top-0">
                <span>Suggested in {state} ({filteredCities.length})</span>
                <button
                  type="button"
                  onClick={() => setCityDropdownOpen(false)}
                  className="text-gray-400 hover:text-gray-600 px-1"
                >
                  ✕ Close
                </button>
              </div>

              {/* Custom town option if typed text doesn't exactly match */}
              {city.trim() && !stateCities.some((c) => c.toLowerCase() === city.trim().toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => setCityDropdownOpen(false)}
                  className="w-full text-left px-3.5 py-2 text-xs text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 border-b border-emerald-100 flex items-center justify-between cursor-pointer"
                >
                  <span>✍️ Use custom: &quot;{city.trim()}&quot;</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">Custom</span>
                </button>
              )}

              {filteredCities.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setCity(item);
                    setCityDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    city === item
                      ? 'bg-emerald-800 text-white font-bold'
                      : 'hover:bg-emerald-50 text-gray-800'
                  }`}
                >
                  <span>{item}</span>
                  {city === item && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}

              {filteredCities.length === 0 && (
                <div className="p-3 text-center text-xs text-gray-500">
                  <p>No predefined cities match &quot;{city}&quot;</p>
                  <button
                    type="button"
                    onClick={() => setCityDropdownOpen(false)}
                    className="mt-1 text-[11px] text-emerald-800 font-bold underline cursor-pointer"
                  >
                    Keep custom city name &quot;{city}&quot;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pincode */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Pincode <span className="text-red-500">*</span>
          </label>
          <input
            id="reg-input-pincode"
            type="text"
            required
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="e.g. 799001"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm bg-white font-mono"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            id="submit-worker-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
          >
            {loading ? (
              <span>Saving Profile...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Publish Free Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
