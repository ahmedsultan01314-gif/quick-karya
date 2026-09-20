import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { INITIAL_WORKERS } from './src/data/initialWorkers';
import { CATEGORIES } from './src/data/categories';
import { WorkerProfile, ServiceCategory } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory persistent worker storage initialized with seed data
let workers: WorkerProfile[] = [...INITIAL_WORKERS];

// Helper: Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Fallback Indian city coordinate dictionary
const CITY_COORDINATES: Record<string, { lat: number; lng: number; state: string; pincode: string }> = {
  agartala: { lat: 23.8315, lng: 91.2868, state: 'Tripura', pincode: '799001' },
  tripura: { lat: 23.8315, lng: 91.2868, state: 'Tripura', pincode: '799001' },
  bengaluru: { lat: 12.9716, lng: 77.5946, state: 'Karnataka', pincode: '560001' },
  bangalore: { lat: 12.9716, lng: 77.5946, state: 'Karnataka', pincode: '560001' },
  delhi: { lat: 28.6139, lng: 77.209, state: 'Delhi', pincode: '110001' },
  mumbai: { lat: 19.076, lng: 72.8777, state: 'Maharashtra', pincode: '400001' },
  kolkata: { lat: 22.5726, lng: 88.3639, state: 'West Bengal', pincode: '700001' },
  hyderabad: { lat: 17.385, lng: 78.4867, state: 'Telangana', pincode: '500001' },
  chennai: { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu', pincode: '600001' },
  pune: { lat: 18.5204, lng: 73.8567, state: 'Maharashtra', pincode: '411001' },
  jaipur: { lat: 26.9124, lng: 75.7873, state: 'Rajasthan', pincode: '302001' },
  guwahati: { lat: 26.1445, lng: 91.7362, state: 'Assam', pincode: '781001' }
};

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Quick Karya', workersCount: workers.length });
});

// API: Categories list
app.get('/api/categories', (req, res) => {
  res.json(CATEGORIES);
});

// API: Reverse geocode endpoint
app.get('/api/reverse-geocode', async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng required' });
  }

  try {
    // Try OpenStreetMap Nominatim with strict timeout & header
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const response = await fetch(geoUrl, {
      headers: {
        'User-Agent': 'QuickKaryaLocalServicesApp/1.0',
        'Accept-Language': 'en'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = (await response.json()) as any;
      const addr = data.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.suburb ||
        addr.county ||
        addr.state_district ||
        'Local Area';
      const state = addr.state || '';
      const pincode = addr.postcode || '';
      const country = addr.country || '';

      return res.json({
        city,
        state,
        pincode,
        country,
        displayName: data.display_name || `${city}, ${state}`
      });
    }
  } catch (err) {
    // Fall through to closest known city calculation
  }

  // Fallback: Find closest known reference city in dictionary
  let closestCity = 'Bengaluru';
  let closestState = 'Karnataka';
  let closestPin = '560001';
  let minDistance = Infinity;

  for (const [key, val] of Object.entries(CITY_COORDINATES)) {
    const dist = haversineKm(lat, lng, val.lat, val.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestCity = key.charAt(0).toUpperCase() + key.slice(1);
      closestState = val.state;
      closestPin = val.pincode;
    }
  }

  return res.json({
    city: closestCity,
    state: closestState,
    pincode: closestPin,
    displayName: `${closestCity}, ${closestState}`
  });
});

// API: Get workers with live proximity filtering & sorting
app.get('/api/workers', (req, res) => {
  const { category, search, city, pincode } = req.query;
  const userLat = req.query.lat ? parseFloat(req.query.lat as string) : null;
  const userLng = req.query.lng ? parseFloat(req.query.lng as string) : null;

  let results = [...workers];

  // Filter by category
  if (category && category !== 'All') {
    results = results.filter((w) => w.category === category);
  }

  // Filter by manual search keyword (name, skill, city, category)
  if (search && typeof search === 'string' && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    results = results.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.city.toLowerCase().includes(q) ||
        w.pincode.includes(q) ||
        (w.vehicleType && w.vehicleType.toLowerCase().includes(q)) ||
        (w.skills && w.skills.some((s) => s.toLowerCase().includes(q))) ||
        (w.languages && w.languages.some((l) => l.toLowerCase().includes(q)))
    );
  }

  // Filter by city / pincode if provided
  if (city && typeof city === 'string' && city.trim() !== '') {
    const c = city.trim().toLowerCase();
    results = results.filter(
      (w) =>
        w.city.toLowerCase().includes(c) ||
        (w.state && w.state.toLowerCase().includes(c))
    );
  }

  if (pincode && typeof pincode === 'string' && pincode.trim() !== '') {
    const p = pincode.trim();
    results = results.filter((w) => w.pincode.startsWith(p.slice(0, 3)));
  }

  // Calculate live proximity distance if coordinates are present
  if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
    results = results.map((w) => {
      const distanceKm = haversineKm(userLat, userLng, w.latitude, w.longitude);
      return {
        ...w,
        distanceKm
      };
    });

    // Sort by proximity: nearest available first!
    results.sort((a, b) => {
      // Emergency requests get priority if Highway Assistance is selected
      if (category === 'Emergency Highway Assistance') {
        if (a.emergencyAvailable && !b.emergencyAvailable) return -1;
        if (!a.emergencyAvailable && b.emergencyAvailable) return 1;
      }
      return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
    });
  } else {
    // Default sorting by rating and review count
    results.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  }

  res.json(results);
});

