import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveTab,
  ServiceCategory,
  UserLocation,
  WorkerProfile
} from './types';
import { Header } from './components/Header';
import { LocationBar } from './components/LocationBar';
import { WorkerList } from './components/WorkerList';
import { CategoriesView } from './components/CategoriesView';
import { RegisterWorker } from './components/RegisterWorker';
import { BottomNav } from './components/BottomNav';
import { CallModal } from './components/CallModal';
import { LocationModal } from './components/LocationModal';
import { CityCoord, KNOWN_LOCATIONS } from './utils/geo';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workers');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [callingWorker, setCallingWorker] = useState<WorkerProfile | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

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

      // If user specifically picked a manual city without live GPS
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

        // Try reverse geocoding via server endpoint
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
        // Fallback gracefully without breaking
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

  // Handle Manual City / Pincode switch
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

  // Handle Custom text search in Location Modal
  const handleSearchCustomText = (text: string) => {
    setSearchQuery(text);
  };

  // Handle Category selection from Categories tab or Highway Emergency banner
  const handleSelectCategoryFromCategories = (cat: ServiceCategory) => {
    setSelectedCategory(cat);
    setActiveTab('workers');
  };

  // Handle newly registered worker
  const handleWorkerRegistered = (newWorker: WorkerProfile) => {
    // Add to list and select their category
    setWorkers((prev) => [newWorker, ...prev]);
    setSelectedCategory(newWorker.category);
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSearchQuery('');
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
        <main className="flex-1 px-4 pt-3 pb-6 overflow-y-auto">
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
                onCallNow={(w) => setCallingWorker(w)}
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
        </main>

        {/* Bottom Navigation with 3 main tabs */}
        <BottomNav
          activeTab={activeTab}
          onChangeTab={(tab) => setActiveTab(tab)}
          workersCount={workers.length}
        />

        {/* Direct Call Dialog Sheet */}
        <CallModal
          worker={callingWorker}
          onClose={() => setCallingWorker(null)}
          userLocation={userLocation}
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
      </div>
    </div>
  );
}
