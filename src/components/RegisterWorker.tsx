import React, { useState, useRef, useEffect } from 'react';
import { CATEGORIES } from '../data/categories';
import { INDIAN_STATES } from '../data/indianStates';
import {
  DriverVehicleType,
  NightRateConfig,
  PricingType,
  ServiceCategory,
  UserLocation,
  WorkerProfile
} from '../types';
import {
  calculateNightRate,
  DRIVER_VEHICLE_OPTIONS,
  formatWorkerPricing,
  getDefaultPricingForCategory,
  PRICING_TYPE_LABELS
} from '../utils/pricing';
import {
  UserPlus,
  CheckCircle2,
  MapPin,
  Phone,
  Briefcase,
  IndianRupee,
  Navigation,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Camera,
  Upload,
  X,
  ChevronDown,
  Moon,
  Clock,
  Bike,
  Car,
  Percent,
  Zap,
  Info
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
  const selectedCategory = category;
  const [experience, setExperience] = useState('4');

  // Dynamic Pricing State
  const [pricingType, setPricingType] = useState<PricingType>('per_hour');
  const [rateAmount, setRateAmount] = useState('300');

  // Driver Vehicle Type State
  const [vehicleType, setVehicleType] = useState<DriverVehicleType>(
    '2-Wheeler (Bike / Rapido Style)'
  );

  // Late Night Charges State
  const [lateNightAvailable, setLateNightAvailable] = useState(false);
  const [nightChargeType, setNightChargeType] = useState<'percentage' | 'fixed'>('percentage');
  const [nightExtraCharge, setNightExtraCharge] = useState('20'); // 20% or ₹100

  // Contact and Location
  const [phone, setPhone] = useState('');
  const [state, setState] = useState(userLocation.state || 'Tripura');
  const [city, setCity] = useState(userLocation.city || 'Agartala');
  const [pincode, setPincode] = useState(userLocation.pincode || '799001');
  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('Hindi, Local');
  const [photo, setPhoto] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successWorker, setSuccessWorker] = useState<WorkerProfile | null>(null);

  // Handle Category Change with Intelligent Pricing & Vehicle Defaults
  const handleCategoryChange = (newCategory: ServiceCategory) => {
    setCategory(newCategory);

    if (newCategory === 'Driver') {
      const defaultVehicle = '2-Wheeler (Bike / Rapido Style)';
      setVehicleType(defaultVehicle);
      setPricingType('per_km');
      setRateAmount('10');
    } else {
      setLateNightAvailable(false);
      const { pricingType: defPricing, defaultRate } = getDefaultPricingForCategory(newCategory);
      const safePricing = defPricing === 'per_km' ? 'per_hour' : defPricing;
      setPricingType(safePricing);
      setRateAmount(defaultRate.toString());
    }
  };

  // Safety guard: ensure pricingType is never 'per_km' for non-driver categories
  useEffect(() => {
    if (category !== 'Driver' && pricingType === 'per_km') {
      setPricingType('per_hour');
      setRateAmount('350');
    }
  }, [category, pricingType]);

  // Handle Vehicle Type Change for Drivers
  const handleVehicleTypeChange = (newVehicle: DriverVehicleType) => {
    setVehicleType(newVehicle);
    if (newVehicle === '2-Wheeler (Bike / Rapido Style)') {
      setPricingType('per_km');
      setRateAmount('10');
    } else if (newVehicle === '3-Wheeler (Auto / E-Rickshaw)') {
      setPricingType('per_km');
      setRateAmount('15');
    } else if (newVehicle === '4-Wheeler (Car / Commercial Vehicle)') {
      // 4-Wheeler can be per_km or per_day
      if (pricingType !== 'per_km' && pricingType !== 'per_day') {
        setPricingType('per_km');
      }
      setRateAmount(pricingType === 'per_day' ? '1200' : '18');
    }
  };

  // Auto-fill from user GPS
  const handleUseGpsLocation = () => {
    if (userLocation.state) {
      const matched = INDIAN_STATES.find(
        (s) => s.toLowerCase() === userLocation.state?.toLowerCase()
      );
      if (matched) {
        setState(matched);
      } else {
        setState(userLocation.state);
      }
    }
    if (userLocation.city) {
      setCity(userLocation.city);
    }
    if (userLocation.pincode) {
      setPincode(userLocation.pincode);
    }
    if (!userLocation.isLiveGps) {
      onRequestGps();
    }
  };

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

  // Calculate live preview of night rate
  const numericBaseRate = parseFloat(rateAmount) || 0;
  const numericNightExtra = parseFloat(nightExtraCharge) || 0;
  const calculatedNightRate = calculateNightRate(
    numericBaseRate,
    nightChargeType,
    numericNightExtra
  );
  const currentUnit = PRICING_TYPE_LABELS[pricingType]?.unit || '/hr';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!name.trim()) {
      setError('Please enter your full name or service team name.');
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

    const rateNum = rateAmount.trim() ? parseInt(rateAmount, 10) : 0;
    if (pricingType === 'fixed_job') {
      if (isNaN(rateNum) || rateNum < 0) {
        setError('Please enter a valid visiting / inspection fee (₹0 or more).');
        return;
      }
    } else {
      const minRate = pricingType === 'per_km' ? 5 : 50;
      if (isNaN(rateNum) || rateNum < minRate) {
        setError(
          pricingType === 'per_km'
            ? 'Please enter a valid rate per kilometer (minimum ₹5/km).'
            : 'Please enter a realistic service rate (minimum ₹50).'
        );
        return;
      }
    }

    if (category === 'Driver' && !vehicleType) {
      setError('Please select your vehicle category (2-Wheeler, 3-Wheeler, or 4-Wheeler).');
      return;
    }

    let nightConfig: NightRateConfig | undefined;
    const isLateNightForDriver = selectedCategory === 'Driver' && lateNightAvailable;
    if (isLateNightForDriver) {
      const extraVal = parseFloat(nightExtraCharge) || 0;
      if (extraVal <= 0) {
        setError('Please enter a valid late-night extra charge amount or percentage.');
        return;
      }
      nightConfig = {
        enabled: true,
        type: nightChargeType,
        extraValue: extraVal,
        effectiveNightRate: calculatedNightRate
      };
    }

    setLoading(true);

    try {
      const formattedPhone = cleanPhone.startsWith('91')
        ? `+${cleanPhone}`
        : `+91 ${cleanPhone.slice(-10, -5)} ${cleanPhone.slice(-5)}`;

      const payload = {
        name: name.trim(),
        category,
        experience: expNum,
        hourlyRate: rateNum, // backwards compatibility
        rate: rateNum,
        pricingType,
        rateUnit: currentUnit,
        vehicleType: category === 'Driver' ? vehicleType : undefined,
        lateNightAvailable: isLateNightForDriver,
        nightRates: isLateNightForDriver ? nightConfig : undefined,
        phone: formattedPhone,
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        skills:
          skills.trim() ||
          (category === 'Driver'
            ? `${vehicleType} driver services`
            : `${category} services`),
        languages: languages.trim(),
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
    const pricing = formatWorkerPricing(successWorker);

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
              Your profile for <strong className="text-emerald-900">{successWorker.name}</strong> is now live. Customers in {successWorker.city}{successWorker.state ? `, ${successWorker.state}` : ''} can find and call you directly!
            </p>
          </div>

          {/* Pricing & Service Breakdown */}
          <div className="bg-emerald-50 rounded-2xl p-4 text-left border border-emerald-100 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Service Category:</span>
              <span className="font-bold text-emerald-900">{successWorker.category}</span>
            </div>

            {successWorker.vehicleType && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Vehicle Type:</span>
                <span className="font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded">
                  {successWorker.vehicleType}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-500">Standard Rate:</span>
              <span className="font-extrabold text-sm text-emerald-950">
                {pricing.displayRate}
              </span>
            </div>

            {pricing.hasNightRate && (
              <div className="flex justify-between items-center pt-1 border-t border-emerald-200/50">
                <span className="text-purple-800 font-semibold flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-purple-700" />
                  Night Rate (8 PM - 6 AM):
                </span>
                <span className="font-bold text-purple-950 bg-purple-100 px-2 py-0.5 rounded">
                  {pricing.displayNightRate}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-500">Direct Phone:</span>
              <span className="font-bold font-mono text-gray-800">{successWorker.phone}</span>
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
              <span>View Your Profile in Workers Tab</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setSuccessWorker(null);
                setName('');
                setPhone('');
                setSkills('');
                setPhoto('');
                setLateNightAvailable(false);
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
            <h2 className="text-lg font-bold">Worker Onboarding</h2>
            <p className="text-xs text-emerald-200 mt-0.5">
              Register with flexible rates (per-hour, per-day, per-km, or fixed) and night charges
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

      {/* Onboarding Form */}
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
            Full Name or Service Team Name <span className="text-red-500">*</span>
          </label>
          <input
            id="reg-input-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Rajesh Sharma or Tripura Fast Electricians"
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
              onChange={(e) => handleCategoryChange(e.target.value as ServiceCategory)}
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
          {category === 'Emergency Highway Assistance' && (
            <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg mt-1.5 border border-amber-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>⚡ Fixed Service Fee (₹/job) is automatically selected for rapid highway response.</span>
            </p>
          )}
        </div>

        {/* DRIVER VEHICLE TYPE SELECTION (MANDATORY WHEN CATEGORY IS 'Driver') */}
        {category === 'Driver' && (
          <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-emerald-700" />
                Select Vehicle Category <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-300">
                Rapido / Transit Mode
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DRIVER_VEHICLE_OPTIONS.map((opt) => {
                const isSelected = vehicleType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleVehicleTypeChange(opt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-800 text-white shadow-sm'
                        : 'border-emerald-200 bg-white hover:border-emerald-400 text-gray-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{opt.title}</span>
                        {opt.id.includes('2-Wheeler') ? (
                          <Bike className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-200' : 'text-emerald-700'}`} />
                        ) : opt.id.includes('3-Wheeler') ? (
                          <span className={`text-[11px] font-bold ${isSelected ? 'text-emerald-200' : 'text-emerald-700'}`}>🛺</span>
                        ) : (
                          <Car className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-200' : 'text-emerald-700'}`} />
                        )}
                      </div>
                      <p className={`text-[10px] mt-0.5 line-clamp-2 ${isSelected ? 'text-emerald-100' : 'text-gray-500'}`}>
                        {opt.subtitle}
                      </p>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-white/20 flex items-center justify-between text-[10px] font-semibold">
                      <span className={isSelected ? 'text-emerald-200' : 'text-emerald-800'}>
                        {opt.id.includes('4-Wheeler') ? '₹/km or ₹/day' : 'Per-KM (₹/km)'}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-emerald-900/80 bg-emerald-100/50 p-2 rounded-lg flex items-start gap-1">
              <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                {vehicleType.includes('2-Wheeler')
                  ? 'Rapido-style 2-Wheeler rides calculate charges per kilometer (₹/km). Default: ₹10/km.'
                  : vehicleType.includes('3-Wheeler')
                  ? 'Auto & E-Rickshaws operate on per-kilometer billing (₹/km). Default: ₹15/km.'
                  : '4-Wheelers can be booked on per-kilometer (₹/km) or daily hire (₹/day).'}
              </span>
            </p>
          </div>
        )}

        {/* DYNAMIC PRICING SYSTEM */}
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-emerald-700" />
              Pricing Structure &amp; Rate Type <span className="text-red-500">*</span>
            </span>
            <span className="text-[10px] text-gray-500">
              Auto-configured for {category}
            </span>
          </div>

          {/* Pricing Type Selector Tabs */}
          <div
            id="reg-pricing-type-selector"
            className={`grid gap-1.5 ${
              category === 'Driver'
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-3'
            }`}
          >
            {(Object.keys(PRICING_TYPE_LABELS) as PricingType[])
              .filter((typeKey) => typeKey !== 'per_km' || category === 'Driver')
              .map((typeKey) => {
                const info = PRICING_TYPE_LABELS[typeKey];
                const isSelected = pricingType === typeKey;
                // If driver 2-wheeler or 3-wheeler, disable non-km options
                const isDriverLocked =
                  category === 'Driver' &&
                  (vehicleType.includes('2-Wheeler') || vehicleType.includes('3-Wheeler')) &&
                  typeKey !== 'per_km';

                return (
                  <button
                    key={typeKey}
                    id={`reg-pricing-tab-${typeKey}`}
                    type="button"
                    disabled={isDriverLocked}
                    onClick={() => {
                      setPricingType(typeKey);
                      // Update recommended rate
                      if (typeKey === 'per_km') setRateAmount('12');
                      else if (typeKey === 'per_day') setRateAmount('700');
                      else if (typeKey === 'fixed_job') setRateAmount('150');
                      else setRateAmount('350');
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                        : isDriverLocked
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-600'
                    }`}
                  >
                    {typeKey === 'fixed_job' ? (
                      <div>
                        <div className="font-bold text-[11px] leading-tight">
                          On Inspection / Negotiable
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            isSelected ? 'text-emerald-200' : 'text-gray-500'
                          }`}
                        >
                          (काम देखकर तय होगा)
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-[11px]">{info.shortLabel}</div>
                        <div
                          className={`text-[10px] ${
                            isSelected ? 'text-emerald-200' : 'text-gray-500'
                          }`}
                        >
                          ({info.unit})
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Experience & Rate Amount in 2 Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                <span>
                  {pricingType === 'fixed_job' ? (
                    <>Visiting / Inspection Fee (Optional ₹)</>
                  ) : (
                    <>Base Rate <span className="text-red-500">*</span></>
                  )}
                </span>
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                  {pricingType === 'fixed_job' ? 'Optional' : currentUnit}
                </span>
              </label>
              <div className="relative">
                <input
                  id="reg-input-rate-amount"
                  type="number"
                  min={pricingType === 'fixed_job' ? 0 : pricingType === 'per_km' ? 5 : 50}
                  step={pricingType === 'per_km' ? 1 : 25}
                  required={pricingType !== 'fixed_job'}
                  value={rateAmount}
                  onChange={(e) => setRateAmount(e.target.value)}
                  placeholder={
                    pricingType === 'fixed_job'
                      ? '0 (or e.g. 150)'
                      : PRICING_TYPE_LABELS[pricingType]?.placeholder || '300'
                  }
                  className="w-full pl-8 pr-16 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-extrabold text-emerald-950 bg-white"
                />
                <IndianRupee className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
                <span className="text-xs font-bold text-gray-500 absolute right-3 top-3">
                  {pricingType === 'fixed_job' ? '₹ visit' : currentUnit}
                </span>
              </div>
              {pricingType === 'fixed_job' && (
                <p className="text-[10px] text-gray-500 mt-1">
                  Optional: enter ₹0 or leave blank if you do not charge a visiting fee.
                </p>
              )}
            </div>
          </div>

          <div
            id="reg-customer-display-preview"
            className="text-[11px] text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200 flex items-center justify-between flex-wrap gap-1"
          >
            <span className="font-semibold text-gray-700">Customer Display Preview:</span>
            <span className="font-extrabold text-xs text-emerald-900">
              {pricingType === 'fixed_job'
                ? numericBaseRate > 0
                  ? `Rates Negotiable (Visiting Charge: ₹${numericBaseRate})`
                  : 'Final Rate After Work Inspection'
                : `₹${rateAmount || '0'}${currentUnit}`}
            </span>
          </div>
        </div>

        {/* LATE NIGHT CHARGES (8 PM - 6 AM) - Strictly for Driver only */}
        {selectedCategory === 'Driver' && (
          <div className={`p-3.5 rounded-2xl border transition-all ${
            lateNightAvailable
              ? 'bg-purple-50/70 border-purple-300 shadow-xs'
              : 'bg-gray-50/80 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  lateNightAvailable ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    Late Night Availability (8 PM - 6 AM)
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Earn extra surcharge on emergency &amp; late callouts
                  </span>
                </div>
              </div>

              {/* Switch Toggle */}
              <button
                type="button"
                id="toggle-late-night-btn"
                onClick={() => setLateNightAvailable(!lateNightAvailable)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                  lateNightAvailable ? 'bg-purple-700 justify-end' : 'bg-gray-300 justify-start'
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform" />
              </button>
            </div>

            {lateNightAvailable && (
              <div className="mt-3.5 pt-3 border-t border-purple-200/80 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-950">
                    Late Night Extra Charge Type
                  </span>
                  <div className="inline-flex rounded-lg border border-purple-300 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNightChargeType('percentage');
                        setNightExtraCharge('20');
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                        nightChargeType === 'percentage'
                          ? 'bg-purple-700 text-white'
                          : 'text-purple-800 hover:bg-purple-50'
                      }`}
                    >
                      + Percentage (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNightChargeType('fixed');
                        setNightExtraCharge(pricingType === 'per_km' ? '5' : '100');
                      }}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                        nightChargeType === 'fixed'
                          ? 'bg-purple-700 text-white'
                          : 'text-purple-800 hover:bg-purple-50'
                      }`}
                    >
                      + Fixed Extra (₹)
                    </button>
                  </div>
                </div>

                {/* Night Charge Input */}
                <div>
                  <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                    {nightChargeType === 'percentage'
                      ? 'Extra Percentage (e.g., 20% extra at night)'
                      : `Fixed Extra Amount in ₹ (added ${currentUnit})`}
                  </label>
                  <div className="relative">
                    <input
                      id="reg-input-night-charge"
                      type="number"
                      min="1"
                      required={lateNightAvailable}
                      value={nightExtraCharge}
                      onChange={(e) => setNightExtraCharge(e.target.value)}
                      placeholder={nightChargeType === 'percentage' ? '20' : '100'}
                      className="w-full pl-8 pr-12 py-2 rounded-lg border border-purple-300 bg-white text-xs font-bold text-purple-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                    {nightChargeType === 'percentage' ? (
                      <Percent className="w-3.5 h-3.5 text-purple-600 absolute left-2.5 top-2.5" />
                    ) : (
                      <IndianRupee className="w-3.5 h-3.5 text-purple-600 absolute left-2.5 top-2.5" />
                    )}
                    <span className="text-xs font-bold text-purple-700 absolute right-3 top-2">
                      {nightChargeType === 'percentage' ? '%' : `₹${currentUnit}`}
                    </span>
                  </div>
                </div>

                {/* Night Rate Calculation Banner */}
                <div className="p-2.5 bg-purple-100/70 rounded-xl border border-purple-200 text-xs text-purple-950 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-purple-800 block">Recalculated Night Rate:</span>
                    <span className="font-extrabold text-sm text-purple-950">
                      ₹{calculatedNightRate}{currentUnit}
                    </span>
                  </div>
                  <div className="text-right text-[11px] font-semibold text-purple-800">
                    <span>Day: ₹{numericBaseRate}{currentUnit}</span>
                    <span className="block text-[10px] text-purple-600">
                      (+{nightChargeType === 'percentage' ? `${nightExtraCharge}%` : `₹${nightExtraCharge}`})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Phone Number */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Phone Number (for direct calls) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="reg-input-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 98621 12345"
              className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-mono"
            />
            <Phone className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Clients will tap "Call Now" to call this phone number directly.
          </p>
        </div>

        {/* Location Section with State Dropdown, City, Pincode & GPS Auto-fill */}
        <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-700" />
              Service Location
            </span>
            <button
              type="button"
              id="autofill-gps-btn"
              onClick={handleUseGpsLocation}
              className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-xs cursor-pointer"
            >
              <Navigation className="w-3 h-3 text-emerald-700" />
              <span>Use Current GPS</span>
            </button>
          </div>

          {/* Indian State Selection Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Indian State / Union Territory <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="reg-select-state"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer appearance-none"
              >
                <option value="" disabled>Select State / Union Territory</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-2.5 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                City / Town <span className="text-red-500">*</span>
              </label>
              <input
                id="reg-input-city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Agartala or Bengaluru"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Pincode
              </label>
              <input
                id="reg-input-pincode"
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 799001"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Skills & Specialties */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Special Skills / Key Services
          </label>
          <input
            id="reg-input-skills"
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder={
              category === 'Driver'
                ? 'e.g., Fast city commute, Helmet provided, Parcel drop'
                : 'e.g., Water motor repair, Leakage fix, CPVC piping'
            }
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
          />
        </div>

        {/* Languages */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Languages Spoken
          </label>
          <input
            id="reg-input-languages"
            type="text"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            placeholder="e.g., Hindi, Bengali, English"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
          />
        </div>

        {/* Submit Button */}
        <button
          id="submit-worker-btn"
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold rounded-xl shadow-md text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
        >
          {loading ? (
            <span>Listing Profile...</span>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Complete Onboarding &amp; Publish Listing</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-gray-400 text-center">
          By registering, you agree to receive customer inquiries via direct call on Quick Karya.
        </p>
      </form>
    </div>
  );
};