// API: Register worker
app.post('/api/workers', (req, res) => {
  const {
    name,
    category,
    experience,
    hourlyRate,
    rate,
    pricingType,
    rateUnit,
    pricingRates,
    rateOptions,
    vehicleType,
    lateNightAvailable,
    nightRates,
    phone,
    city,
    state,
    pincode,
    skills,
    languages,
    latitude,
    longitude,
    photo,
    photoUrl
  } = req.body;

  const numericRate = parseInt(rate ?? hourlyRate, 10);
  if (!name || !category || !experience || isNaN(numericRate) || !phone || !city) {
    return res.status(400).json({ error: 'Missing required worker onboarding fields' });
  }

  // Coordinate determination
  let workerLat = typeof latitude === 'number' ? latitude : null;
  let workerLng = typeof longitude === 'number' ? longitude : null;

  const lowerCity = city.trim().toLowerCase();
  const matched = CITY_COORDINATES[lowerCity];

  if (workerLat === null || workerLng === null) {
    if (matched) {
      // Add slight random jitter (0.005 deg ~ 500m) for realistic local dispersion
      workerLat = matched.lat + (Math.random() - 0.5) * 0.01;
      workerLng = matched.lng + (Math.random() - 0.5) * 0.01;
    } else {
      // Default to central India or city approximate
      workerLat = 23.8315;
      workerLng = 91.2868;
    }
  }

  const determinedState = state?.trim() || (matched?.state || 'Tripura');
  const profilePhoto = photo || photoUrl || undefined;

  const unit = rateUnit || (pricingType === 'per_km' ? '/km' : pricingType === 'per_day' ? '/day' : pricingType === 'fixed_job' ? '/job' : '/hr');

  const newWorker: WorkerProfile = {
    id: `w-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: name.trim(),
    category: category as ServiceCategory,
    experience: parseInt(experience, 10) || 1,
    rating: 5.0,
    reviewCount: 1,
    hourlyRate: numericRate,
    rate: numericRate,
    pricingType: pricingType || (category === 'Driver' && vehicleType ? 'per_km' : category === 'Emergency Highway Assistance' ? 'fixed_job' : 'per_hour'),
    rateUnit: unit,
    pricingRates: pricingRates && typeof pricingRates === 'object' ? pricingRates : undefined,
    rateOptions: Array.isArray(rateOptions) ? rateOptions : undefined,
    vehicleType: category === 'Driver' ? vehicleType : undefined,
    lateNightAvailable: Boolean(lateNightAvailable),
    nightRates: nightRates?.enabled ? nightRates : undefined,
    phone: phone.trim(),
    city: city.trim(),
    state: determinedState,
    pincode: pincode ? pincode.trim() : (matched?.pincode || '799001'),
    latitude: workerLat,
    longitude: workerLng,
    verified: true, // Auto-verified through Quick Karya onboarding
    available: true,
    completedJobs: 1,
    photo: profilePhoto,
    languages: languages
      ? (Array.isArray(languages) ? languages : languages.split(',')).map((l: string) => l.trim()).filter(Boolean)
      : ['Hindi', 'Local'],
    skills: skills
      ? (Array.isArray(skills) ? skills : skills.split(',')).map((s: string) => s.trim()).filter(Boolean)
      : [`Verified ${category}`],
    emergencyAvailable: category === 'Emergency Highway Assistance'
  };

  // Prepend so newly registered worker appears immediately
  workers.unshift(newWorker);

  res.status(201).json({
    success: true,
    message: 'Worker registered successfully with Quick Karya',
    worker: newWorker
  });
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quick Karya server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
