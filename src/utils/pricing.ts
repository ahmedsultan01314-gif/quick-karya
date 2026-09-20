import { DriverVehicleType, NightRateConfig, PricingType, ServiceCategory, WorkerProfile } from '../types';

export const PRICING_TYPE_LABELS: Record<PricingType, { label: string; unit: string; shortLabel: string; placeholder: string }> = {
  per_hour: { label: 'Per Hour (₹/hr)', unit: '/hr', shortLabel: 'Per Hour', placeholder: '350' },
  per_day: { label: 'Per Day (₹/day)', unit: '/day', shortLabel: 'Per Day (Allowance)', placeholder: '850' },
  day_shift: { label: 'Day Shift (₹/day)', unit: '/day', shortLabel: 'Day Shift', placeholder: '2500' },
  night_shift: { label: 'Night Shift (₹/night)', unit: '/night', shortLabel: 'Night Shift', placeholder: '3000' },
  per_month: { label: 'Monthly (₹/month)', unit: '/month', shortLabel: 'Monthly', placeholder: '22000' },
  per_km: { label: 'Per Kilometer (₹/km)', unit: '/km', shortLabel: 'Per KM', placeholder: '15' },
  fixed_job: {
    label: 'On Inspection / Negotiable (काम देखकर तय होगा)',
    unit: ' visiting fee',
    shortLabel: 'On Inspection / Negotiable',
    placeholder: '150'
  }
};

export interface DriverSpecializationItem {
  id: DriverVehicleType;
  title: string;
  subtitle: string;
  categoryGroup: 'A' | 'B' | 'C';
  groupName: string;
  iconType: 'car' | 'truck' | 'heavy';
  allowedPricing: PricingType[];
  defaultPricing: PricingType;
  defaultRate: number;
}

