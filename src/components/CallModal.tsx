import React, { useState, useEffect } from 'react';
import { WorkerProfile, UserLocation } from '../types';
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

interface CallModalProps {
  worker: WorkerProfile | null;
  onClose: () => void;
  userLocation?: UserLocation;
}

export const CallModal: React.FC<CallModalProps> = ({ worker, onClose, userLocation }) => {
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [isLocatingGps, setIsLocatingGps] = useState(false);
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
      } else {
        setPickupLocation('');
      }
      setDropLocation('');
      setValidationError(null);
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
      return `Hello ${worker.name}, I found your profile on Quick Karya for ${worker.category} service (Rates: ${rateText}).${addressLine}\nPlease confirm if you are available. Thank you!`;
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

    // Auto-copy ride summary to clipboard for convenient reference during the phone call
    const summaryText = isDriver
      ? `Quick Karya Ride Booking\nDriver: ${worker.name} (${worker.phone})\nPickup: ${pickupLocation.trim()}\nDrop: ${dropLocation.trim() || 'Flexible'}\nRate: ${isNightActive ? pricing.displayNightRate : pricing.displayRate}`
      : `Quick Karya Service Booking\nWorker: ${worker.name} (${worker.category})\nLocation: ${pickupLocation.trim() || 'As agreed'}\nRate: ${pricing.displayRate}`;

    try {
      navigator.clipboard?.writeText(summaryText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      // Fallback ignore clipboard errors
    }

    window.location.href = `tel:${rawPhone}`;
  };

  // Handle WhatsApp Click with validation
  const handleWhatsAppClick = (e: React.MouseEvent) => {
    if (!validateInputs()) {
      e.preventDefault();
      return;
    }
    const message = buildWhatsAppMessage();
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        id="call-modal-container"
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-emerald-950/10 transform transition-all animate-in slide-in-from-bottom-5 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-900 text-white p-4 sm:p-5 relative shrink-0">
          <button
            id="close-call-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-emerald-950/40 hover:bg-emerald-950/60 text-emerald-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-13 h-13 rounded-2xl bg-emerald-700 border-2 border-emerald-400/40 flex items-center justify-center text-white text-lg font-bold shadow-inner overflow-hidden shrink-0">
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
                  <span title="Verified Worker" className="text-emerald-300 shrink-0">
                    <ShieldCheck className="w-4 h-4 fill-emerald-400 text-emerald-900" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-xs text-emerald-200 font-medium">{worker.category}</p>
                {pricing.vehicleBadge && (
                  <span className="text-[10px] bg-emerald-700/90 text-emerald-100 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                    {pricing.vehicleBadge.includes('JCB') || pricing.vehicleBadge.includes('Bulldozer') ? (
                      <HardHat className="w-3 h-3 text-amber-200" />
                    ) : pricing.vehicleBadge.includes('Truck') ||
                      pricing.vehicleBadge.includes('Freight') ||
                      pricing.vehicleBadge.includes('Trailer') ||
                      pricing.vehicleBadge.includes('Pickup') ? (
                      <Truck className="w-3 h-3 text-emerald-200" />
                    ) : pricing.vehicleBadge.includes('2-Wheeler') ? (
                      <Bike className="w-3 h-3 text-emerald-200" />
                    ) : (
                      <Car className="w-3 h-3 text-emerald-200" />
                    )}
                    <span>{pricing.vehicleBadge}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-emerald-100/90">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span>
                    {worker.city}
                    {worker.state ? `, ${worker.state}` : ''} • {formatDistance(worker.distanceKm)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Banner */}
        <div className="bg-emerald-50 px-4 sm:px-5 py-2.5 border-b border-emerald-100 space-y-1.5 text-xs shrink-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="text-gray-600 font-bold uppercase tracking-wider text-[11px] shrink-0">Configured Rates:</span>
            <span className="text-xs sm:text-sm font-extrabold text-emerald-900 text-right">
              {pricing.allRatesFormatted}
            </span>
          </div>

          {pricing.hasMultipleRates && (
            <div className="pt-1 border-t border-emerald-200/50 flex items-center gap-1.5 flex-wrap">
              {pricing.allRates.map((r, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-white text-emerald-900 border border-emerald-200 text-[10px] font-semibold shadow-2xs"
                >
                  <span className="text-gray-500 mr-1">{r.label}:</span>
                  <strong className="text-emerald-950 font-extrabold">{r.displayRate}</strong>
                </span>
              ))}
            </div>
          )}

          {pricing.hasNightRate && (
            <div
              className={`p-2 rounded-xl border flex items-center justify-between ${
                isNightActive
                  ? 'bg-purple-100 border-purple-300 text-purple-950 font-semibold'
                  : 'bg-white border-purple-200 text-purple-900'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                <span className="text-[11px]">
                  {isNightActive ? '🌙 Active Night Rate (8 PM - 6 AM)' : '🌙 Late Night Rate (8 PM - 6 AM)'}
                </span>
              </div>
              <span className="font-extrabold text-xs text-purple-950">
                {pricing.displayNightRate}
              </span>
            </div>
          )}

          {isEmergency && (
            <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Priority 24/7 highway assistance on fixed dispatch fee</span>
            </div>
          )}
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* DRIVER RIDE BOOKING: Pickup & Drop Location Fields */}
          {isDriver ? (
            <div
              id="driver-location-fields-card"
              className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/90 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                  <Compass className="w-4 h-4 text-emerald-700" />
                  <span>Ride Route Details</span>
                </div>
                <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded-md">
                  {pricing.vehicleBadge || 'Driver Ride'}
                </span>
              </div>

              {/* Pickup Location Input with 'Use Current GPS Location' */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="pickup-location-input"
                    className="text-xs font-bold text-gray-800 flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>Pickup Location</span>
                    <span className="text-red-500 font-bold">*</span>
                  </label>

                  <button
                    type="button"
                    id="use-current-gps-btn"
                    onClick={handleUseGpsLocation}
                    disabled={isLocatingGps}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-white hover:bg-emerald-100/70 border border-emerald-300 rounded-lg px-2 py-1 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
                  >
                    {isLocatingGps ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                        <span>Detecting GPS...</span>
                      </>
                    ) : (
                      <>
                        <LocateFixed className="w-3.5 h-3.5 text-emerald-700" />
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
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white rounded-xl border border-emerald-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs font-medium"
                  />
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 top-2.5" />
                </div>
              </div>

              {/* Drop Location Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="drop-location-input"
                    className="text-xs font-bold text-gray-800 flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Drop Location</span>
                    {isDropMandatory && <span className="text-red-500 font-bold">*</span>}
                  </label>
                  <span className="text-[10px] text-gray-500 font-medium">
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
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white rounded-xl border border-emerald-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs font-medium"
                  />
                  <Navigation className="w-3.5 h-3.5 text-amber-600 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>
          ) : (
            /* Non-Driver: Optional Service Address with GPS button */
            <div
              id="service-location-field-card"
              className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="pickup-location-input"
                  className="text-xs font-bold text-gray-700 flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Your Service Address (Optional)</span>
                </label>
                <button
                  type="button"
                  id="use-current-gps-btn"
                  onClick={handleUseGpsLocation}
                  disabled={isLocatingGps}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 bg-white border border-emerald-300 rounded-md px-2 py-0.5 cursor-pointer shadow-2xs"
                >
                  {isLocatingGps ? (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                  ) : (
                    <LocateFixed className="w-3 h-3 text-emerald-700" />
                  )}
                  <span>Use GPS</span>
                </button>
              </div>
              <input
                id="pickup-location-input"
                type="text"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g., Flat 204, Green Apartment, Agartala..."
                className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          )}

          {/* Validation Warning Alert */}
          {validationError && (
            <div
              id="location-validation-alert"
              className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 animate-in fade-in duration-150"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Active Call / Ride Dispatch Summary Banner */}
          <div
            id="ride-summary-card"
            className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50/70 rounded-xl border border-emerald-200 text-xs space-y-1.5"
          >
            <div className="flex items-center justify-between font-bold text-emerald-950">
              <span className="flex items-center gap-1">
                {isDriver ? (
                  <>
                    <Car className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Driver Call Summary</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Booking Dispatch Summary</span>
                  </>
                )}
              </span>
              <span className="text-[10px] text-emerald-800 bg-white border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                {isNightActive ? pricing.displayNightRate : pricing.displayRate}
              </span>
            </div>

            <div className="text-gray-700 space-y-1 text-[11px] pt-0.5">
              <div className="flex items-start gap-1.5">
                <span className="font-semibold text-gray-900 min-w-[50px]">
                  {isDriver ? 'Pickup:' : 'Location:'}
                </span>
                <span className="text-gray-800 break-words flex-1 font-medium">
                  {pickupLocation.trim() || (
                    <span className="text-gray-400 italic">Enter location above</span>
                  )}
                </span>
              </div>

              {isDriver && (
                <div className="flex items-start gap-1.5">
                  <span className="font-semibold text-gray-900 min-w-[50px]">Drop:</span>
                  <span className="text-gray-800 break-words flex-1 font-medium">
                    {dropLocation.trim() || (
                      <span className="text-gray-400 italic">
                        {isDropMandatory ? 'Enter destination above' : 'To be confirmed / Full day'}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Worker Direct Contact Box */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-center">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">
              {isDriver ? 'Driver Phone Contact' : 'Worker Direct Contact'}
            </p>
            <p className="text-2xl font-mono font-bold text-gray-900 tracking-wide">
              {worker.phone}
            </p>
            <div className="flex items-center justify-center gap-1 mt-0.5 text-xs text-emerald-700">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Available for immediate dispatch</span>
            </div>
          </div>

          {/* Primary Action: Direct Call Button */}
          <button
            id="direct-call-action-btn"
            onClick={handleCallDriver}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-semibold rounded-xl shadow-md shadow-emerald-900/20 transition-all text-sm sm:text-base cursor-pointer"
          >
            <Phone className="w-4 h-4 sm:w-5 sm:h-5 fill-white" />
            <span>
              {isDriver
                ? `Call Driver Now (${isNightActive ? pricing.displayNightRate : pricing.displayRate})`
                : `Call ${worker.name.split(' ')[0]} Now (${isNightActive ? pricing.displayNightRate : pricing.displayRate})`}
            </span>
          </button>

          {/* Secondary Actions: Copy & WhatsApp */}
          <div className="grid grid-cols-2 gap-2">
            {/* WhatsApp Chat Button with auto-populated pickup/drop message */}
            <button
              type="button"
              id="whatsapp-chat-btn"
              onClick={handleWhatsAppClick}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-700" />
              <span>{isDriver ? 'WhatsApp Driver' : 'WhatsApp'}</span>
            </button>

            {/* Copy Summary or Number */}
            <button
              type="button"
              id="copy-ride-details-btn"
              onClick={handleCopySummary}
              className="flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copied Details!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
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
              className="text-[11px] text-gray-500 hover:text-emerald-800 font-medium underline underline-offset-2 cursor-pointer transition-colors"
            >
              {copiedNumber ? 'Phone number copied!' : 'Or copy phone number only'}
            </button>
          </div>

          {/* Safety Disclaimer */}
          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            Quick Karya verified service. Locations are shared directly with the driver to ensure fast pickup and accurate route dispatch.
          </p>
        </div>
      </div>
    </div>
  );
};
