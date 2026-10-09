import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveTab,
  ServiceCategory,
  UserLocation,
  WorkerProfile,
  AppUser,
  ServiceRequest
} from './types';
import { Header } from './components/Header';
import { LocationBar } from './components/LocationBar';
import { WorkerList } from './components/WorkerList';
import { CategoriesView } from './components/CategoriesView';
import { RegisterWorker } from './components/RegisterWorker';
import { BottomNav } from './components/BottomNav';
import { CallModal } from './components/CallModal';
import { LocationModal } from './components/LocationModal';
import { AuthModal } from './components/AuthModal';
import { ProfileView } from './components/ProfileView';
import { RatingModal } from './components/RatingModal';
import { NotificationToast } from './components/NotificationToast';
import { CityCoord, KNOWN_LOCATIONS } from './utils/geo';
import { subscribeWorkersFromCloud } from './firebase';
import { setupNotifications } from './utils/notifications';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workers');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [callingWorker, setCallingWorker] = useState<WorkerProfile | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Service Request & Rating State
  const [activeServiceRequest, setActiveServiceRequest] = useState<ServiceRequest | null>(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  // Check persistent local user session on mount and initialize notifications
  useEffect(() => {
    setupNotifications().catch(() => {});

    try {
      const stored = localStorage.getItem('quick_karya_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.phone && parsed?.verified) {
          setCurrentUser(parsed);
          return;
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }

    // New user on first startup: open mandatory mobile number & OTP verification
    setIsAuthModalOpen(true);
  }, []);

  // User location state (defaults to Agartala, Tripura as requested benchmark)
  const [userLocation, setUserLocation] = useState<UserLocation>({
    latitude: 23.8315,
    longitude: 91.2868,
    city: 'Agartala',
    state: 'Tripura',
    pincode: '799001',
    isLiveGps: false,
    status: 'idle'
  });

  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  // Fetch workers from full-stack backend
  const fetchWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        params.append('category', selectedCategory);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      if (userLocation.latitude !== null && userLocation.longitude !== null) {
        params.append('lat', userLocation.latitude.toString());
        params.append('lng', userLocation.longitude.toString());
      }

      if (!userLocation.isLiveGps && userLocation.city) {
        params.append('city', userLocation.city);
      }

      const res = await fetch(`/api/workers?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as WorkerProfile[];
        setWorkers(data);
      }
    } catch (err) {
      console.error('Error loading workers:', err);
    } finally {
      setLoadingWorkers(false);
    }
  }, [selectedCategory, searchQuery, userLocation.latitude, userLocation.longitude, userLocation.city, userLocation.isLiveGps]);

  // Request Live Device GPS location
  const requestLiveGps = useCallback(() => {
    if (!navigator.geolocation) {
      setUserLocation((prev) => ({
        ...prev,
        status: 'denied',
        error: 'Geolocation is not supported by your browser'
      }));
      return;
    }

    setUserLocation((prev) => ({ ...prev, status: 'requesting' }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        let detectedCity = 'Current Location';
        let detectedState = '';
        let detectedPincode = '';

        try {
          const revRes = await fetch(
            `/api/reverse-geocode?lat=${latitude}&lng=${longitude}`
          );
          if (revRes.ok) {
            const revData = await revRes.json();
            detectedCity = revData.city || 'Current Area';
            detectedState = revData.state || '';
            detectedPincode = revData.pincode || '';
          }
        } catch (e) {
          console.warn('Reverse geocode error, using coordinates:', e);
        }

        setUserLocation({
          latitude,
          longitude,
          city: detectedCity,
          state: detectedState,
          pincode: detectedPincode,
          accuracyMeters: accuracy,
          isLiveGps: true,
          status: 'granted'
        });
      },
      (err) => {
        console.warn('Live GPS error or permission denied:', err.message);
        setUserLocation((prev) => ({
          ...prev,
          isLiveGps: false,
          status: 'denied',
          error: err.message
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }, []);

  // Fetch device GPS on initial mount
  useEffect(() => {
    requestLiveGps();
  }, [requestLiveGps]);

  // Re-fetch workers when location, category or search query changes
  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  // Subscribe to Cloud Firestore for live real-time synchronization
  useEffect(() => {
    const unsubscribe = subscribeWorkersFromCloud(() => {
      fetchWorkers();
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [fetchWorkers]);

  const handleSelectManualLocation = (loc: CityCoord) => {
    setUserLocation({
      latitude: loc.lat,
      longitude: loc.lng,
      city: loc.city,
      state: loc.state,
      pincode: loc.pincode,
      isLiveGps: false,
      status: 'fallback'
    });
  };

  const handleSearchCustomText = (text: string) => {
    setSearchQuery(text);
  };

  const handleSelectCategoryFromCategories = (cat: ServiceCategory) => {
    setSelectedCategory(cat);
    setActiveTab('workers');
  };

  const handleWorkerRegistered = (newWorker: WorkerProfile) => {
    setWorkers((prev) => [newWorker, ...prev]);
    setSelectedCategory(newWorker.category);
    // Switch to profile tab to show worker card & ID
    setActiveTab('profile');
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
  };

  const handleLogout = () => {
    localStorage.removeItem('quick_karya_user');
    setCurrentUser(null);
  };

  return (
    <div className="min-h-screen bg-emerald-950/5 text-gray-900 flex flex-col items-center">
      {/* Mobile-contained shell for authentic React Native / Expo experience */}
      <div className="w-full max-w-md min-h-screen bg-[#f7faf8] flex flex-col shadow-2xl relative border-x border-emerald-950/10">
        {/* Top Header */}
        <Header
          userLocation={userLocation}
          onOpenLocationModal={() => setIsLocationModalOpen(true)}
          onRefreshGps={requestLiveGps}
          onSelectCategory={handleSelectCategoryFromCategories}
        />

        {/* Main Body content according to Active Tab */}
        <main className="flex-1 px-4 pt-3 pb-20 overflow-y-auto">
          {activeTab === 'workers' && (
            <div className="space-y-3.5">
              {/* Proximity Location & Search bar */}
              <LocationBar
                userLocation={userLocation}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onRequestLiveGps={requestLiveGps}
                onSelectCity={handleSelectManualLocation}
              />

              {/* Workers Listing */}
              <WorkerList
                workers={workers}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onCallNow={(w) => {
                  setCallingWorker(w);
                }}
                onGoToRegister={() => setActiveTab('register')}
                onResetFilters={handleResetFilters}
                isLoading={loadingWorkers}
              />
            </div>
          )}

          {activeTab === 'register' && (
            <RegisterWorker
              userLocation={userLocation}
              onRequestGps={requestLiveGps}
              onWorkerRegistered={handleWorkerRegistered}
              onGoToWorkers={() => setActiveTab('workers')}
            />
          )}

          {activeTab === 'categories' && (
            <CategoriesView
              onSelectCategory={handleSelectCategoryFromCategories}
              workers={workers}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              user={currentUser}
              onLoginClick={() => setIsAuthModalOpen(true)}
              onLogout={handleLogout}
              workers={workers}
              onGoToRegister={() => setActiveTab('register')}
            />
          )}
        </main>

        {/* Bottom Navigation with 4 working tabs: Workers, Register, Categories, My Profile */}
        <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab) => setActiveTab(tab)}
          workersCount={workers.length}
          userName={currentUser?.name}
          isLoggedIn={Boolean(currentUser)}
        />

        {/* Direct Call Dialog Sheet */}
        <CallModal
          worker={callingWorker}
          onClose={() => setCallingWorker(null)}
          userLocation={userLocation}
          currentUser={currentUser}
          onServiceBooked={(req) => {
            setActiveServiceRequest(req);
          }}
        />

        {/* Location Switcher Modal */}
        <LocationModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          currentLocation={userLocation}
          onRequestLiveGps={requestLiveGps}
          onSelectManualLocation={handleSelectManualLocation}
          onSearchCustomText={handleSearchCustomText}
        />

        {/* Mobile SMS OTP Login Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => {
            // Allow close only if user has logged in
            if (currentUser) {
              setIsAuthModalOpen(false);
            }
          }}
          forceLogin={!currentUser}
          onLoginSuccess={(u, role) => {
            setCurrentUser(u);
            setIsAuthModalOpen(false);
            // Profile Separation: Worker -> 'register', Customer -> 'workers'
            if (role === 'worker') {
              setActiveTab('register');
            } else {
              setActiveTab('workers');
            }
          }}
        />

        {/* Rating Modal for Completed Services */}
        <RatingModal
          isOpen={isRatingModalOpen}
          onClose={() => setIsRatingModalOpen(false)}
          serviceRequest={activeServiceRequest}
          onRatingSubmitted={() => {
            fetchWorkers();
          }}
        />

        {/* Global In-App Activity & Local Notification Banner */}
        <NotificationToast />
      </div>
    </div>
  );
}