export const DRIVER_SPECIALIZATION_GROUPS: {
  key: 'A' | 'B' | 'C';
  name: string;
  badge: string;
  description: string;
  options: DriverSpecializationItem[];
}[] = [
  {
    key: 'A',
    name: 'Category A: Personal & Family',
    badge: 'Personal & Family',
    description: 'Private vehicles, family chauffeurs, local & outstation personal car trips',
    options: [
      {
        id: 'Private Car Driver (Family, Outstation, Local Trips)',
        title: 'Private Car Driver',
        subtitle: 'Family, Outstation, Local Trips (Sedan, Hatchback, SUV)',
        categoryGroup: 'A',
        groupName: 'Personal & Family',
        iconType: 'car',
        allowedPricing: ['per_day', 'per_month', 'per_hour', 'fixed_job'],
        defaultPricing: 'per_day',
        defaultRate: 850
      }
    ]
  },
  {
    key: 'B',
    name: 'Category B: Commercial Freight & Trucks',
    badge: 'Commercial Freight & Trucks',
    description: 'Goods transport, logistics, distribution & heavy multi-axle freight carriers',
    options: [
      {
        id: '4-Wheeler Pickup / Mini Commercial',
        title: '4-Wheeler Pickup / Mini Commercial',
        subtitle: 'Tata Ace, Bolero Maxi Truck, intra-city courier & goods',
        categoryGroup: 'B',
        groupName: 'Commercial Freight & Trucks',
        iconType: 'truck',
        allowedPricing: ['per_day', 'per_month', 'per_hour', 'fixed_job'],
        defaultPricing: 'per_day',
        defaultRate: 950
      },
      {
        id: '6-Wheeler Medium Commercial Truck',
        title: '6-Wheeler Medium Commercial Truck',
        subtitle: 'Eicher / Tata 407, regional distribution & bulk loads',
        categoryGroup: 'B',
        groupName: 'Commercial Freight & Trucks',
        iconType: 'truck',
        allowedPricing: ['per_day', 'per_month', 'per_hour', 'fixed_job'],
        defaultPricing: 'per_day',
        defaultRate: 1100
      },
      {
        id: '10-Wheeler Heavy Goods Truck',
        title: '10-Wheeler Heavy Goods Truck',
        subtitle: 'Heavy cargo, state-to-state freight transit',
        categoryGroup: 'B',
        groupName: 'Commercial Freight & Trucks',
        iconType: 'truck',
        allowedPricing: ['per_day', 'per_month', 'per_hour', 'fixed_job'],
        defaultPricing: 'per_day',
        defaultRate: 1400
      },
      {
        id: '12-Wheeler Multi-Axle Freight',
        title: '12-Wheeler Multi-Axle Freight',
        subtitle: 'High-tonnage industrial goods, national highways',
        categoryGroup: 'B',
        groupName: 'Commercial Freight & Trucks',
        iconType: 'truck',
        allowedPricing: ['per_day', 'per_month', 'per_hour', 'fixed_job'],
        defaultPricing: 'per_day',
        defaultRate: 1600
      },
      {
        id: '14-Wheeler Heavy Commercial Truck',
        title: '14-Wheeler Heavy Commercial Truck',
        subtitle: 'Heavy container carriers, cement & bulk material',
        categoryGroup: 'B',
        groupName: 'Commercial Freight & Trucks',
        iconType: 'truck',
        allowedPricing: ['per_day', 'per_month', 'per_hour', 'fixed_job'],
        defaultPricing: 'per_day',
        defaultRate: 1800
      },
      {
        id: '16-Wheeler Long Haul Trailer',
        title: '16-Wheeler Long Haul Trailer',
        subtitle: 'Heavy machinery transport, multi-axle oversized cargo',
        categoryGroup: 'B',
        groupName: 'Commercial Freight & Trucks',
        iconType: 'truck',
        allowedPricing: ['per_day', 'per_month', 'per_hour', 'fixed_job'],
        defaultPricing: 'per_day',
        defaultRate: 2200
      }
    ]
  },
  {
    key: 'C',
    name: 'Category C: Heavy Machinery & Earthmovers',
    badge: 'Heavy Machinery & Earthmovers',
    description: 'Construction sites, trenching, civil engineering & earthmoving operations',
    options: [
      {
        id: 'JCB Machine Operator',
        title: 'JCB Machine Operator',
        subtitle: 'Backhoe loader, trenching, foundation digging & construction site work',
        categoryGroup: 'C',
        groupName: 'Heavy Machinery & Earthmovers',
        iconType: 'heavy',
        allowedPricing: ['per_hour', 'day_shift', 'night_shift', 'fixed_job'],
        defaultPricing: 'day_shift',
        defaultRate: 2500
      },
      {
        id: 'Bulldozer / Heavy Loader Operator',
        title: 'Bulldozer / Heavy Loader Operator',
        subtitle: 'Earth leveling, road paving, heavy mining & land clearance',
        categoryGroup: 'C',
        groupName: 'Heavy Machinery & Earthmovers',
        iconType: 'heavy',
        allowedPricing: ['per_hour', 'day_shift', 'night_shift', 'fixed_job'],
        defaultPricing: 'day_shift',
        defaultRate: 3000
      }
    ]
  }
];

export const DRIVER_VEHICLE_OPTIONS: DriverSpecializationItem[] =
  DRIVER_SPECIALIZATION_GROUPS.flatMap((group) => group.options);

export function isHeavyMachineryDriver(vehicleType?: DriverVehicleType): boolean {
  return (
    vehicleType === 'JCB Machine Operator' ||
    vehicleType === 'Bulldozer / Heavy Loader Operator'
  );
}

export function getDriverSubCategory(
  vehicleType?: DriverVehicleType
): 'personal' | 'commercial' | 'heavy' {
  if (!vehicleType) return 'personal';
  if (
    vehicleType === 'JCB Machine Operator' ||
    vehicleType === 'Bulldozer / Heavy Loader Operator'
  ) {
    return 'heavy';
  }
  if (
    vehicleType.includes('Truck') ||
    vehicleType.includes('Commercial') ||
    vehicleType.includes('Freight') ||
    vehicleType.includes('Trailer')
  ) {
    return 'commercial';
  }
  return 'personal';
}

