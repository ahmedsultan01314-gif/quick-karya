import React, { useState, useRef, useEffect } from 'react';
import { CATEGORIES } from '../data/categories';
import { INDIAN_STATES } from '../data/indianStates';
import {
  DriverVehicleType,
  PricingType,
  ServiceCategory,
  UserLocation,
  WorkerProfile,
  WorkerRateOption
} from '../types';
import {
  DRIVER_SPECIALIZATION_GROUPS,
  DRIVER_VEHICLE_OPTIONS,
  formatSingleRate,
  formatWorkerPricing,
  getDefaultPricingForCategory,
  isHeavyMachineryDriver,
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
  Truck,
  HardHat,
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

  // Helper to compute initial rate defaults
  const getDefaultRateForType = (
    type: PricingType,
    cat: ServiceCategory,
    vType?: DriverVehicleType
  ): string => {
    if (cat === 'Driver') {
      const isHeavy = vType ? isHeavyMachineryDriver(vType) : false;
      if (isHeavy) {
        if (type === 'day_shift') return vType === 'JCB Machine Operator' ? '2500' : '3000';
        if (type === 'night_shift') return vType === 'JCB Machine Operator' ? '3000' : '3500';
        if (type === 'per_hour') return vType === 'JCB Machine Operator' ? '450' : '550';
        if (type === 'fixed_job') return '150';
        return '2500';
      }
      if (type === 'per_month') {
        if (vType?.includes('16-Wheeler')) return '38000';
        if (vType?.includes('14-Wheeler')) return '35000';
        if (vType?.includes('12-Wheeler')) return '32000';
        if (vType?.includes('10-Wheeler')) return '28000';
        if (vType?.includes('6-Wheeler')) return '25000';
        if (vType?.includes('4-Wheeler')) return '22000';
        return '20000';
      }
      if (type === 'per_day') {
        if (vType?.includes('16-Wheeler') || vType?.includes('14-Wheeler')) return '1800';
        if (vType?.includes('12-Wheeler') || vType?.includes('10-Wheeler')) return '1400';
        if (vType?.includes('6-Wheeler') || vType?.includes('4-Wheeler')) return '1000';
        return '850';
      }
      if (type === 'per_hour') {
        return vType?.includes('Truck') || vType?.includes('Freight') || vType?.includes('Trailer')
          ? '250'
          : '150';
      }
      if (type === 'fixed_job') return '150';
      return '850';
    }

    if (type === 'per_hour') {
      if (cat === 'Emergency Highway Assistance') return '500';
      if (cat === 'Welder') return '350';
      if (cat === 'Plumber' || cat === 'Electrician') return '350';
      if (cat === 'Carpenter' || cat === 'Painter') return '400';
      if (cat === 'Rajmistri / Mason') return '450';
      if (cat === 'Labour / Helper') return '250';
      if (cat === 'Cook') return '300';
      return '300';
    }
    if (type === 'per_day') {
      if (cat === 'Welder') return '950';
      if (cat === 'Rajmistri / Mason') return '900';
      if (cat === 'Painter') return '850';
      if (cat === 'Carpenter') return '850';
      if (cat === 'Plumber' || cat === 'Electrician') return '800';
      if (cat === 'Labour / Helper') return '600';
      if (cat === 'Cook') return '700';
      return '700';
    }
    if (type === 'per_month') {
      if (cat === 'Welder') return '24000';
      if (cat === 'Cook') return '15000';
      if (cat === 'Labour / Helper') return '14000';
      return '20000';
    }
    if (type === 'fixed_job') {
      if (cat === 'Emergency Highway Assistance') return '500';
      return '150';
    }
    return '300';
  };

  const getAvailablePricingTypes = (cat: ServiceCategory, vType: DriverVehicleType): PricingType[] => {
    if (cat === 'Driver') {
      if (isHeavyMachineryDriver(vType)) {
        return ['day_shift', 'night_shift', 'per_hour', 'fixed_job'];
      }
      return ['per_day', 'per_month', 'per_hour', 'fixed_job'];
    }
    if (cat === 'Emergency Highway Assistance') {
      return ['fixed_job', 'per_hour'];
    }
    return ['per_hour', 'per_day', 'per_month', 'fixed_job'];
  };

  // Dynamic Multi-Select Pricing State
  const [selectedPricingTypes, setSelectedPricingTypes] = useState<PricingType[]>(['per_hour', 'per_day']);
  const [ratesMap, setRatesMap] = useState<Record<string, string>>({
    per_hour: '350',
    per_day: '800',
    per_month: '20000',
    day_shift: '2500',
    night_shift: '3000',
    fixed_job: '150'
  });

  const primaryPricingType = selectedPricingTypes[0] || 'per_hour';
  const pricingType = primaryPricingType;
  const rateAmount = ratesMap[primaryPricingType] || '350';
  const setPricingType = (pt: PricingType) => {
    if (!selectedPricingTypes.includes(pt)) {
      setSelectedPricingTypes([pt, ...selectedPricingTypes]);
    }
  };
  const setRateAmount = (val: string) => {
    setRatesMap((prev) => ({ ...prev, [primaryPricingType]: val }));
  };

  const togglePricingType = (typeKey: PricingType) => {
    if (selectedPricingTypes.includes(typeKey)) {
      if (selectedPricingTypes.length > 1) {
        setSelectedPricingTypes((prev) => prev.filter((t) => t !== typeKey));
      }
    } else {
      setSelectedPricingTypes((prev) => [...prev, typeKey]);
      if (!ratesMap[typeKey] || ratesMap[typeKey] === '0') {
        const def = getDefaultRateForType(typeKey, category, vehicleType);
        setRatesMap((prev) => ({ ...prev, [typeKey]: def }));
      }
    }
  };

  // Driver Vehicle Type State
  const [vehicleType, setVehicleType] = useState<DriverVehicleType>(
    'Private Car Driver (Family, Outstation, Local Trips)'
  );

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

  // Handle Category Change with Intelligent Multi-Pricing & Vehicle Defaults
  const handleCategoryChange = (newCategory: ServiceCategory) => {
    setCategory(newCategory);

    if (newCategory === 'Driver') {
      const defaultVehicle: DriverVehicleType =
        'Private Car Driver (Family, Outstation, Local Trips)';
      setVehicleType(defaultVehicle);
      setSelectedPricingTypes(['per_day', 'per_month', 'per_hour']);
      setRatesMap((prev) => ({
        ...prev,
        per_day: '850',
        per_month: '20000',
        per_hour: '150'
      }));
    } else if (newCategory === 'Emergency Highway Assistance') {
      setSelectedPricingTypes(['fixed_job', 'per_hour']);
      setRatesMap((prev) => ({
        ...prev,
        fixed_job: '500',
        per_hour: '500'
      }));
    } else {
      const { pricingType: defPricing, defaultRate } = getDefaultPricingForCategory(newCategory);
      const secondType: PricingType = defPricing === 'per_day' ? 'per_hour' : 'per_day';
      setSelectedPricingTypes([defPricing, secondType]);
      setRatesMap((prev) => ({
        ...prev,
        [defPricing]: defaultRate.toString(),
        [secondType]: getDefaultRateForType(secondType, newCategory)
      }));
    }
  };

  // Safety guard: ensure selectedPricingTypes align strictly with available options
  useEffect(() => {
    const valid = getAvailablePricingTypes(category, vehicleType);
    const filtered = selectedPricingTypes.filter((t) => valid.includes(t));
    if (filtered.length === 0) {
      setSelectedPricingTypes([valid[0]]);
    } else if (filtered.length !== selectedPricingTypes.length) {
      setSelectedPricingTypes(filtered);
    }
  }, [category, vehicleType]);

  // Handle Vehicle Type Change for Drivers
  const handleVehicleTypeChange = (newVehicle: DriverVehicleType) => {
    setVehicleType(newVehicle);
    const isHeavy = isHeavyMachineryDriver(newVehicle);

    if (isHeavy) {
      setSelectedPricingTypes(['day_shift', 'night_shift', 'per_hour']);
      const dayRate = newVehicle === 'JCB Machine Operator' ? '2500' : '3000';
      const nightRate = newVehicle === 'JCB Machine Operator' ? '3000' : '3500';
      const hrRate = newVehicle === 'JCB Machine Operator' ? '450' : '550';
      setRatesMap((prev) => ({
        ...prev,
        day_shift: dayRate,
        night_shift: nightRate,
        per_hour: hrRate
      }));
    } else {
      setSelectedPricingTypes(['per_day', 'per_month', 'per_hour']);
      const monthRate = newVehicle.includes('16-Wheeler')
        ? '38000'
        : newVehicle.includes('14-Wheeler')
        ? '35000'
        : newVehicle.includes('12-Wheeler')
        ? '32000'
        : newVehicle.includes('10-Wheeler')
        ? '28000'
        : newVehicle.includes('6-Wheeler')
        ? '25000'
        : newVehicle.includes('4-Wheeler')
        ? '22000'
        : '20000';
      const dayRate = newVehicle.includes('16-Wheeler') || newVehicle.includes('14-Wheeler')
        ? '1800'
        : newVehicle.includes('10-Wheeler') || newVehicle.includes('12-Wheeler')
        ? '1400'
        : newVehicle.includes('6-Wheeler') || newVehicle.includes('4-Wheeler')
        ? '1000'
        : '850';
      const hrRate = newVehicle.includes('Truck') || newVehicle.includes('Freight') || newVehicle.includes('Trailer')
        ? '250'
        : '150';
      setRatesMap((prev) => ({
        ...prev,
        per_day: dayRate,
        per_month: monthRate,
        per_hour: hrRate
      }));
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

  // Live preview base rate and unit calculation
  const numericBaseRate = parseFloat(rateAmount) || 0;
  const currentUnit =
    pricingType === 'day_shift'
      ? '/day'
      : pricingType === 'night_shift'
      ? '/night'
      : pricingType === 'per_month'
      ? '/month'
      : PRICING_TYPE_LABELS[pricingType]?.unit || '/hr';

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

    if (selectedPricingTypes.length === 0) {
      setError('Please select at least one pricing option.');
      return;
    }

    // Validate each selected pricing option
    for (const pt of selectedPricingTypes) {
      const valStr = ratesMap[pt] || '';
      const valNum = valStr.trim() ? parseInt(valStr, 10) : 0;
      if (pt === 'fixed_job') {
        if (isNaN(valNum) || valNum < 0) {
          setError('Please enter a valid visiting / inspection fee (₹0 or more).');
          return;
        }
      } else {
        const minRate = pt === 'per_month' ? 1000 : 50;
        if (isNaN(valNum) || valNum < minRate) {
          setError(
            pt === 'per_month'
              ? 'Please enter a valid monthly rate (minimum ₹1,000/month).'
              : `Please enter a realistic rate for ${
                  pt === 'per_day' && category === 'Driver'
                    ? 'Daily Allowance'
                    : PRICING_TYPE_LABELS[pt]?.shortLabel || pt
                } (minimum ₹50).`
          );
          return;
        }
      }
    }

    if (category === 'Driver' && !vehicleType) {
      setError('Please select your driver specialization / vehicle type.');
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = cleanPhone.startsWith('91')
        ? `+${cleanPhone}`
        : `+91 ${cleanPhone.slice(-10, -5)} ${cleanPhone.slice(-5)}`;

      const primaryType = selectedPricingTypes[0] || 'per_hour';
      const primaryRate = parseInt(ratesMap[primaryType] || '350', 10);

      const pricingRates: Partial<Record<PricingType, number>> = {};
      selectedPricingTypes.forEach((pt) => {
        const amt = parseInt(ratesMap[pt] || '0', 10);
        if (!isNaN(amt)) {
          pricingRates[pt] = amt;
        }
      });

      const rateOptions: WorkerRateOption[] = selectedPricingTypes.map((pt) => {
        const amount = parseInt(ratesMap[pt] || '0', 10);
        const info = PRICING_TYPE_LABELS[pt];
        let unit = info?.unit || '/hr';
        if (pt === 'day_shift') unit = '/day';
        if (pt === 'night_shift') unit = '/night';
        if (pt === 'per_month') unit = '/month';
        if (pt === 'per_day') unit = '/day';
        return {
          pricingType: pt,
          amount,
          unit,
          label: pt === 'per_day' && category === 'Driver' ? 'Daily Allowance' : (info?.shortLabel || pt)
        };
      });

      const payload = {
        name: name.trim(),
        category,
        experience: expNum,
        hourlyRate: pricingRates['per_hour'] || primaryRate, // backwards compatibility
        rate: primaryRate,
        pricingType: primaryType,
        rateUnit: currentUnit,
        pricingRates,
        rateOptions,
        vehicleType: category === 'Driver' ? vehicleType : undefined,
        lateNightAvailable: false,
        nightRates: undefined,
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

        {/* DRIVER SPECIALIZATION / VEHICLE TYPE SELECTION (MANDATORY WHEN CATEGORY IS 'Driver') */}
        {category === 'Driver' && (
          <div
            id="driver-specialization-section"
            className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-3.5 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-700" />
                Driver Specialization / Vehicle Type <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-bold text-emerald-900 bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-xs">
                Selected: {vehicleType.split('(')[0].trim()}
              </span>
            </div>

            {/* Categorized Driver Specializations */}
            <div className="space-y-3.5">
              {DRIVER_SPECIALIZATION_GROUPS.map((grp) => (
                <div key={grp.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs px-0.5">
                    <span className="font-bold text-gray-800 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-800 text-white text-[10px] font-extrabold flex items-center justify-center">
                        {grp.key}
                      </span>
                      <span>{grp.name}</span>
                    </span>
                    <span className="text-[10px] text-gray-500 hidden sm:inline">
                      {grp.options.length} {grp.options.length === 1 ? 'Option' : 'Options'}
                    </span>
                  </div>

                  <div
                    className={`grid gap-2 ${
                      grp.options.length === 1
                        ? 'grid-cols-1'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    }`}
                  >
                    {grp.options.map((opt) => {
                      const isSelected = vehicleType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          id={`driver-spec-btn-${opt.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                          type="button"
                          onClick={() => handleVehicleTypeChange(opt.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-emerald-700 bg-emerald-800 text-white shadow-sm ring-1 ring-emerald-700'
                              : 'border-emerald-200 bg-white hover:border-emerald-400 text-gray-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold leading-tight">{opt.title}</span>
                              {opt.iconType === 'car' ? (
                                <Car
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isSelected ? 'text-emerald-200' : 'text-emerald-700'
                                  }`}
                                />
                              ) : opt.iconType === 'truck' ? (
                                <Truck
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isSelected ? 'text-emerald-200' : 'text-emerald-700'
                                  }`}
                                />
                              ) : (
                                <HardHat
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isSelected ? 'text-emerald-200' : 'text-emerald-700'
                                  }`}
                                />
                              )}
                            </div>
                            <p
                              className={`text-[10px] mt-1 line-clamp-2 ${
                                isSelected ? 'text-emerald-100' : 'text-gray-500'
                              }`}
                            >
                              {opt.subtitle}
                            </p>
                          </div>

                          <div className="mt-2.5 pt-1.5 border-t border-white/20 flex items-center justify-between text-[10px] font-semibold">
                            <span className={isSelected ? 'text-emerald-200' : 'text-emerald-800'}>
                              {opt.categoryGroup === 'C'
                                ? 'Hourly / Day & Night Shift'
                                : 'Daily / Monthly / Hourly'}
                            </span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-emerald-950/85 bg-emerald-100/60 p-2.5 rounded-xl flex items-start gap-1.5 border border-emerald-200">
              <Info className="w-3.5 h-3.5 text-emerald-800 shrink-0 mt-0.5" />
              <span>
                {isHeavyMachineryDriver(vehicleType)
                  ? 'Heavy machinery operators (JCB, Bulldozer, Heavy Loader) bill based on Hourly operations, Day Shift (/day), or Night Shift (/night).'
                  : 'Personal car and commercial freight truck drivers can bill either Monthly (/month), Per Day (Daily Allowance), Per Hour, or Negotiable.'}
              </span>
            </p>
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

        {/* MULTI-SELECT PRICING SYSTEM */}
        <div className="p-3.5 sm:p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-emerald-700" />
              Pricing Structure &amp; Rate Options <span className="text-red-500">*</span>
            </span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
              Multi-Select Allowed (Choose 1 or more)
            </span>
          </div>

          <p className="text-[11px] text-gray-600">
            Select all the payment methods you accept. You can enter specific rates for each chosen option (e.g. daily allowance, monthly salary, and hourly charge).
          </p>

          {/* Pricing Type Selector Multi-Choice Tabs */}
          <div
            id="reg-pricing-type-selector"
            className={`grid gap-2 ${
              category === 'Driver'
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-4'
            }`}
          >
            {getAvailablePricingTypes(category, vehicleType).map((typeKey) => {
              const info = PRICING_TYPE_LABELS[typeKey];
              const isSelected = selectedPricingTypes.includes(typeKey);

              const labelName =
                typeKey === 'day_shift'
                  ? 'Day Shift'
                  : typeKey === 'night_shift'
                  ? 'Night Shift'
                  : typeKey === 'per_month'
                  ? 'Monthly'
                  : typeKey === 'per_day' && category === 'Driver'
                  ? 'Per Day (Allowance)'
                  : info?.shortLabel || typeKey;

              const unitDisplay =
                typeKey === 'day_shift'
                  ? '/day'
                  : typeKey === 'night_shift'
                  ? '/night'
                  : typeKey === 'per_month'
                  ? '/month'
                  : info?.unit || '/hr';

              return (
                <button
                  key={typeKey}
                  id={`reg-pricing-tab-${typeKey}`}
                  type="button"
                  onClick={() => togglePricingType(typeKey)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex flex-col justify-between text-left relative ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs ring-1 ring-emerald-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                      {unitDisplay}
                    </span>
                    {isSelected ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />
                    )}
                  </div>

                  <div>
                    <div className="font-bold text-[11px] leading-snug">
                      {labelName}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        isSelected ? 'text-emerald-200' : 'text-gray-500'
                      }`}
                    >
                      {typeKey === 'fixed_job' ? 'Inspection/Negotiable' : `₹${ratesMap[typeKey] || '—'}${unitDisplay}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* DYNAMICALLY RENDERED INPUT FIELDS FOR EACH SELECTED PRICING OPTION */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-800">
                Set Your Rates ({selectedPricingTypes.length} Active {selectedPricingTypes.length === 1 ? 'Option' : 'Options'}):
              </span>
              <span className="text-[10px] text-gray-500">
                Enter pricing for each selected option
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {selectedPricingTypes.map((typeKey, idx) => {
                const isPrimary = idx === 0;
                const isFixed = typeKey === 'fixed_job';
                const labelText =
                  typeKey === 'per_hour'
                    ? 'Hourly Rate'
                    : typeKey === 'per_day'
                    ? category === 'Driver'
                      ? 'Daily Allowance Rate'
                      : 'Per Day Rate'
                    : typeKey === 'per_month'
                    ? 'Monthly Salary / Remuneration'
                    : typeKey === 'day_shift'
                    ? 'Day Shift Rate'
                    : typeKey === 'night_shift'
                    ? 'Night Shift Rate'
                    : 'Visiting / Inspection Fee (Optional)';

                const unitText =
                  typeKey === 'day_shift'
                    ? '/day'
                    : typeKey === 'night_shift'
                    ? '/night'
                    : typeKey === 'per_month'
                    ? '/month'
                    : PRICING_TYPE_LABELS[typeKey]?.unit || '/hr';

                return (
                  <div
                    key={typeKey}
                    id={`reg-rate-input-card-${typeKey}`}
                    className="p-3 bg-white rounded-xl border border-emerald-200/90 shadow-2xs space-y-1.5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={`reg-input-rate-${typeKey}`}
                        className="text-xs font-bold text-emerald-950 flex items-center gap-1.5"
                      >
                        <span>{labelText}</span>
                        {!isFixed && <span className="text-red-500">*</span>}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          {isFixed ? 'Optional' : `₹${unitText}`}
                        </span>
                        {selectedPricingTypes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => togglePricingType(typeKey)}
                            className="text-[10px] text-red-500 hover:text-red-700 hover:underline cursor-pointer ml-1"
                            title="Remove rate option"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        id={isPrimary ? 'reg-input-rate-amount' : `reg-input-rate-${typeKey}`}
                        data-rate-type={typeKey}
                        type="number"
                        min={isFixed ? 0 : typeKey === 'per_month' ? 1000 : 50}
                        step={typeKey === 'per_month' ? 500 : 25}
                        required={!isFixed}
                        value={ratesMap[typeKey] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRatesMap((prev) => ({ ...prev, [typeKey]: val }));
                        }}
                        placeholder={
                          isFixed
                            ? '0 (or e.g. 150)'
                            : typeKey === 'per_month'
                            ? '22000'
                            : typeKey === 'day_shift'
                            ? '2500'
                            : typeKey === 'night_shift'
                            ? '3000'
                            : typeKey === 'per_day'
                            ? '850'
                            : '350'
                        }
                        className="w-full pl-8 pr-16 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-extrabold text-emerald-950 bg-white"
                      />
                      <IndianRupee className="w-4 h-4 text-gray-400 absolute left-2.5 top-3" />
                      <span className="text-xs font-bold text-gray-500 absolute right-3 top-3">
                        {isFixed ? '₹ visit' : `₹${unitText}`}
                      </span>
                    </div>

                    {isFixed ? (
                      <p className="text-[10px] text-gray-500">
                        Enter ₹0 if charges are determined after inspecting work.
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-400">
                        {typeKey === 'per_month'
                          ? 'Estimated monthly compensation for continuous booking.'
                          : typeKey === 'per_day'
                          ? 'Per day wage/allowance for full shift.'
                          : 'Per hour service rate.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* COMPREHENSIVE LIVE PREVIEW */}
          <div
            id="reg-customer-display-preview"
            className="text-xs bg-white p-3 rounded-xl border border-gray-200 space-y-2 shadow-2xs"
          >
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="font-semibold text-gray-600 text-[11px]">
                Customer Card Display Preview:
              </span>
              <span className="font-extrabold text-xs sm:text-sm text-emerald-900">
                Rates:{' '}
                {selectedPricingTypes
                  .map((pt) => {
                    const val = parseInt(ratesMap[pt] || '0', 10);
                    return formatSingleRate(pt, val, category).displayRate;
                  })
                  .join(' • ')}
              </span>
            </div>

            {selectedPricingTypes.length > 1 && (
              <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 flex-wrap">
                {selectedPricingTypes.map((pt) => {
                  const val = parseInt(ratesMap[pt] || '0', 10);
                  const item = formatSingleRate(pt, val, category);
                  return (
                    <span
                      key={pt}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-semibold"
                    >
                      <span className="text-gray-500 mr-1">{item.label}:</span>
                      <strong className="text-emerald-950">{item.displayRate}</strong>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

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
                : category === 'Welder'
                ? 'e.g., Gate welding, structural fabrication, repair work'
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
