export type ServiceCategory =
  | 'Plumber'
  | 'Electrician'
  | 'Carpenter'
  | 'Cook'
  | 'Painter'
  | 'Driver'
  | 'Rajmistri / Mason'
  | 'Labour / Helper'
  | 'Welder'
  | 'Pest Control'
  | 'Laundry / Clothes Wash'
  | 'Hotel Staff'
  | 'Restaurant Staff'
  | 'Emergency Highway Assistance';

export type PricingType =
  | 'per_hour'
  | 'per_day'
  | 'day_shift'
  | 'night_shift'
  | 'per_month'
  | 'per_km'
  | 'fixed_job';

export type DriverVehicleType =
  // Category A: Personal & Family
  | 'Private Car Driver (Family, Outstation, Local Trips)'
  // Category B: Commercial Freight & Trucks
  | '4-Wheeler Pickup / Mini Commercial'
  | '6-Wheeler Medium Commercial Truck'
  | '10-Wheeler Heavy Goods Truck'
  | '12-Wheeler Multi-Axle Freight'
  | '14-Wheeler Heavy Commercial Truck'
  | '16-Wheeler Long Haul Trailer'
  // Category C: Heavy Machinery & Earthmovers
  | 'JCB Machine Operator'
  | 'Bulldozer / Heavy Loader Operator'
  // Backward compatibility
  | '2-Wheeler (Bike / Rapido Style)'
  | '3-Wheeler (Auto / E-Rickshaw)'
  | '4-Wheeler (Car / Commercial Vehicle)';

export type DriverSubCategory = 'all' | 'personal' | 'commercial' | 'heavy';

export interface NightRateConfig {
  enabled: boolean;
  type: 'percentage' | 'fixed'; // '+20%' or '+₹100'
  extraValue: number; // e.g. 20 (for 20%) or 100 (for ₹100)
  effectiveNightRate?: number; // Precalculated night rate amount
}

export interface WorkerRateOption {
  pricingType: PricingType;
  amount: number;
  unit: string;
  label?: string;
}

export interface WorkerProfile {
  id: string;
  workerId?: string; // Permanent Unique Quick Karya Worker ID, e.g. QK-10492
  name: string;
  category: ServiceCategory;
  experience: number; // in years
  rating: number; // out of 5
  reviewCount: number;
  hourlyRate: number; // kept for legacy compatibility
  rate?: number; // active base rate amount
  pricingType?: PricingType;
  rateUnit?: string; // '/hr' | '/day' | '/km' | '/job' | '/month' | '/night'
  pricingRates?: Partial<Record<PricingType, number>>; // Multi-select rates, e.g. { per_hour: 500, per_day: 1100, per_month: 25000 }
  rateOptions?: WorkerRateOption[];
  vehicleType?: DriverVehicleType; // mandatory when category is 'Driver'
  subRole?: string; // sub-role e.g. 'Laundry Person', 'Ironing', 'Waiter', 'Housekeeping', 'Chef/Cook', 'Receptionist', 'Helper'
  lateNightAvailable?: boolean;
  nightRates?: NightRateConfig;
  phone: string;
  city: string;
  state?: string;
  pincode: string;
  latitude: number;
  longitude: number;
  verified: boolean;
  isVerified?: boolean;
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

export type UserRole = 'customer' | 'worker';

export interface AppUser {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  workerId?: string; // Permanent Quick Karya Worker ID, e.g. QK-78901
  profilePhoto?: string;
  verified: boolean;
  createdAt: string;
}

export interface WorkerReview {
  id: string;
  workerId: string;
  customerId: string;
  customerName: string;
  rating: number; // 1-5
  comment?: string;
  serviceRequestId: string;
  createdAt: string;
  reported?: boolean;
}

export interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  workerId: string;
  workerName: string;
  workerCategory: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  customerLat?: number;
  customerLng?: number;
  serviceAddress?: string;
  hasLocationPermission: boolean;
  reviewed?: boolean;
  reviewId?: string;
  createdAt: string;
  completedAt?: string;
}

export type ActiveTab = 'workers' | 'register' | 'categories' | 'profile';

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