// Returns default pricing type and recommended rate based on category
export function getDefaultPricingForCategory(
  category: ServiceCategory,
  vehicleType?: DriverVehicleType
): { pricingType: PricingType; defaultRate: number } {
  switch (category) {
    case 'Driver': {
      if (vehicleType === 'JCB Machine Operator') {
        return { pricingType: 'day_shift', defaultRate: 2500 };
      }
      if (vehicleType === 'Bulldozer / Heavy Loader Operator') {
        return { pricingType: 'day_shift', defaultRate: 3000 };
      }
      if (
        vehicleType === '16-Wheeler Long Haul Trailer' ||
        vehicleType === '14-Wheeler Heavy Commercial Truck'
      ) {
        return { pricingType: 'per_day', defaultRate: 1800 };
      }
      if (
        vehicleType === '12-Wheeler Multi-Axle Freight' ||
        vehicleType === '10-Wheeler Heavy Goods Truck'
      ) {
        return { pricingType: 'per_day', defaultRate: 1400 };
      }
      if (
        vehicleType === '6-Wheeler Medium Commercial Truck' ||
        vehicleType === '4-Wheeler Pickup / Mini Commercial'
      ) {
        return { pricingType: 'per_day', defaultRate: 950 };
      }
      // Default for Private Car Driver
      return { pricingType: 'per_day', defaultRate: 850 };
    }
    case 'Painter':
    case 'Rajmistri / Mason':
    case 'Labour / Helper':
      return { pricingType: 'per_day', defaultRate: 700 };
    case 'Emergency Highway Assistance':
      return { pricingType: 'fixed_job', defaultRate: 750 };
    case 'Welder':
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

export interface FormattedRateItem {
  pricingType: PricingType;
  amount: number;
  unit: string;
  displayRate: string;
  label: string;
}

export function formatSingleRate(
  type: PricingType,
  amount: number,
  category: ServiceCategory,
  customUnit?: string
): FormattedRateItem {
  let unit = customUnit || PRICING_TYPE_LABELS[type]?.unit || '/hr';
  let label = PRICING_TYPE_LABELS[type]?.shortLabel || type;
  let displayRate = `₹${amount.toLocaleString('en-IN')}${unit}`;

  if (type === 'day_shift') {
    unit = '/day';
    label = 'Day Shift';
    displayRate = `₹${amount.toLocaleString('en-IN')}/day`;
  } else if (type === 'night_shift') {
    unit = '/night';
    label = 'Night Shift';
    displayRate = `₹${amount.toLocaleString('en-IN')}/night`;
  } else if (type === 'per_month') {
    unit = '/month';
    label = 'Monthly';
    displayRate = `₹${amount.toLocaleString('en-IN')}/month`;
  } else if (type === 'per_day') {
    unit = '/day';
    label = category === 'Driver' ? 'Daily Allowance' : 'Per Day';
    displayRate = `₹${amount.toLocaleString('en-IN')}/day`;
  } else if (type === 'per_hour') {
    unit = '/hr';
    label = 'Hourly';
    displayRate = `₹${amount.toLocaleString('en-IN')}/hr`;
  } else if (type === 'per_km') {
    unit = '/km';
    label = 'Per KM';
    displayRate = `₹${amount.toLocaleString('en-IN')}/km`;
  } else if (type === 'fixed_job') {
    label = 'Inspection / Negotiable';
    if (category === 'Emergency Highway Assistance') {
      unit = ' dispatch';
      displayRate = `₹${amount.toLocaleString('en-IN')} (Dispatch Fee)`;
    } else if (amount > 0) {
      unit = ' visit';
      displayRate = `₹${amount.toLocaleString('en-IN')} (Visiting Fee)`;
    } else {
      unit = ' inspection';
      displayRate = 'On Inspection';
    }
  }

  return {
    pricingType: type,
    amount,
    unit,
    displayRate,
    label
  };
}

export interface FormattedPricing {
  baseAmount: number;
  unit: string;
  displayRate: string; // e.g., "₹350/hr"
  pricingType: PricingType;
  allRates: FormattedRateItem[];
  allRatesFormatted: string; // e.g., "₹500/hr • ₹1,100/day • ₹25,000/month"
  hasMultipleRates: boolean;
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
      : worker.category === 'Driver'
      ? (isHeavyMachineryDriver(worker.vehicleType) ? 'day_shift' : 'per_day')
      : worker.category === 'Rajmistri / Mason' || worker.category === 'Painter'
      ? 'per_day'
      : 'per_hour');

  let unit = worker.rateUnit || PRICING_TYPE_LABELS[pricingType]?.unit || '/hr';
  let displayRate = `₹${baseAmount.toLocaleString('en-IN')}${unit}`;

  if (pricingType === 'day_shift') {
    unit = '/day';
    displayRate = `₹${baseAmount.toLocaleString('en-IN')}/day (Day Shift)`;
  } else if (pricingType === 'night_shift') {
    unit = '/night';
    displayRate = `₹${baseAmount.toLocaleString('en-IN')}/night (Night Shift)`;
  } else if (pricingType === 'per_month') {
    unit = '/month';
    displayRate = `₹${baseAmount.toLocaleString('en-IN')}/month`;
  } else if (pricingType === 'per_day' && worker.category === 'Driver') {
    unit = '/day';
    displayRate = `₹${baseAmount.toLocaleString('en-IN')}/day (Allowance)`;
  }

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

  // Parse multi-select pricing rates
  const allRates: FormattedRateItem[] = [];
  const rateOrder: PricingType[] = [
    'per_hour',
    'per_day',
    'day_shift',
    'night_shift',
    'per_month',
    'per_km',
    'fixed_job'
  ];

  if (worker.pricingRates && Object.keys(worker.pricingRates).length > 0) {
    rateOrder.forEach((t) => {
      const amt = worker.pricingRates?.[t];
      if (typeof amt === 'number') {
        allRates.push(formatSingleRate(t, amt, worker.category));
      }
    });
  } else if (worker.rateOptions && worker.rateOptions.length > 0) {
    worker.rateOptions.forEach((ro) => {
      allRates.push(formatSingleRate(ro.pricingType, ro.amount, worker.category, ro.unit));
    });
  }

  // Fallback to primary rate if no multi-rates list is populated
  if (allRates.length === 0) {
    allRates.push(formatSingleRate(pricingType, baseAmount, worker.category, unit));
  }

  const allRatesFormatted = allRates.map((r) => r.displayRate).join(' • ');
  const hasMultipleRates = allRates.length > 1;

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
    if (worker.vehicleType === 'Private Car Driver (Family, Outstation, Local Trips)') {
      vehicleBadge = 'Private Car Driver';
    } else if (worker.vehicleType === '4-Wheeler Pickup / Mini Commercial') {
      vehicleBadge = 'Pickup / Mini Truck';
    } else if (worker.vehicleType === '6-Wheeler Medium Commercial Truck') {
      vehicleBadge = '6-Wheeler Truck';
    } else if (worker.vehicleType === '10-Wheeler Heavy Goods Truck') {
      vehicleBadge = '10-Wheeler Truck';
    } else if (worker.vehicleType === '12-Wheeler Multi-Axle Freight') {
      vehicleBadge = '12-Wheeler Freight';
    } else if (worker.vehicleType === '14-Wheeler Heavy Commercial Truck') {
      vehicleBadge = '14-Wheeler Heavy Truck';
    } else if (worker.vehicleType === '16-Wheeler Long Haul Trailer') {
      vehicleBadge = '16-Wheeler Trailer';
    } else if (worker.vehicleType === 'JCB Machine Operator') {
      vehicleBadge = 'JCB Operator';
    } else if (worker.vehicleType === 'Bulldozer / Heavy Loader Operator') {
      vehicleBadge = 'Bulldozer Operator';
    } else if (worker.vehicleType.includes('2-Wheeler')) {
      vehicleBadge = '2-Wheeler (Bike)';
    } else if (worker.vehicleType.includes('3-Wheeler')) {
      vehicleBadge = '3-Wheeler (Auto)';
    } else if (worker.vehicleType.includes('4-Wheeler')) {
      vehicleBadge = '4-Wheeler (Car)';
    } else {
      vehicleBadge = worker.vehicleType;
    }
  }

  return {
    baseAmount,
    unit,
    displayRate,
    pricingType,
    allRates,
    allRatesFormatted,
    hasMultipleRates,
    hasNightRate,
    nightRateAmount,
    displayNightRate,
    nightRateSummary,
    vehicleBadge
  };
}
