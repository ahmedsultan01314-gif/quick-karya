export type ServiceCategory =
  | 'Plumber'
  | 'Electrician'
  | 'Carpenter'
  | 'Cook'
  | 'Painter'
  | 'Driver'
  | 'Rajmistri / Mason'
  | 'Labour / Helper'
  | 'Emergency Highway Assistance';

export type PricingType = 'per_hour' | 'per_day' | 'per_km' | 'fixed_job';

export type DriverVehicleType =
  | '2-Wheeler (Bike / Rapido Style)'
  | '3-Wheeler (Auto / E-Rickshaw)'
  | '4-Wheeler (Car / Commercial Vehicle)';

export interface NightRateConfig {
  enabled: boolean;
  type: 'percentage' | 'fixed'; // '+20%' or '+₹100'
  extraValue: number; // e.g. 20 (for 20%) or 100 (for ₹100)
  effectiveNightRate?: number; // Precalculated night rate amount
}

export interface WorkerProfile {
  id: string;
  name: string;
  category: ServiceCategory;
  experience: number; // in years
  rating: number; // out of 5
  reviewCount: number;
  hourlyRate: number; // kept for legacy compatibility
  rate?: number; // active base rate amount
  pricingType?: PricingType;
  rateUnit?: string; // '/hr' | '/day' | '/km' | '/job'
  vehicleType?: DriverVehicleType; // mandatory when category is 'Driver'
  lateNightAvailable?: boolean;
  nightRates?: NightRateConfig;
  phone: string;
  city: string;
  state?: string;
  pincode: string;
  latitude: number;
  longitude: number;
  verified: boolean;
  available: boolean;
  distanceKm?: number; // dynamically computed based on user GPS
  completedJobs: number;
  languages: string[];
  skills: string[];
  emergencyAvailable?: boolean;
  photo?: string;
}

export interface UserLocation {
  latitude: number | null;
  longitude: number | null;
  city: string;
  pincode: string;
  state?: string;
  accuracyMeters?: number;
  isLiveGps: boolean;
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'fallback';
  error?: string;
}

export type ActiveTab = 'workers' | 'register' | 'categories';

export interface OnboardingForm {
  name: string;
  category: ServiceCategory;
  experience: string;
  hourlyRate: string;
  pricingType: PricingType;
  vehicleType?: DriverVehicleType;
  lateNightAvailable: boolean;
  nightChargeType: 'percentage' | 'fixed';
  nightExtraCharge: string;
  phone: string;
  city: string;
  state: string;
  pincode: string;
  skills: string;
  languages: string;
  photo?: string;
}

