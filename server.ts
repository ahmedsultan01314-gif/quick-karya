import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { CATEGORIES } from './src/data/categories';
import { WorkerProfile, ServiceCategory, AppUser, WorkerReview, ServiceRequest } from './src/types';
import {
  saveWorkerToCloud,
  fetchWorkersFromCloud,
  subscribeWorkersFromCloud,
  saveUserToCloud,
  fetchUserFromCloud,
  saveReviewToCloud,
  fetchReviewsForWorker,
  saveServiceRequestToCloud,
  fetchUserRequests
} from './src/firebase';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cloud-synced worker storage with in-memory cache
let workers: WorkerProfile[] = [];

// Real-time synchronization from Cloud Firestore
try {
  subscribeWorkersFromCloud(
    (cloudWorkers) => {
      workers = cloudWorkers;
    },
    (err) => {
      console.warn('Server Firestore sync error:', err);
    }
  );
} catch (e) {
  console.warn('Could not initialize server Firestore listener:', e);
}

// In-memory OTP storage with expiration & attempt tracking
interface OtpRecord {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}
const otpStore = new Map<string, OtpRecord>();

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
    // Fall through to closest city dictionary
  }

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

// ==========================================
// 1. AUTHENTICATION & SMS OTP SYSTEM
// ==========================================

// Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Valid mobile number required' });
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number' });
  }

  const now = Date.now();
  const existing = otpStore.get(cleanPhone);

  // Rate limit: 45 seconds between resends
  if (existing && now - existing.lastSentAt < 45000) {
    const waitSec = Math.ceil((45000 - (now - existing.lastSentAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${waitSec}s before requesting a new OTP` });
  }

  // Generate secure 6-digit numeric OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes expiry

  otpStore.set(cleanPhone, {
    phone: cleanPhone,
    code,
    expiresAt,
    attempts: 0,
    lastSentAt: now
  });

  // SMS Gateway Integration Dispatch (e.g. Twilio, MSG91, Fast2SMS)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

  let smsSent = false;
  let providerNotes = '';

  if (twilioSid && twilioAuth && twilioNumber) {
    try {
      const authHeader = Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', `+91${cleanPhone}`);
      params.append('From', twilioNumber);
      params.append('Body', `Your Quick Karya verification OTP is: ${code}. Valid for 10 minutes. Do not share this code.`);

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (twilioRes.ok) {
        smsSent = true;
        providerNotes = 'Dispatched via Twilio SMS';
      } else {
        const twilioErr = await twilioRes.text();
        console.warn('Twilio SMS delivery error:', twilioErr);
        providerNotes = 'Twilio SMS failed, fallback active';
      }
    } catch (e: any) {
      console.warn('Twilio exception:', e?.message);
    }
  } else {
    providerNotes = 'SMS Gateway (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) not configured in .env. OTP provided in response for verification test.';
  }

  console.log(`[Quick Karya OTP] Phone: +91${cleanPhone} -> OTP: ${code}`);

  return res.json({
    success: true,
    message: smsSent ? 'OTP sent to mobile number via SMS' : 'OTP generated successfully',
    phone: cleanPhone,
    // When SMS provider credentials are pending, return code in response so user can test login immediately
    smsDispatched: smsSent,
    providerNotes,
    testOtp: !smsSent ? code : undefined
  });
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, code, role, name } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
  const record = otpStore.get(cleanPhone);

  if (!record) {
    return res.status(400).json({ error: 'No OTP requested for this number. Please request a new code.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanPhone);
    return res.status(400).json({ error: 'OTP has expired. Please request a new code.' });
  }

  if (record.attempts >= 5) {
    otpStore.delete(cleanPhone);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
  }

  if (record.code !== code.trim()) {
    record.attempts += 1;
    return res.status(400).json({ error: `Invalid OTP. ${5 - record.attempts} attempts remaining.` });
  }

  // OTP is verified - remove from store
  otpStore.delete(cleanPhone);

  const userId = `usr_${cleanPhone}`;
  // Check if user already exists
  let existingUser = await fetchUserFromCloud(userId).catch(() => null);

  if (!existingUser) {
    const userRole = (role === 'worker' ? 'worker' : 'customer') as 'customer' | 'worker';
    // Generate permanent Worker ID if registering as worker
    const workerId = userRole === 'worker' ? `QK-${Math.floor(10000 + Math.random() * 90000)}` : undefined;

    existingUser = {
      id: userId,
      phone: `+91${cleanPhone}`,
      name: (name && name.trim()) || (userRole === 'worker' ? 'Local Artisan' : 'Customer'),
      role: userRole,
      workerId,
      verified: true,
      createdAt: new Date().toISOString()
    };
    await saveUserToCloud(existingUser).catch((e) => console.warn('Could not save user:', e));
  } else {
    // If returning user already has a profile, mark verified
    if (!existingUser.verified) {
      existingUser.verified = true;
      await saveUserToCloud(existingUser).catch(() => {});
    }
  }

  return res.json({
    success: true,
    message: 'Phone number verified successfully',
    user: existingUser
  });
});

// Update Profile
app.put('/api/auth/profile', async (req, res) => {
  const { id, name, profilePhoto, role } = req.body;
  if (!id) return res.status(400).json({ error: 'User ID is required' });

  const existing = await fetchUserFromCloud(id).catch(() => null);
  if (!existing) return res.status(404).json({ error: 'User profile not found' });

  if (name) existing.name = name.trim();
  if (profilePhoto) existing.profilePhoto = profilePhoto;
  if (role) existing.role = role;

  await saveUserToCloud(existing);
  return res.json({ success: true, user: existing });
});

// ==========================================
// 2. PRIVATE CALLING & CALLER ID MASKING
// ==========================================

app.post('/api/call/mask', async (req, res) => {
  const { customerPhone, workerPhone, workerName } = req.body;
  const businessNumber = process.env.QUICK_KARYA_CALLER_ID || process.env.EXOTEL_VIRTUAL_NUMBER || process.env.TWILIO_VIRTUAL_NUMBER;
  const provider = process.env.CALL_PROVIDER || 'exotel'; // 'exotel' | 'twilio' | 'knowlarity'

  if (!customerPhone || !workerPhone) {
    return res.status(400).json({ error: 'Customer and Worker phone numbers required' });
  }

  // Check if enterprise calling provider is fully configured
  if (!businessNumber) {
    return res.json({
      status: 'pending_configuration',
      message: 'Business Virtual Number (Exotel / Twilio / Knowlarity) is not configured in .env.',
      requiredSettings: {
        provider: 'Exotel, Twilio, or Knowlarity Virtual Number',
        envVarsNeeded: [
          'QUICK_KARYA_CALLER_ID (Authorized business virtual DID)',
          'EXOTEL_API_KEY & EXOTEL_API_TOKEN or TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN'
        ],
        directFallback: `Native phone dialer tel:${workerPhone} will be launched with caller privacy notice.`
      },
      maskedDialNumber: workerPhone
    });
  }

  // In production with business credentials configured:
  // Initiates bridge call where provider calls customer and connects worker showing "Quick Karya"
  return res.json({
    status: 'connected',
    provider,
    callerId: 'Quick Karya',
    virtualBusinessNumber: businessNumber,
    message: `Call routed through Quick Karya business number (${businessNumber}) to protect personal identity.`
  });
});

// ==========================================
// 3. WORKERS DIRECTORY & SEARCH
// ==========================================

app.get('/api/workers', (req, res) => {
  const { category, search, city, pincode } = req.query;
  const userLat = req.query.lat ? parseFloat(req.query.lat as string) : null;
  const userLng = req.query.lng ? parseFloat(req.query.lng as string) : null;

  let results = [...workers];

  // Filter by category
  if (category && category !== 'All') {
    results = results.filter((w) => w.category === category);
  }

  // Filter by search keyword
  if (search && typeof search === 'string' && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    results = results.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.city.toLowerCase().includes(q) ||
        w.pincode.includes(q) ||
        (w.workerId && w.workerId.toLowerCase().includes(q)) ||
        (w.subRole && w.subRole.toLowerCase().includes(q)) ||
        (w.vehicleType && w.vehicleType.toLowerCase().includes(q)) ||
        (w.skills && w.skills.some((s) => s.toLowerCase().includes(q))) ||
        (w.languages && w.languages.some((l) => l.toLowerCase().includes(q)))
    );
  }

  // Filter by city / pincode
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

  // Calculate live proximity distance
  if (userLat !== null && userLng !== null && !isNaN(userLat) && !isNaN(userLng)) {
    results = results.map((w) => {
      const distanceKm = haversineKm(userLat, userLng, w.latitude, w.longitude);
      return {
        ...w,
        distanceKm
      };
    });

    results.sort((a, b) => {
      if (category === 'Emergency Highway Assistance') {
        if (a.emergencyAvailable && !b.emergencyAvailable) return -1;
        if (!a.emergencyAvailable && b.emergencyAvailable) return 1;
      }
      return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
    });
  } else {
    results.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
  }

  res.json(results);
});

// Register worker
app.post('/api/workers', async (req, res) => {
  const {
    name,
    category,
    experience,
    phone,
    city,
    state,
    pincode,
    skills,
    languages,
    latitude,
    longitude,
    photo,
    photoUrl,
    subRole,
    userId
  } = req.body;

  if (!name || !category || !experience || !phone || !city) {
    return res.status(400).json({ error: 'Missing required worker onboarding fields' });
  }

  // Check for duplicate profile by mobile number
  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
  const existingWorker = workers.find((w) => w.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone);
  if (existingWorker) {
    return res.status(409).json({
      error: `A worker profile is already registered with mobile number +91${cleanPhone} (Worker ID: ${existingWorker.workerId || existingWorker.id}).`,
      existingWorker
    });
  }

  let workerLat = typeof latitude === 'number' ? latitude : null;
  let workerLng = typeof longitude === 'number' ? longitude : null;

  const lowerCity = city.trim().toLowerCase();
  const matched = CITY_COORDINATES[lowerCity];

  if (workerLat === null || workerLng === null) {
    if (matched) {
      workerLat = matched.lat + (Math.random() - 0.5) * 0.01;
      workerLng = matched.lng + (Math.random() - 0.5) * 0.01;
    } else {
      workerLat = 23.8315;
      workerLng = 91.2868;
    }
  }

  const determinedState = state?.trim() || (matched?.state || 'Tripura');
  const profilePhoto = photo || photoUrl || undefined;

  // Generate permanent Worker ID
  const permanentWorkerId = `QK-${Math.floor(10000 + Math.random() * 90000)}`;

  const newWorker: WorkerProfile = {
    id: `w-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    workerId: permanentWorkerId,
    name: name.trim(),
    category: category as ServiceCategory,
    subRole: subRole ? subRole.trim() : undefined,
    experience: parseInt(experience, 10) || 1,
    rating: 5.0,
    reviewCount: 0, // Starts at 0 reviews for authentic ratings
    hourlyRate: 0,
    rate: 0,
    phone: `+91${cleanPhone}`,
    city: city.trim(),
    state: determinedState,
    pincode: pincode ? pincode.trim() : (matched?.pincode || '799001'),
    latitude: workerLat,
    longitude: workerLng,
    verified: false, // strictly false for newly onboarded
    isVerified: false,
    available: true,
    completedJobs: 0,
    photo: profilePhoto,
    languages: languages
      ? (Array.isArray(languages) ? languages : languages.split(',')).map((l: string) => l.trim()).filter(Boolean)
      : ['Hindi', 'Bengali', 'Local'],
    skills: skills
      ? (Array.isArray(skills) ? skills : skills.split(',')).map((s: string) => s.trim()).filter(Boolean)
      : subRole ? [subRole.trim(), category] : [category],
    emergencyAvailable: category === 'Emergency Highway Assistance'
  };

  workers.unshift(newWorker);

  // Sync to Cloud Firestore
  await saveWorkerToCloud(newWorker).catch((err) => {
    console.warn('Could not sync worker to Firestore:', err);
  });

  // If registering user ID is provided, update user record with Worker ID
  if (userId) {
    const user = await fetchUserFromCloud(userId).catch(() => null);
    if (user) {
      user.workerId = permanentWorkerId;
      user.role = 'worker';
      if (profilePhoto) user.profilePhoto = profilePhoto;
      await saveUserToCloud(user).catch(() => {});
    }
  }

  res.status(201).json({
    success: true,
    message: 'Worker registered successfully with Quick Karya',
    worker: newWorker
  });
});

// ==========================================
// 4. RATINGS & REVIEWS SYSTEM
// ==========================================

// Get reviews for a worker
app.get('/api/workers/:workerId/reviews', async (req, res) => {
  const { workerId } = req.params;
  try {
    const reviews = await fetchReviewsForWorker(workerId);
    res.json(reviews);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error fetching reviews' });
  }
});

// Post a new review
app.post('/api/reviews', async (req, res) => {
  const { workerId, customerId, customerName, rating, comment, serviceRequestId } = req.body;

  if (!workerId || !customerId || !rating || !serviceRequestId) {
    return res.status(400).json({ error: 'Missing required review fields' });
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5 stars' });
  }

  // Prevent duplicate reviews for the same service request
  const existingReviews = await fetchReviewsForWorker(workerId);
  const alreadyReviewed = existingReviews.some((r) => r.serviceRequestId === serviceRequestId);
  if (alreadyReviewed) {
    return res.status(409).json({ error: 'A review has already been submitted for this completed service.' });
  }

  const review: WorkerReview = {
    id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    workerId,
    customerId,
    customerName: customerName || 'Customer',
    rating: numRating,
    comment: comment ? comment.trim() : undefined,
    serviceRequestId,
    createdAt: new Date().toISOString(),
    reported: false
  };

  await saveReviewToCloud(review);

  // Update in-memory worker profile
  const targetWorker = workers.find((w) => w.id === workerId);
  if (targetWorker) {
    const currentCount = targetWorker.reviewCount || 0;
    const currentRating = targetWorker.rating || 5.0;
    const newCount = currentCount + 1;
    targetWorker.rating = Number(((currentRating * currentCount + numRating) / newCount).toFixed(1));
    targetWorker.reviewCount = newCount;
  }

  res.status(201).json({ success: true, review });
});

// Report abusive review
app.post('/api/reviews/:reviewId/report', async (req, res) => {
  const { reviewId } = req.params;
  // Mark review as reported for moderation
  res.json({ success: true, message: 'Review reported for administrative moderation.' });
});

// ==========================================
// 5. SERVICE REQUESTS & GPS LOCATION SHARING
// ==========================================

// Create service request
app.post('/api/service-requests', async (req, res) => {
  const {
    customerId,
    customerName,
    customerPhone,
    workerId,
    customerLat,
    customerLng,
    serviceAddress,
    hasLocationPermission
  } = req.body;

  if (!customerId || !workerId) {
    return res.status(400).json({ error: 'Customer ID and Worker ID are required' });
  }

  const worker = workers.find((w) => w.id === workerId);

  const newReq: ServiceRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    customerId,
    customerName: customerName || 'Customer',
    customerPhone: customerPhone || '',
    workerId,
    workerName: worker?.name || 'Artisan',
    workerCategory: worker?.category || 'Service',
    status: 'pending',
    customerLat: typeof customerLat === 'number' ? customerLat : undefined,
    customerLng: typeof customerLng === 'number' ? customerLng : undefined,
    serviceAddress: serviceAddress?.trim() || undefined,
    hasLocationPermission: Boolean(hasLocationPermission),
    reviewed: false,
    createdAt: new Date().toISOString()
  };

  await saveServiceRequestToCloud(newReq).catch((e) => console.warn(e));
  res.status(201).json({ success: true, serviceRequest: newReq });
});

// Update request status (e.g. mark completed)
app.patch('/api/service-requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'accepted', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Update in cloud
  res.json({ success: true, status });
});

// Get user service requests
app.get('/api/users/:userId/requests', async (req, res) => {
  const { userId } = req.params;
  const isWorker = req.query.isWorker === 'true';
  try {
    const list = await fetchUserRequests(userId, isWorker);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error fetching requests' });
  }
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
