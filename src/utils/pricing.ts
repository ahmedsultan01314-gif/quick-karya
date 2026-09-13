import { DriverVehicleType, NightRateConfig, PricingType, ServiceCategory, WorkerProfile } from '../types';

export const PRICING_TYPE_LABELS: Record<PricingType, { label: string; unit: string; shortLabel: string; placeholder: string }> = {
  per_hour: { label: 'Per Hour (₹/hr)', unit: '/hr', shortLabel: 'Per Hour', placeholder: '350' },
  per_day: { label: 'Per Day (₹/day)', unit: '/day', shortLabel: 'Per Day', placeholder: '750' },
  per_km: { label: 'Per Kilometer (₹/km)', unit: '/km', shortLabel: 'Per KM', placeholder: '12' },
  fixed_job: {
    label: 'On Inspection / Negotiable (काम देखकर तय होगा)',
    unit: ' visiting fee',
    shortLabel: 'On Inspection / Negotiable (काम देखकर तय होगा)',
    placeholder: '150'
  }
};

export const DRIVER_VEHICLE_OPTIONS: {
  id: DriverVehicleType;
  title: string;
  subtitle: string;
  allowedPricing: PricingType[];
  defaultPricing: PricingType;
  defaultRate: number;
}[] = [
  {
    id: '2-Wheeler (Bike / Rapido Style)',
    title: '2-Wheeler (Bike)',
    subtitle: 'Rapido-style bike taxi & courier delivery',
    allowedPricing: ['per_km'],
    defaultPricing: 'per_km',
    defaultRate: 10
  },
  {
    id: '3-Wheeler (Auto / E-Rickshaw)',
    title: '3-Wheeler (Auto / E-Rickshaw)',
    subtitle: 'Local passenger & parcel transit',
    allowedPricing: ['per_km'],
    defaultPricing: 'per_km',
    defaultRate: 15
  },
  {
    id: '4-Wheeler (Car / Commercial Vehicle)',
    title: '4-Wheeler (Car / Commercial)',
    subtitle: 'Sedan, SUV, Cab, or Commercial pickup',
    allowedPricing: ['per_km', 'per_day'],
    defaultPricing: 'per_km',
    defaultRate: 18
  }
];

// Returns default pricing type and recommended rate based on category
export function getDefaultPricingForCategory(
  category: ServiceCategory,
  vehicleType?: DriverVehicleType
): { pricingType: PricingType; defaultRate: number } {
  switch (category) {
    case 'Driver': {
      if (vehicleType === '2-Wheeler (Bike / Rapido Style)') {
        return { pricingType: 'per_km', defaultRate: 10 };
      }
      if (vehicleType === '3-Wheeler (Auto / E-Rickshaw)') {
        return { pricingType: 'per_km', defaultRate: 15 };
      }
      if (vehicleType === '4-Wheeler (Car / Commercial Vehicle)') {
        return { pricingType: 'per_km', defaultRate: 18 };
      }
      return { pricingType: 'per_km', defaultRate: 12 };
    }
    case 'Painter':
    case 'Rajmistri / Mason':
    case 'Labour / Helper':
      return { pricingType: 'per_day', defaultRate: 700 };
    case 'Emergency Highway Assistance':
      return { pricingType: 'fixed_job', defaultRate: 750 };
    case 'Carpenter':
    case 'Cook':
      return { pricingType: 'per_hour', defaultRate: 350 };
    case 'Plumber':
    case 'Electrician':
    default:
      return { pricingType: 'per_hour', defaultRate: 300 };
  }
}

// Calculate effective night rate
export function calculateNightRate(
  baseRate: number,
  type: 'percentage' | 'fixed',
  extraValue: number
): number {
  if (baseRate <= 0) return 0;
  if (type === 'percentage') {
    const extra = (baseRate * extraValue) / 100;
    return Math.round(baseRate + extra);
  } else {
    return Math.round(baseRate + extraValue);
  }
}

// Check if currently late night (8 PM to 6 AM)
export function isLateNightNow(): boolean {
  const hours = new Date().getHours();
  return hours >= 20 || hours < 6;
}

export interface FormattedPricing {
  baseAmount: number;
  unit: string;
  displayRate: string; // e.g., "₹350/hr"
  pricingType: PricingType;
  hasNightRate: boolean;
  nightRateAmount?: number;
  displayNightRate?: string; // e.g., "₹420/hr"
  nightRateSummary?: string; // e.g., "Day: ₹350/hr | Night: ₹420/hr"
  vehicleBadge?: string; // e.g., "2-Wheeler (Bike)"
}

export function formatWorkerPricing(worker: WorkerProfile): FormattedPricing {
  const baseAmount = worker.rate ?? worker.hourlyRate ?? 300;
  const pricingType: PricingType =
    worker.pricingType ||
    (worker.category === 'Emergency Highway Assistance'
      ? 'fixed_job'
      : worker.category === 'Driver' && worker.vehicleType
      ? 'per_km'
      : worker.category === 'Rajmistri / Mason' || worker.category === 'Painter'
      ? 'per_day'
      : 'per_hour');

  let unit = worker.rateUnit || PRICING_TYPE_LABELS[pricingType]?.unit || '/hr';
  let displayRate = `₹${baseAmount}${unit}`;

  if (pricingType === 'fixed_job') {
    if (worker.category === 'Emergency Highway Assistance') {
      displayRate = `₹${baseAmount} (Dispatch Fee)`;
      unit = ' /dispatch';
    } else if (baseAmount > 0) {
      displayRate = `Rates Negotiable (Visiting Charge: ₹${baseAmount})`;
      unit = ' visiting charge';
    } else {
      displayRate = 'Final Rate After Work Inspection';
      unit = ' inspection';
    }
  }

  const hasNightRate = Boolean(
    worker.lateNightAvailable &&
      worker.nightRates?.enabled &&
      (worker.nightRates.effectiveNightRate || worker.nightRates.extraValue > 0)
  );

  let nightRateAmount: number | undefined;
  let displayNightRate: string | undefined;
  let nightRateSummary: string | undefined;

  if (hasNightRate && worker.nightRates) {
    nightRateAmount =
      worker.nightRates.effectiveNightRate ??
      calculateNightRate(
        baseAmount,
        worker.nightRates.type,
        worker.nightRates.extraValue
      );
    displayNightRate = `₹${nightRateAmount}${unit}`;
    const extraText =
      worker.nightRates.type === 'percentage'
        ? `+${worker.nightRates.extraValue}%`
        : `+₹${worker.nightRates.extraValue}`;
    nightRateSummary = `Day: ₹${baseAmount}${unit} | Night: ₹${nightRateAmount}${unit} (${extraText})`;
  }

  let vehicleBadge: string | undefined;
  if (worker.category === 'Driver' && worker.vehicleType) {
    if (worker.vehicleType.includes('2-Wheeler')) vehicleBadge = '2-Wheeler (Bike)';
    else if (worker.vehicleType.includes('3-Wheeler')) vehicleBadge = '3-Wheeler (Auto)';
    else if (worker.vehicleType.includes('4-Wheeler')) vehicleBadge = '4-Wheeler (Cab/Car)';
    else vehicleBadge = worker.vehicleType;
  }

  return {
    baseAmount,
    unit,
    displayRate,
    pricingType,
    hasNightRate,
    nightRateAmount,
    displayNightRate,
    nightRateSummary,
    vehicleBadge
  };
}
