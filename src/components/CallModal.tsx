import React, { useState, useEffect } from 'react';
import { WorkerProfile, UserLocation, AppUser, ServiceRequest } from '../types';
import { getApiUrl } from '../config';
import {
  Phone,
  Check,
  Copy,
  MessageSquare,
  ShieldCheck,
  MapPin,
  X,
  Moon,
  Bike,
  Car,
  Truck,
  HardHat,
  Zap,
  Navigation,
  LocateFixed,
  Loader2,
  Compass,
  AlertCircle
} from 'lucide-react';
import { formatDistance } from '../utils/geo';
import { formatWorkerPricing, isLateNightNow } from '../utils/pricing';
import { triggerCallWorkerNotification } from '../utils/notifications';
import { addCallRecord } from '../utils/callHistory';

interface CallModalProps {
  worker: WorkerProfile | null;
  onClose: () => void;
  userLocation?: UserLocation;
  currentUser?: AppUser | null;
  onServiceBooked?: (req: ServiceRequest) => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  worker,
  onClose,
  userLocation,
  currentUser,
  onServiceBooked
}) => {
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [sharedGpsCoords, setSharedGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [callAlertNotice, setCallAlertNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize or reset locations when worker changes
  useEffect(() => {
    if (worker) {
      if (userLocation?.city) {
        setPickupLocation(
          userLocation.isLiveGps
            ? `Live GPS Area (${userLocation.city}${userLocation.state ? ', ' + userLocation.state : ''})`
            : `${userLocation.city}${userLocation.state ? ', ' + userLocation.state : ''}`
        );
        if (userLocation.latitude && userLocation.longitude) {
          setSharedGpsCoords({ lat: userLocation.latitude, lng: userLocation.longitude });
        }
      } else {
        setPickupLocation('');
      }
      setDropLocation('');
      setValidationError(null);
      setCallAlertNotice(null);
      setCopiedNumber(false);
      setCopiedSummary(false);
    }
  }, [worker, userLocation]);

  if (!worker) return null;

  const rawPhone = worker.phone.replace(/[^0-9+]/g, '');
  const cleanPhoneForWa = rawPhone.replace(/^\+/, '');
  const pricing = formatWorkerPricing(worker);
  const isNightActive = isLateNightNow() && pricing.hasNightRate;
  const isEmergency = worker.category === 'Emergency Highway Assistance';
  const isDriver = worker.category === 'Driver';

  // Drop location is mandatory for per_km rides (e.g. bike, auto or per-km driver)
  const isKmRate = worker.pricingType === 'per_km' || worker.rateUnit === '/km';
  const isDropMandatory = isDriver && isKmRate;

  // Handle GPS location detection
  const handleUseGpsLocation = () => {
    if (!navigator.geolocation) {
      if (userLocation?.city) {
        setPickupLocation(`${userLocation.city}${userLocation.state ? ', ' + userLocation.state : ''}`);
      } else {
        setValidationError('Geolocation is not supported by your device browser.');
      }
      return;
    }

    setIsLocatingGps(true);
    setValidationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setSharedGpsCoords({ lat: latitude, lng: longitude });
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            const fullAddress =
              data.displayName ||
              `${data.city}${data.state ? ', ' + data.state : ''}${data.pincode ? ' - ' + data.pincode : ''}`;
            setPickupLocation(fullAddress);
          } else {
            setPickupLocation(
              userLocation?.city
                ? `${userLocation.city} (GPS: ${latitude.toFixed(3)}, ${longitude.toFixed(3)})`
                : `Current GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
            );
          }
        } catch {
          setPickupLocation(
            userLocation?.city
              ? `${userLocation.city} (GPS: ${latitude.toFixed(3)}, ${longitude.toFixed(3)})`
              : `Current GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          );
        } finally {
          setIsLocatingGps(false);
        }
      },
      (err) => {
        setIsLocatingGps(false);
        if (userLocation?.city) {
          setPickupLocation(`${userLocation.city}${userLocation.state ? ', ' + userLocation.state : ''}`);
        } else {
          setValidationError('Location access denied or unavailable. Please type your pickup address.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  // Build message with exact location details
  const buildWhatsAppMessage = (): string => {
    const rateText = isNightActive
      ? `${pricing.displayNightRate} (Night Rate) • Standard: ${pricing.allRatesFormatted}`
      : pricing.allRatesFormatted;
    if (isDriver) {
      const vehicleDesc = pricing.vehicleBadge || 'Driver Service';
      const pickupText = pickupLocation.trim() || 'To be specified';
      const dropText = dropLocation.trim() || (isDropMandatory ? 'Point-to-Point (To be confirmed)' : 'Full Day / As required');

      return [
        `Hello ${worker.name}, I would like to book a ride via Quick Karya:`,
        ``,
        `🚖 Vehicle: ${vehicleDesc}`,
        `📍 Pickup Location: ${pickupText}`,
        `🎯 Drop Location: ${dropText}`,
        `💰 Quoted Rates: ${rateText}`,
        ``,
        `Please confirm your availability and arrival time. Thank you!`
      ].join('\n');
    } else {
      const addressLine = pickupLocation.trim() ? `\n📍 Service Address: ${pickupLocation.trim()}` : '';
      const pinCoords = sharedGpsCoords || (userLocation?.latitude && userLocation?.longitude ? { lat: userLocation.latitude, lng: userLocation.longitude } : null);
      const mapLine = pinCoords ? `\n🗺️ Google Maps Navigation Pin: https://maps.google.com/?q=${pinCoords.lat},${pinCoords.lng}` : '';
      return `Hello ${worker.name}, I found your profile on Quick Karya for ${worker.category} service (Rates: ${rateText}).${addressLine}${mapLine}\nPlease confirm if you are available. Thank you!`;
    }
  };

  // Validate before proceeding
  const validateInputs = (): boolean => {
    if (isDriver) {
      if (!pickupLocation.trim()) {
        setValidationError('Please enter a Pickup Location (or tap "Use Current GPS Location").');
        return false;
      }
      if (isDropMandatory && !dropLocation.trim()) {
        setValidationError('Please enter a Drop Location for point-to-point ride booking.');
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  // Handle Call Action
  const handleCallDriver = (e: React.MouseEvent) => {
    if (!validateInputs()) {
      e.preventDefault();
      return;
    }

    // Set in-app alert toast notification
    setCallAlertNotice(`📞 Calling ${worker.name}... Alert logged and sent to artisan device!`);

    // Auto-copy ride summary to clipboard for convenient reference during the phone call
    const summaryText = isDriver
      ? `Quick Karya Ride Booking\nDriver: ${worker.name} (${worker.phone})\nPickup: ${pickupLocation.trim()}\nDrop: ${dropLocation.trim() || 'Flexible'}\nRate: ${isNightActive ? pricing.displayNightRate : pricing.displayRate}`
      : `Quick Karya Service Booking\nWorker: ${worker.name} (${worker.category})\nLocation: ${pickupLocation.trim() || 'As agreed'}\nRate: ${pricing.displayRate}`;

    // Record service request to enable rating and location sharing
    if (currentUser) {
      fetch(getApiUrl('/api/service-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentUser.id,
          customerName: currentUser.name,
          customerPhone: currentUser.phone,
          workerId: worker.id,
          customerLat: sharedGpsCoords?.lat || userLocation?.latitude,
          customerLng: sharedGpsCoords?.lng || userLocation?.longitude,
          serviceAddress: pickupLocation.trim() || undefined,
          hasLocationPermission: Boolean(userLocation?.isLiveGps || sharedGpsCoords)
        })
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.serviceRequest && onServiceBooked) {
            onServiceBooked(data.serviceRequest);
          }
        })
        .catch(() => {});
    }

    // Trigger push notification to worker device with explicit customer identity
    triggerCallWorkerNotification(
      worker.name,
      worker.phone,
      worker.category,
      currentUser?.name,
      currentUser?.phone
    ).catch(() => {});

    // Save call to local & cloud Call History
    try {
      addCallRecord({
        workerId: worker.id,
        workerName: worker.name,
        workerCategory: worker.category,
        workerPhone: worker.phone,
        workerPhoto: worker.photo || worker.avatar,
        workerCity: worker.city,
        workerRating: worker.rating,
        type: 'phone',
        callerId: currentUser?.id,
        callerName: currentUser?.name,
        location: pickupLocation.trim() || userLocation?.city
      });
    } catch {}

    // Call through masked route or direct native dialer
    window.location.href = `tel:${rawPhone}`;
  };

  // Handle WhatsApp Click with validation
  const handleWhatsAppClick = (e: React.MouseEvent) => {
    if (!validateInputs()) {
      e.preventDefault();
      return;
    }
    const message = buildWhatsAppMessage();

    // Save WhatsApp contact to Call History
    try {
      addCallRecord({
        workerId: worker.id,
        workerName: worker.name,
        workerCategory: worker.category,
        workerPhone: worker.phone,
        workerPhoto: worker.photo || worker.avatar,
        workerCity: worker.city,
        workerRating: worker.rating,
        type: 'whatsapp',
        callerId: currentUser?.id,
        callerName: currentUser?.name,
        location: pickupLocation.trim() || userLocation?.city
      });
    } catch {}

    const url = `https://wa.me/${cleanPhoneForWa}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText(worker.phone);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleCopySummary = () => {
    const summaryText = isDriver
      ? `Quick Karya Ride Booking:\nDriver: ${worker.name} (${worker.phone})\nVehicle: ${pricing.vehicleBadge || 'Driver'}\nPickup: ${pickupLocation.trim() || 'Not specified'}\nDrop: ${dropLocation.trim() || 'Flexible'}\nRate: ${isNightActive ? pricing.displayNightRate : pricing.displayRate}`
      : `Quick Karya Service Booking:\nWorker: ${worker.name} (${worker.phone})\nCategory: ${worker.category}\nAddress: ${pickupLocation.trim() || 'Not specified'}\nRate: ${pricing.displayRate}`;

    navigator.clipboard?.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div
      id="call-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        id="call-modal-container"
        className="w-full sm:max-w-lg bg-[#0B192C] text-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-[#FFA500]/30 transform transition-all animate-in slide-in-from-bottom-5 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#001428] via-[#0B192C] to-[#001F3F] text-white p-4 sm:p-5 relative shrink-0 border-b border-[#FFA500]/25">
          <button
            id="close-call-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-13 h-13 rounded-full bg-[#001F3F] border-2 border-[#FFA500] flex items-center justify-center text-white text-lg font-bold shadow-md overflow-hidden shrink-0">
              {worker.photo ? (
                <img
                  src={worker.photo}
                  alt={worker.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                worker.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
              )}
            </div>
            <div className="min-w-0 pr-8">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight truncate">
                  {worker.name}
                </h3>
                {worker.verified && (
                  <span title="Verified Worker" className="text-amber-300 shrink-0">
                    <ShieldCheck className="w-4 h-4 fill-[#FFA500] text-[#001F3F]" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-xs text-amber-300 font-semibold">{worker.category}</p>
                {pricing.vehicleBadge && (
                  <span className="text-[10px] bg-[#002d5c] text-amber-200 border border-[#FFA500]/40 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                    {pricing.vehicleBadge.includes('JCB') || pricing.vehicleBadge.includes('Bulldozer') ? (
                      <HardHat className="w-3 h-3 text-amber-300" />
                    ) : pricing.vehicleBadge.includes('Truck') ||
                      pricing.vehicleBadge.includes('Freight') ||
                      pricing.vehicleBadge.includes('Trailer') ||
                      pricing.vehicleBadge.includes('Pickup') ? (
                      <Truck className="w-3 h-3 text-amber-300" />
                    ) : pricing.vehicleBadge.includes('2-Wheeler') ? (
                      <Bike className="w-3 h-3 text-amber-300" />
                    ) : (
                      <Car className="w-3 h-3 text-amber-300" />
                    )}
                    <span>{pricing.vehicleBadge}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {worker.city}
                    {worker.state ? `, ${worker.state}` : ''} • {formatDistance(worker.distanceKm)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Caller ID & Privacy Notice */}
        <div className="bg-[#001428] px-4 sm:px-5 py-2.5 border-b border-[#0a2e5c] flex items-center justify-between text-xs shrink-0 text-white">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
            <ShieldCheck className="w-4 h-4 text-[#FFA500]" />
            <span>Caller ID: Quick Karya</span>
          </div>
          <span className="text-slate-300 font-medium text-[11px]">Phone Numbers Protected</span>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* In-App Call Notification / Alert Banner */}
          {callAlertNotice && (
            <div className="p-3 bg-[#001428] border border-[#FFA500] text-amber-300 text-xs rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 shadow-md">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFA500] animate-ping shrink-0" />
                <span className="font-bold text-white">{callAlertNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setCallAlertNotice(null)}
                className="text-xs text-amber-300 hover:text-white font-bold ml-2 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          {/* DRIVER RIDE BOOKING: Pickup & Drop Location Fields */}
          {isDriver ? (
            <div
              id="driver-location-fields-card"
              className="p-3.5 bg-[#001428] rounded-2xl border border-[#FFA500]/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Compass className="w-4 h-4 text-[#FFA500]" />
                  <span>Ride Route Details</span>
                </div>
                <span className="text-[10px] text-amber-200 font-semibold bg-[#002d5c] border border-[#FFA500]/40 px-2 py-0.5 rounded-md">
                  {pricing.vehicleBadge || 'Driver Ride'}
                </span>
              </div>

              {/* Pickup Location Input with 'Use Current GPS Location' */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="pickup-location-input"
                    className="text-xs font-bold text-slate-200 flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#FFA500]"></span>
                    <span>Pickup Location</span>
                    <span className="text-amber-400 font-bold">*</span>
                  </label>

                  <button
                    type="button"
                    id="use-current-gps-btn"
                    onClick={handleUseGpsLocation}
                    disabled={isLocatingGps}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#001F3F] bg-[#FFA500] hover:bg-[#FF8C00] rounded-lg px-2 py-1 transition-all shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {isLocatingGps ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-[#001F3F]" />
                        <span>Detecting GPS...</span>
                      </>
                    ) : (
                      <>
                        <LocateFixed className="w-3.5 h-3.5 text-[#001F3F]" />
                        <span>Use Current GPS Location</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <input
                    id="pickup-location-input"
                    type="text"
                    value={pickupLocation}
                    onChange={(e) => {
                      setPickupLocation(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="Enter pickup address, landmark, or street name..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[#001f3f] rounded-xl border border-[#FFA500]/40 text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FFA500] shadow-xs font-medium"
                  />
                  <MapPin className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              {/* Drop Location Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="drop-location-input"
                    className="text-xs font-bold text-slate-200 flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Drop Location</span>
                    {isDropMandatory && <span className="text-amber-400 font-bold">*</span>}
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isDropMandatory ? '(Required for km ride)' : '(Optional for Full-Day Hire)'}
                  </span>
                </div>

                <div className="relative">
                  <input
                    id="drop-location-input"
                    type="text"
                    value={dropLocation}
                    onChange={(e) => {
                      setDropLocation(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder={
                      isDropMandatory
                        ? 'Enter destination / drop landmark (required for route)...'
                        : 'Enter drop destination (optional for daily driver)...'
                    }
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[#001f3f] rounded-xl border border-[#FFA500]/40 text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FFA500] shadow-xs font-medium"
                  />
                  <Navigation className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>
          ) : (
            /* Non-Driver: Customer GPS Location & Service Address Sharing */
            <div
              id="service-location-field-card"
              className="p-3.5 bg-[#001428] rounded-2xl border border-[#FFA500]/30 space-y-2.5 shadow-md"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="pickup-location-input"
                  className="text-xs font-extrabold text-[#FFD700] flex items-center gap-1.5"
                >
                  <MapPin className="w-4 h-4 text-[#FFA500]" />
                  <span>Job Site Address / Navigation Pin</span>
                </label>
                <button
                  type="button"
                  id="use-current-gps-btn"
                  onClick={handleUseGpsLocation}
                  disabled={isLocatingGps}
                  className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#001F3F] bg-[#FFA500] hover:bg-[#FF8C00] rounded-lg px-2.5 py-1 cursor-pointer shadow-xs transition-all active:scale-95"
                >
                  {isLocatingGps ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#001F3F]" />
                      <span>Detecting GPS...</span>
                    </>
                  ) : (
                    <>
                      <LocateFixed className="w-3.5 h-3.5 text-[#001F3F]" />
                      <span>Share My GPS Pin</span>
                    </>
                  )}
                </button>
              </div>

              <input
                id="pickup-location-input"
                type="text"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="Enter house/shop address, street name, or nearby landmark..."
                className="w-full px-3 py-2 text-xs bg-[#001f3f] rounded-xl border border-[#FFA500]/40 text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FFA500] font-medium shadow-xs"
              />

              {sharedGpsCoords && (
                <div className="p-2 bg-[#001F3F] rounded-lg border border-[#FFA500]/30 text-[11px] flex items-center justify-between text-amber-200">
                  <span className="flex items-center gap-1 truncate mr-2 font-mono text-[10.5px]">
                    📍 GPS: {sharedGpsCoords.lat.toFixed(4)}, {sharedGpsCoords.lng.toFixed(4)}
                  </span>
                  <a
                    href={`https://maps.google.com/?q=${sharedGpsCoords.lat},${sharedGpsCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[#FFA500] hover:text-white font-bold underline flex items-center gap-0.5"
                  >
                    View Map ↗
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Validation Warning Alert */}
          {validationError && (
            <div
              id="location-validation-alert"
              className="p-2.5 bg-red-950/80 border border-red-500 text-red-200 text-xs rounded-xl flex items-center gap-2 animate-in fade-in duration-150"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Active Call / Ride Dispatch Summary Banner */}
          <div
            id="ride-summary-card"
            className="p-3 bg-[#001428] rounded-xl border border-[#0a2e5c] text-xs space-y-1.5"
          >
            <div className="flex items-center justify-between font-bold text-white">
              <span className="flex items-center gap-1 text-[#FFD700]">
                {isDriver ? (
                  <>
                    <Car className="w-3.5 h-3.5 text-[#FFA500]" />
                    <span>Driver Call Summary</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-3.5 h-3.5 text-[#FFA500]" />
                    <span>Booking Dispatch Summary</span>
                  </>
                )}
              </span>
              <span className="text-[10px] text-[#001F3F] bg-[#FFA500] px-2 py-0.5 rounded font-black">
                {isNightActive ? pricing.displayNightRate : pricing.displayRate}
              </span>
            </div>

            <div className="text-slate-300 space-y-1 text-[11px] pt-0.5">
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-white min-w-[50px]">
                  {isDriver ? 'Pickup:' : 'Location:'}
                </span>
                <span className="text-slate-200 break-words flex-1 font-medium">
                  {pickupLocation.trim() || (
                    <span className="text-slate-400 italic">Enter location above</span>
                  )}
                </span>
              </div>

              {isDriver && (
                <div className="flex items-start gap-1.5">
                  <span className="font-semibold text-white min-w-[50px]">Drop:</span>
                  <span className="text-slate-200 break-words flex-1 font-medium">
                    {dropLocation.trim() || (
                      <span className="text-slate-400 italic">
                        {isDropMandatory ? 'Enter destination above' : 'To be confirmed / Full day'}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Worker Direct Contact Box */}
          <div className="p-3 bg-[#001428] rounded-xl border border-[#FFA500]/30 text-center">
            <p className="text-[11px] text-amber-300 uppercase tracking-wider mb-0.5 font-bold">
              {isDriver ? 'Driver Phone Contact' : 'Worker Direct Contact'}
            </p>
            <p className="text-2xl font-mono font-bold text-white tracking-wide">
              {worker.phone}
            </p>
            <div className="flex items-center justify-center gap-1 mt-0.5 text-xs text-emerald-400 font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Available for immediate dispatch</span>
            </div>
          </div>

          {/* Primary Action: Direct Call Button */}
          <button
            id="direct-call-action-btn"
            onClick={handleCallDriver}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#FFA500] hover:bg-[#FF8C00] active:scale-98 text-[#001F3F] font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all text-sm sm:text-base cursor-pointer"
          >
            <Phone className="w-4 h-4 sm:w-5 sm:h-5 fill-[#001F3F]" />
            <span>
              {isDriver ? 'Call Driver Now' : `Call ${worker.name.split(' ')[0]} Now`}
            </span>
          </button>

          {/* Secondary Actions: Copy & WhatsApp */}
          <div className="grid grid-cols-2 gap-2">
            {/* WhatsApp Chat Button with auto-populated pickup/drop message */}
            <button
              type="button"
              id="whatsapp-chat-btn"
              onClick={handleWhatsAppClick}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-emerald-500/50 bg-[#002a1a] hover:bg-[#003824] text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>{isDriver ? 'WhatsApp Driver' : 'WhatsApp'}</span>
            </button>

            {/* Copy Summary or Number */}
            <button
              type="button"
              id="copy-ride-details-btn"
              onClick={handleCopySummary}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border border-[#0a2e5c] bg-[#001428] hover:bg-[#002244] text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-4 h-4 text-[#FFA500]" />
                  <span className="text-amber-300">Copied Details!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Details</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Copy Number link */}
          <div className="text-center pt-0.5">
            <button
              type="button"
              id="copy-phone-btn"
              onClick={handleCopyPhone}
              className="text-[11px] text-slate-400 hover:text-amber-300 font-medium underline underline-offset-2 cursor-pointer transition-colors"
            >
              {copiedNumber ? 'Phone number copied!' : 'Or copy phone number only'}
            </button>
          </div>

          {/* Safety Disclaimer */}
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Quick Karya verified service. Locations are shared directly with the artisan to ensure fast pickup and accurate route dispatch.
          </p>
        </div>
      </div>
    </div>
  );
};
