import React, { useState, useEffect, useCallback } from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Linking,
  Image,
  Alert,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import WebApp from './src/App';
import { CATEGORIES } from './src/data/categories';
import { INDIAN_STATES } from './src/data/indianStates';
import {
  ActiveTab,
  DriverVehicleType,
  PricingType,
  ServiceCategory,
  WorkerProfile
} from './src/types';
import {
  DRIVER_SPECIALIZATION_GROUPS,
  PRICING_TYPE_LABELS,
  formatWorkerPricing,
  isHeavyMachineryDriver,
  isLateNightNow
} from './src/utils/pricing';

const STORAGE_KEY = '@quickkarya_workers_v2';

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
];

const POPULAR_CITIES = [
  'Agartala',
  'Bengaluru',
  'Delhi',
  'Mumbai',
  'Kolkata',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Jaipur',
  'Guwahati'
];

// Helper: Haversine distance in km
function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

function NativeApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workers');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Workers starts empty - no dummy / fake initial data
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);

  // User GPS Coordinates
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  }>({
    latitude: 23.8315,
    longitude: 91.2868
  });
  const [userLocationName, setUserLocationName] = useState('Agartala, Tripura');
  const [gpsLoading, setGpsLoading] = useState(false);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regCategory, setRegCategory] = useState<ServiceCategory>('Plumber');
  const [regExperience, setRegExperience] = useState('4');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('Agartala');
  const [regState, setRegState] = useState('Tripura');
  const [regPincode, setRegPincode] = useState('799001');
  const [regSkills, setRegSkills] = useState('');
  const [regPhoto, setRegPhoto] = useState<string>('');
  const [regVehicleType, setRegVehicleType] = useState<DriverVehicleType>(
    'Private Car Driver (Family, Outstation, Local Trips)'
  );
  const [regPricingTypes, setRegPricingTypes] = useState<PricingType[]>([
    'per_hour',
    'per_day'
  ]);
  const [regRates, setRegRates] = useState<Record<string, string>>({
    per_hour: '350',
    per_day: '850',
    per_month: '22000',
    day_shift: '2500',
    night_shift: '3000',
    fixed_job: '150'
  });
  const [regSuccessWorker, setRegSuccessWorker] = useState<WorkerProfile | null>(null);

  // State & City Selector Modals
  const [isStateModalOpen, setIsStateModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);

  // 1. Load persisted workers from AsyncStorage on mount
  useEffect(() => {
    const loadStoredWorkers = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setWorkers(parsed);
          }
        }
      } catch (err) {
        console.warn('Error reading from AsyncStorage:', err);
      }
    };
    loadStoredWorkers();
  }, []);

  // 2. Request Expo Location for device GPS
  const requestDeviceLocation = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setUserCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });

      // Reverse geocode
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
        if (geo) {
          const c = geo.city || geo.subregion || 'Current Area';
          const s = geo.region || '';
          setUserLocationName(`${c}${s ? ', ' + s : ''}`);
          if (geo.city) setRegCity(geo.city);
          if (geo.region) setRegState(geo.region);
          if (geo.postalCode) setRegPincode(geo.postalCode);
        }
      } catch {
        // Fallback to coordinates
      }
    } catch (err) {
      console.warn('Location retrieval error:', err);
    } finally {
      setGpsLoading(false);
    }
  }, []);

  useEffect(() => {
    requestDeviceLocation();
  }, [requestDeviceLocation]);

  // 3. Expo Image Picker: Library & Camera
  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission Required',
          'Camera roll access is needed to upload a profile photo.'
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setRegPhoto(res.assets[0].uri);
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission Required',
          'Camera access is needed to capture a profile photo.'
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setRegPhoto(res.assets[0].uri);
      }
    } catch (err) {
      console.warn('Camera capture error:', err);
    }
  };

  // Direct Phone Call handler using Expo Linking
  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch((err) => {
      console.warn('Could not trigger call:', err);
      Alert.alert('Phone Call Error', `Could not initiate call to ${cleanPhone}`);
    });
  };

  // Dynamic distance calculation for all workers based on user coords
  const workersWithDistance = workers.map((w) => {
    const distanceKm = calculateDistanceKm(
      userCoords.latitude,
      userCoords.longitude,
      w.latitude || 23.8315,
      w.longitude || 91.2868
    );
    return {
      ...w,
      distanceKm
    };
  });

  // Filter workers by category and search keyword
  const filteredWorkers = workersWithDistance.filter((w) => {
    const matchesCategory =
      selectedCategory === 'All' || w.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.skills &&
        w.skills.some((s) =>
          s.toLowerCase().includes(searchQuery.toLowerCase())
        ));
    return matchesCategory && matchesSearch;
  });

  // Pricing type toggle
  const togglePricingType = (pt: PricingType) => {
    if (regPricingTypes.includes(pt)) {
      if (regPricingTypes.length > 1) {
        setRegPricingTypes(regPricingTypes.filter((t) => t !== pt));
      }
    } else {
      setRegPricingTypes([...regPricingTypes, pt]);
    }
  };

  // Submit registration: persist to AsyncStorage & update local state
  const handleRegisterSubmit = async () => {
    if (!regName.trim()) {
      Alert.alert('Required Field', 'Please enter your full name or artisan team name.');
      return;
    }
    const cleanPhone = regPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile phone number.');
      return;
    }
    const expNum = parseInt(regExperience, 10) || 1;
    const primaryType = regPricingTypes[0] || 'per_hour';
    const primaryRate = parseInt(regRates[primaryType] || '350', 10);

    const formattedPhone = cleanPhone.startsWith('91')
      ? `+${cleanPhone}`
      : `+91 ${cleanPhone.slice(-10, -5)} ${cleanPhone.slice(-5)}`;

    const pricingRates: Partial<Record<PricingType, number>> = {};
    regPricingTypes.forEach((pt) => {
      pricingRates[pt] = parseInt(regRates[pt] || '0', 10);
    });

    const rateOptions = regPricingTypes.map((pt) => {
      const amt = parseInt(regRates[pt] || '0', 10);
      const label =
        pt === 'per_hour'
          ? 'Hourly'
          : pt === 'per_day'
          ? 'Full Day'
          : pt === 'per_month'
          ? 'Monthly'
          : pt === 'day_shift'
          ? 'Day Shift'
          : pt === 'night_shift'
          ? 'Night Shift'
          : 'Inspection';
      const unit =
        pt === 'per_month'
          ? '/month'
          : pt === 'per_day' || pt === 'day_shift'
          ? '/day'
          : pt === 'night_shift'
          ? '/night'
          : pt === 'fixed_job'
          ? '/job'
          : '/hr';
      return {
        pricingType: pt,
        amount: amt,
        unit,
        label
      };
    });

    const newWorker: WorkerProfile = {
      id: `w-local-${Date.now()}`,
      name: regName.trim(),
      category: regCategory,
      experience: expNum,
      rating: 5.0,
      reviewCount: 1,
      hourlyRate: parseInt(regRates['per_hour'] || `${primaryRate}`, 10),
      rate: primaryRate,
      pricingType: primaryType,
      rateUnit:
        primaryType === 'per_month'
          ? '/month'
          : primaryType === 'per_day' || primaryType === 'day_shift'
          ? '/day'
          : primaryType === 'night_shift'
          ? '/night'
          : primaryType === 'fixed_job'
          ? '/job'
          : '/hr',
      pricingRates,
      rateOptions,
      vehicleType: regCategory === 'Driver' ? regVehicleType : undefined,
      phone: formattedPhone,
      city: regCity.trim() || 'Agartala',
      state: regState.trim() || 'Tripura',
      pincode: regPincode.trim() || '799001',
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
      verified: true,
      available: true,
      completedJobs: 1,
      languages: ['Bengali', 'Hindi', 'English'],
      skills: regSkills.trim()
        ? regSkills.split(',').map((s) => s.trim())
        : [
            regCategory === 'Driver'
              ? `${regVehicleType}`
              : `${regCategory} professional`
          ],
      photo: regPhoto || undefined,
      emergencyAvailable: regCategory === 'Emergency Highway Assistance'
    };

    const updated = [newWorker, ...workers];
    setWorkers(updated);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed saving to AsyncStorage:', e);
    }

    setRegSuccessWorker(newWorker);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064e3b" />

      {/* TOP EMERGENCY HIGHWAY SOS BAR */}
      <View style={styles.topEmergencyStrip}>
        <View style={styles.dotRow}>
          <View style={styles.greenDot} />
          <Text style={styles.topStripText}>Verified Local Artisans</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setSelectedCategory('Emergency Highway Assistance');
            setActiveTab('workers');
          }}
          style={styles.sosButton}
        >
          <Text style={styles.sosText}>⚠️ Highway SOS (24/7)</Text>
        </TouchableOpacity>
      </View>

      {/* HEADER WITH BRAND & GPS LOCATION */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>QK</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>Quick Karya</Text>
            <Text style={styles.brandSubtitle}>PROXIMITY ARTISAN NETWORK</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.locationPill}
          onPress={requestDeviceLocation}
        >
          <Text style={styles.locationPillText}>
            {gpsLoading ? '📍 Locating...' : `📍 ${userLocationName}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* BODY CONTENT BY ACTIVE TAB */}

      {/* TAB 1: WORKERS (HOME) */}
      {activeTab === 'workers' && (
        <View style={styles.bodyFlex}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search artisan, skill, area, or rate..."
              placeholderTextColor="#6ee7b7"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Category Filter Pills */}
          <View style={styles.categoryContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              <TouchableOpacity
                style={[
                  styles.categoryPill,
                  selectedCategory === 'All' && styles.categoryPillActive
                ]}
                onPress={() => setSelectedCategory('All')}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    selectedCategory === 'All' && styles.categoryPillTextActive
                  ]}
                >
                  All Trades ({workers.length})
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => {
                const count = workers.filter((w) => w.category === cat.name).length;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryPill,
                      selectedCategory === cat.name && styles.categoryPillActive
                    ]}
                    onPress={() => setSelectedCategory(cat.name)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        selectedCategory === cat.name && styles.categoryPillTextActive
                      ]}
                    >
                      {cat.name} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* WORKERS LIST / MATCHING CARDS */}
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
          >
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {selectedCategory === 'All'
                  ? `Nearby Available Artisans (${filteredWorkers.length})`
                  : `${selectedCategory} (${filteredWorkers.length})`}
              </Text>
              {selectedCategory !== 'All' && (
                <TouchableOpacity onPress={() => setSelectedCategory('All')}>
                  <Text style={styles.resetFilterText}>Reset to All</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* EMPTY STATE WHEN NO WORKERS REGISTERED */}
            {filteredWorkers.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIconText}>👥</Text>
                </View>
                <Text style={styles.emptyTitle}>
                  {workers.length === 0
                    ? 'No Registered Workers Yet'
                    : 'No Matching Artisans'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {workers.length === 0
                    ? 'The directory currently has no registered workers. Be the first artisan to onboard or register a profile with custom service rates!'
                    : 'No service providers found matching your current filter. Try resetting the category or search keyword.'}
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => {
                    if (workers.length === 0) {
                      setActiveTab('register');
                    } else {
                      setSelectedCategory('All');
                      setSearchQuery('');
                    }
                  }}
                >
                  <Text style={styles.emptyButtonText}>
                    {workers.length === 0
                      ? '➕ Register as First Artisan'
                      : 'Show All Artisans'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* EXACT WORKER CARD UI MATCHING THE PREVIEW */
              filteredWorkers.map((worker) => {
                const isEmergency =
                  worker.category === 'Emergency Highway Assistance';
                const pricing = formatWorkerPricing(worker);
                const isNight = isLateNightNow() && pricing.hasNightRate;
                const initials = worker.name
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'WK';

                return (
                  <View
                    key={worker.id}
                    style={[
                      styles.workerCard,
                      isEmergency && styles.workerCardEmergency
                    ]}
                  >
                    {/* Top Banner for Emergency Highway Assistance */}
                    {isEmergency && (
                      <View style={styles.cardEmergencyTopBanner}>
                        <Text style={styles.cardEmergencyBannerText}>
                          ⚡ 24/7 RAPID HIGHWAY RESPONSE
                        </Text>
                        <View style={styles.cardEmergencyOnCallBadge}>
                          <Text style={styles.cardEmergencyOnCallText}>
                            ON CALL
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Night rate banner if active */}
                    {isNight && !isEmergency && (
                      <View style={styles.cardNightTopBanner}>
                        <Text style={styles.cardNightBannerText}>
                          🌙 LATE NIGHT RATES ACTIVE (8 PM - 6 AM)
                        </Text>
                        <Text style={styles.cardNightRateText}>
                          {pricing.displayNightRate}
                        </Text>
                      </View>
                    )}

                    <View style={styles.cardBody}>
                      {/* Header Row: Avatar, Name, Category, Verified */}
                      <View style={styles.cardHeaderRow}>
                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                          {worker.photo ? (
                            <Image
                              source={{ uri: worker.photo }}
                              style={styles.avatarImg}
                            />
                          ) : (
                            <View style={styles.avatarInitialBox}>
                              <Text style={styles.avatarInitialText}>
                                {initials}
                              </Text>
                            </View>
                          )}
                          {worker.available && (
                            <View style={styles.avatarOnlineDot} />
                          )}
                        </View>

                        {/* Details */}
                        <View style={styles.cardDetailsCol}>
                          <View style={styles.cardNameRow}>
                            <Text style={styles.cardWorkerName} numberOfLines={1}>
                              {worker.name}
                            </Text>
                            {worker.verified && (
                              <View style={styles.cardVerifiedBadge}>
                                <Text style={styles.cardVerifiedBadgeText}>
                                  ✓ Verified
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Profession, Driver Vehicle & Experience */}
                          <View style={styles.cardSubDetailsRow}>
                            <Text style={styles.cardCategoryText}>
                              {worker.category}
                            </Text>
                            {worker.vehicleType && (
                              <>
                                <Text style={styles.cardDot}>•</Text>
                                <View style={styles.cardVehiclePill}>
                                  <Text style={styles.cardVehiclePillText}>
                                    🚗 {worker.vehicleType.split('(')[0].trim()}
                                  </Text>
                                </View>
                              </>
                            )}
                            <Text style={styles.cardDot}>•</Text>
                            <Text style={styles.cardExpText}>
                              💼 {worker.experience} yrs exp
                            </Text>
                          </View>

                          {/* Location & Live GPS Distance Badge */}
                          <View style={styles.cardLocationRow}>
                            <Text style={styles.cardLocationText}>
                              📍 {worker.city}
                              {worker.state ? `, ${worker.state}` : ''}
                              {worker.pincode ? ` (${worker.pincode})` : ''}
                            </Text>
                            {worker.distanceKm !== undefined && (
                              <View style={styles.distanceBadge}>
                                <Text style={styles.distanceBadgeText}>
                                  {worker.distanceKm} km away
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Middle Stats Row: Rating stars & Availability */}
                      <View style={styles.cardStatsRow}>
                        <View style={styles.cardRatingBadge}>
                          <Text style={styles.cardRatingText}>
                            ⭐ {(worker.rating || 5.0).toFixed(1)}
                          </Text>
                          <Text style={styles.cardReviewCountText}>
                            ({worker.reviewCount || 1} reviews)
                          </Text>
                        </View>

                        <View style={styles.cardAvailabilityBadge}>
                          <View style={styles.availableDotSmall} />
                          <Text style={styles.cardAvailabilityText}>
                            Available Now
                          </Text>
                        </View>
                      </View>

                      {/* Multi-Tier Rate Display Section */}
                      <View style={styles.cardRatesContainer}>
                        <View style={styles.cardRatesHeaderLine}>
                          <Text style={styles.cardRatesTitle}>RATES:</Text>
                          <Text style={styles.cardRatesSummaryText}>
                            {pricing.allRatesFormatted}
                          </Text>
                        </View>

                        {/* Distinct rate badge pills */}
                        {pricing.hasMultipleRates && (
                          <View style={styles.ratePillsRow}>
                            {pricing.allRates.map((r, idx) => (
                              <View key={idx} style={styles.ratePillBadge}>
                                <Text style={styles.ratePillLabel}>
                                  {r.label}:
                                </Text>
                                <Text style={styles.ratePillAmount}>
                                  {' '}{r.displayRate}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Skills Tags */}
                      {worker.skills && worker.skills.length > 0 && (
                        <View style={styles.skillsRow}>
                          {worker.skills.slice(0, 3).map((skill, i) => (
                            <View key={i} style={styles.skillTag}>
                              <Text style={styles.skillTagText}>{skill}</Text>
                            </View>
                          ))}
                          {worker.skills.length > 3 && (
                            <View style={styles.skillTagMore}>
                              <Text style={styles.skillTagMoreText}>
                                +{worker.skills.length - 3} more
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Prominent Dark Green Call Now Button */}
                      <TouchableOpacity
                        style={[
                          styles.callNowButton,
                          isEmergency && styles.callNowButtonEmergency
                        ]}
                        onPress={() => handleCall(worker.phone)}
                      >
                        <Text style={styles.callNowButtonIcon}>📞</Text>
                        <Text style={styles.callNowButtonText}>
                          Call Now ({pricing.displayRate})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* TAB 2: CATEGORIES VIEW */}
      {activeTab === 'categories' && (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
        >
          {/* Category Header Banner */}
          <View style={styles.categoriesBanner}>
            <Text style={styles.categoriesBannerTitle}>Service Categories</Text>
            <Text style={styles.categoriesBannerSubtitle}>
              Browse verified local trades & artisans with direct phone contacts
            </Text>
          </View>

          {/* 24/7 Priority Emergency Highway Assistance Card */}
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyCardHeader}>
              <View style={styles.emergencyBadge}>
                <Text style={styles.emergencyBadgeText}>24/7 PRIORITY SOS</Text>
              </View>
              <Text style={styles.emergencyStatusText}>Immediate Response</Text>
            </View>

            <Text style={styles.emergencyTitle}>
              Emergency Highway Assistance
            </Text>
            <Text style={styles.emergencyHindiTitle}>
              आपातकालीन हाईवे सहायता
            </Text>
            <Text style={styles.emergencyDescription}>
              On-spot highway rescue: flat tyre repair, jump start, fuel delivery, towing support & winching.
            </Text>

            <View style={styles.emergencyFooter}>
              <Text style={styles.emergencyTeamCount}>
                ⚡ {workers.filter((w) => w.category === 'Emergency Highway Assistance').length} rescue teams active
              </Text>
              <TouchableOpacity
                style={styles.emergencyActionBtn}
                onPress={() => {
                  setSelectedCategory('Emergency Highway Assistance');
                  setActiveTab('workers');
                }}
              >
                <Text style={styles.emergencyActionBtnText}>
                  View Rescue Teams →
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Regular Categories Grid */}
          <Text style={styles.categoriesSectionLabel}>
            ALL TRADES & SERVICES ({CATEGORIES.length})
          </Text>

          {CATEGORIES.filter(
            (c) => c.name !== 'Emergency Highway Assistance'
          ).map((cat) => {
            const count = workers.filter((w) => w.category === cat.name).length;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryCard}
                onPress={() => {
                  setSelectedCategory(cat.name);
                  setActiveTab('workers');
                }}
              >
                <View style={styles.categoryCardTop}>
                  <View style={styles.categoryIconSquare}>
                    <Text style={styles.categoryIconEmoji}>
                      {cat.name === 'Plumber'
                        ? '🔧'
                        : cat.name === 'Electrician'
                        ? '⚡'
                        : cat.name === 'Carpenter'
                        ? '🔨'
                        : cat.name === 'Cook'
                        ? '🍳'
                        : cat.name === 'Painter'
                        ? '🎨'
                        : cat.name === 'Driver'
                        ? '🚗'
                        : cat.name === 'Rajmistri / Mason'
                        ? '🧱'
                        : cat.name === 'Labour / Helper'
                        ? '👷'
                        : cat.name === 'Welder'
                        ? '🔥'
                        : cat.name === 'Pest Control'
                        ? '🐜'
                        : '🛠️'}
                    </Text>
                  </View>
                  <View style={styles.categoryCardInfo}>
                    <Text style={styles.categoryCardName}>{cat.name}</Text>
                    <Text style={styles.categoryCardHindi}>{cat.hindiName}</Text>
                  </View>
                  <View style={styles.categoryCountBadge}>
                    <Text style={styles.categoryCountBadgeText}>
                      {count} available
                    </Text>
                  </View>
                </View>

                <Text style={styles.categoryCardDesc} numberOfLines={2}>
                  {cat.description}
                </Text>

                <View style={styles.categoryCardBottom}>
                  <Text style={styles.categoryAvgRate}>Avg: {cat.avgRate}</Text>
                  <Text style={styles.categoryCardAction}>
                    View Artisans →
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* TAB 3: WORKER ONBOARDING / REGISTRATION */}
      {activeTab === 'register' && (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
        >
          {regSuccessWorker ? (
            /* SUCCESS CONFIRMATION CARD */
            <View style={styles.successCard}>
              <View style={styles.successIconBadge}>
                <Text style={styles.successIconEmoji}>🎉</Text>
              </View>
              <Text style={styles.successTitle}>Welcome to Quick Karya!</Text>
              <Text style={styles.successSubtitle}>
                Your profile for <Text style={styles.boldText}>{regSuccessWorker.name}</Text> has been saved locally and published to the live directory!
              </Text>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Category: </Text>
                  {regSuccessWorker.category}
                </Text>
                {regSuccessWorker.vehicleType && (
                  <Text style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>Vehicle: </Text>
                    {regSuccessWorker.vehicleType.split('(')[0].trim()}
                  </Text>
                )}
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Service Rate: </Text>₹
                  {regSuccessWorker.rate}
                  {regSuccessWorker.rateUnit}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Direct Phone: </Text>
                  {regSuccessWorker.phone}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Location: </Text>
                  {regSuccessWorker.city}, {regSuccessWorker.state} (
                  {regSuccessWorker.pincode})
                </Text>
              </View>

              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={() => {
                  setSelectedCategory(regSuccessWorker.category);
                  setRegSuccessWorker(null);
                  setActiveTab('workers');
                }}
              >
                <Text style={styles.primaryActionButtonText}>
                  View Your Profile in Workers Tab →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => {
                  setRegSuccessWorker(null);
                  setRegName('');
                  setRegPhone('');
                  setRegSkills('');
                  setRegPhoto('');
                }}
              >
                <Text style={styles.secondaryActionButtonText}>
                  Register Another Artisan
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ONBOARDING FORM */
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formHeaderTitle}>Worker Onboarding</Text>
                <Text style={styles.formHeaderSubtitle}>
                  Join the proximity artisan network with flexible hourly, daily, or monthly rates.
                </Text>
              </View>

              {/* Photo Upload: Expo Image Picker & Camera */}
              <Text style={styles.inputLabel}>Profile Avatar Photo</Text>
              {regPhoto ? (
                <View style={styles.photoPreviewRow}>
                  <Image source={{ uri: regPhoto }} style={styles.photoPreviewImg} />
                  <View style={styles.photoPreviewActions}>
                    <Text style={styles.photoAttachedText}>✓ Photo Selected</Text>
                    <View style={styles.photoButtonRow}>
                      <TouchableOpacity
                        style={styles.photoActionButton}
                        onPress={handlePickFromGallery}
                      >
                        <Text style={styles.photoActionButtonText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.photoActionRemove}
                        onPress={() => setRegPhoto('')}
                      >
                        <Text style={styles.photoActionRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPickerBox}>
                  <View style={styles.pickerButtonsRow}>
                    <TouchableOpacity
                      style={styles.pickerBtn}
                      onPress={handlePickFromGallery}
                    >
                      <Text style={styles.pickerBtnText}>🖼️ Choose Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pickerBtn}
                      onPress={handleTakePhoto}
                    >
                      <Text style={styles.pickerBtnText}>📷 Open Camera</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.sampleAvatarLabel}>Or select instant sample:</Text>
                  <View style={styles.sampleAvatarsRow}>
                    {SAMPLE_AVATARS.map((url, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setRegPhoto(url)}
                        style={styles.sampleAvatarThumbBtn}
                      >
                        <Image source={{ uri: url }} style={styles.sampleAvatarThumb} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name or Team Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Rajesh Sharma"
                placeholderTextColor="#9ca3af"
                value={regName}
                onChangeText={setRegName}
              />

              {/* Service Category */}
              <Text style={styles.inputLabel}>Service Category *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryChipScroll}
              >
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setRegCategory(c.name)}
                    style={[
                      styles.categoryChip,
                      regCategory === c.name && styles.categoryChipActive
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        regCategory === c.name && styles.categoryChipTextActive
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Driver Specialization if Driver */}
              {regCategory === 'Driver' && (
                <View style={styles.driverSection}>
                  <Text style={styles.inputLabel}>
                    Driver Vehicle Specialization *
                  </Text>
                  {DRIVER_SPECIALIZATION_GROUPS.map((grp) => (
                    <View key={grp.key} style={styles.specGroup}>
                      <Text style={styles.specGroupTitle}>{grp.name}</Text>
                      {grp.options.map((opt) => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.specOptionPill,
                            regVehicleType === opt.id &&
                              styles.specOptionPillActive
                          ]}
                          onPress={() => setRegVehicleType(opt.id)}
                        >
                          <Text
                            style={[
                              styles.specOptionText,
                              regVehicleType === opt.id &&
                                styles.specOptionTextActive
                            ]}
                          >
                            {opt.title} ({opt.subtitle})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {/* Experience */}
              <Text style={styles.inputLabel}>Experience (Years) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 5"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={regExperience}
                onChangeText={setRegExperience}
              />

              {/* Multi-Tier Pricing Structure */}
              <Text style={styles.inputLabel}>
                Pricing Structure & Rate Options *
              </Text>
              <View style={styles.pricingTabsRow}>
                {(['per_hour', 'per_day', 'per_month', 'fixed_job'] as PricingType[]).map(
                  (pt) => (
                    <TouchableOpacity
                      key={pt}
                      onPress={() => togglePricingType(pt)}
                      style={[
                        styles.pricingTabPill,
                        regPricingTypes.includes(pt) &&
                          styles.pricingTabPillActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.pricingTabText,
                          regPricingTypes.includes(pt) &&
                            styles.pricingTabTextActive
                        ]}
                      >
                        {pt === 'per_hour'
                          ? 'Per Hour'
                          : pt === 'per_day'
                          ? 'Per Day'
                          : pt === 'per_month'
                          ? 'Monthly'
                          : 'Inspection / Fixed'}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              {/* Rate Inputs */}
              {regPricingTypes.includes('per_hour') && (
                <View style={styles.rateRow}>
                  <Text style={styles.rateFieldLabel}>Rate Per Hour (₹/hr):</Text>
                  <TextInput
                    style={styles.rateFieldInput}
                    keyboardType="numeric"
                    value={regRates['per_hour']}
                    onChangeText={(val) =>
                      setRegRates({ ...regRates, per_hour: val })
                    }
                  />
                </View>
              )}

              {regPricingTypes.includes('per_day') && (
                <View style={styles.rateRow}>
                  <Text style={styles.rateFieldLabel}>
                    Rate Per Day / Allowance (₹/day):
                  </Text>
                  <TextInput
                    style={styles.rateFieldInput}
                    keyboardType="numeric"
                    value={regRates['per_day']}
                    onChangeText={(val) =>
                      setRegRates({ ...regRates, per_day: val })
                    }
                  />
                </View>
              )}

              {regPricingTypes.includes('per_month') && (
                <View style={styles.rateRow}>
                  <Text style={styles.rateFieldLabel}>
                    Monthly Salary (₹/month):
                  </Text>
                  <TextInput
                    style={styles.rateFieldInput}
                    keyboardType="numeric"
                    value={regRates['per_month']}
                    onChangeText={(val) =>
                      setRegRates({ ...regRates, per_month: val })
                    }
                  />
                </View>
              )}

              {regPricingTypes.includes('fixed_job') && (
                <View style={styles.rateRow}>
                  <Text style={styles.rateFieldLabel}>
                    Visiting / Inspection Fee (₹):
                  </Text>
                  <TextInput
                    style={styles.rateFieldInput}
                    keyboardType="numeric"
                    value={regRates['fixed_job']}
                    onChangeText={(val) =>
                      setRegRates({ ...regRates, fixed_job: val })
                    }
                  />
                </View>
              )}

              {/* Mobile Phone Number */}
              <Text style={styles.inputLabel}>Mobile Phone Number *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="10-digit mobile (e.g. 9862154321)"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={regPhone}
                onChangeText={setRegPhone}
              />

              {/* State and City Dropdowns */}
              <View style={styles.twoColumnRow}>
                {/* State Dropdown Trigger */}
                <View style={styles.columnHalf}>
                  <Text style={styles.inputLabel}>State *</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setIsStateModalOpen(true)}
                  >
                    <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                      {regState} ▼
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* City Dropdown Trigger */}
                <View style={styles.columnHalf}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setIsCityModalOpen(true)}
                  >
                    <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                      {regCity} ▼
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Pincode */}
              <Text style={styles.inputLabel}>Pincode *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={regPincode}
                onChangeText={setRegPincode}
              />

              {/* Skills */}
              <Text style={styles.inputLabel}>
                Specializations & Skills (Comma separated)
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Pipe fittings, Motor repair, Leakage fix"
                placeholderTextColor="#9ca3af"
                value={regSkills}
                onChangeText={setRegSkills}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleRegisterSubmit}
              >
                <Text style={styles.submitButtonText}>
                  ✓ Register & Save Profile
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STATE PICKER MODAL */}
          <Modal
            visible={isStateModalOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsStateModalOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select State</Text>
                  <TouchableOpacity onPress={() => setIsStateModalOpen(false)}>
                    <Text style={styles.modalCloseText}>✕ Close</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalList}>
                  {INDIAN_STATES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.modalListItem,
                        regState === s && styles.modalListItemActive
                      ]}
                      onPress={() => {
                        setRegState(s);
                        setIsStateModalOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalListItemText,
                          regState === s && styles.modalListItemTextActive
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* CITY PICKER MODAL */}
          <Modal
            visible={isCityModalOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsCityModalOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select City</Text>
                  <TouchableOpacity onPress={() => setIsCityModalOpen(false)}>
                    <Text style={styles.modalCloseText}>✕ Close</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalList}>
                  {POPULAR_CITIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.modalListItem,
                        regCity === c && styles.modalListItemActive
                      ]}
                      onPress={() => {
                        setRegCity(c);
                        setIsCityModalOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalListItemText,
                          regCity === c && styles.modalListItemTextActive
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </ScrollView>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNavContainer}>
        {/* Tab 1: Workers (Home) */}
        <TouchableOpacity
          style={styles.navTabButton}
          onPress={() => setActiveTab('workers')}
        >
          <View style={styles.navIconWrapper}>
            <Text
              style={[
                styles.navEmoji,
                activeTab === 'workers' && styles.navEmojiActive
              ]}
            >
              👥
            </Text>
            {workers.length > 0 && (
              <View style={styles.navCountBadge}>
                <Text style={styles.navCountBadgeText}>{workers.length}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'workers' && styles.navTabLabelActive
            ]}
          >
            Workers
          </Text>
          {activeTab === 'workers' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>

        {/* Tab 2: Register (Worker Onboarding) */}
        <TouchableOpacity
          style={styles.navTabButton}
          onPress={() => setActiveTab('register')}
        >
          <View
            style={[
              styles.navCenterBadge,
              activeTab === 'register' && styles.navCenterBadgeActive
            ]}
          >
            <Text style={styles.navCenterBadgeText}>➕</Text>
          </View>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'register' && styles.navTabLabelActive
            ]}
          >
            Register
          </Text>
          {activeTab === 'register' && (
            <View style={styles.navActiveIndicator} />
          )}
        </TouchableOpacity>

        {/* Tab 3: Categories */}
        <TouchableOpacity
          style={styles.navTabButton}
          onPress={() => setActiveTab('categories')}
        >
          <View style={styles.navIconWrapper}>
            <Text
              style={[
                styles.navEmoji,
                activeTab === 'categories' && styles.navEmojiActive
              ]}
            >
              ⊞
            </Text>
          </View>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'categories' && styles.navTabLabelActive
            ]}
          >
            Categories
          </Text>
          {activeTab === 'categories' && (
            <View style={styles.navActiveIndicator} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  if (Platform.OS === 'web') {
    return <WebApp />;
  }
  return <NativeApp />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064e3b'
  },
  bodyFlex: {
    flex: 1
  },
  topEmergencyStrip: {
    backgroundColor: '#022c22',
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(5, 150, 105, 0.3)'
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
    marginRight: 6
  },
  topStripText: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: '500'
  },
  sosButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)'
  },
  sosText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: 'bold'
  },
  header: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#047857'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#34d399'
  },
  logoBadgeText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 17
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  brandSubtitle: {
    color: '#6ee7b7',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  locationPill: {
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#059669'
  },
  locationPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#065f46'
  },
  searchInput: {
    backgroundColor: '#064e3b',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#047857'
  },
  categoryContainer: {
    backgroundColor: '#065f46',
    paddingBottom: 10
  },
  categoryScroll: {
    paddingHorizontal: 16
  },
  categoryPill: {
    backgroundColor: '#047857',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  categoryPillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff'
  },
  categoryPillText: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: '600'
  },
  categoryPillTextActive: {
    color: '#064e3b',
    fontWeight: '800'
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6'
  },
  listContent: {
    padding: 14,
    paddingBottom: 90
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  resetFilterText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700'
  },

  /* EMPTY STATE */
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  emptyIconText: {
    fontSize: 28
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16
  },
  emptyButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13
  },

  /* EXACT WORKER CARD STYLES */
  workerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(6, 78, 59, 0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2.5
  },
  workerCardEmergency: {
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    backgroundColor: '#fffdfa'
  },
  cardEmergencyTopBanner: {
    backgroundColor: '#d97706',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  cardEmergencyBannerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5
  },
  cardEmergencyOnCallBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  cardEmergencyOnCallText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold'
  },
  cardNightTopBanner: {
    backgroundColor: '#581c87',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  cardNightBannerText: {
    color: '#e9d5ff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  cardNightRateText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  cardBody: {
    padding: 14,
    gap: 10
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  avatarContainer: {
    position: 'relative'
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#e5e7eb'
  },
  avatarInitialBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#064e3b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#047857'
  },
  avatarInitialText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  avatarOnlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  cardDetailsCol: {
    flex: 1
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  cardWorkerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    flexShrink: 1
  },
  cardVerifiedBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10
  },
  cardVerifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857'
  },
  cardSubDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2
  },
  cardCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857'
  },
  cardDot: {
    color: '#9ca3af',
    fontSize: 11
  },
  cardVehiclePill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6
  },
  cardVehiclePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#064e3b'
  },
  cardExpText: {
    fontSize: 11,
    color: '#4b5563'
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3
  },
  cardLocationText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '500'
  },
  distanceBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#a7f3d0'
  },
  distanceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#064e3b'
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6'
  },
  cardRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4
  },
  cardRatingText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e'
  },
  cardReviewCountText: {
    fontSize: 10,
    color: '#b45309'
  },
  cardAvailabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  availableDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981'
  },
  cardAvailabilityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#064e3b'
  },
  cardRatesContainer: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    padding: 10,
    gap: 6
  },
  cardRatesHeaderLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  cardRatesTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#064e3b',
    letterSpacing: 0.5
  },
  cardRatesSummaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#064e3b'
  },
  ratePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(5, 150, 105, 0.2)'
  },
  ratePillBadge: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center'
  },
  ratePillLabel: {
    fontSize: 10,
    color: '#6b7280'
  },
  ratePillAmount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#064e3b'
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  skillTag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  skillTagText: {
    fontSize: 10,
    color: '#4b5563'
  },
  skillTagMore: {
    paddingHorizontal: 4,
    paddingVertical: 3
  },
  skillTagMoreText: {
    fontSize: 10,
    color: '#9ca3af'
  },
  callNowButton: {
    backgroundColor: '#064e3b',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  callNowButtonEmergency: {
    backgroundColor: '#b45309'
  },
  callNowButtonIcon: {
    fontSize: 14
  },
  callNowButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },

  /* CATEGORIES VIEW STYLES */
  categoriesBanner: {
    backgroundColor: '#064e3b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14
  },
  categoriesBannerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold'
  },
  categoriesBannerSubtitle: {
    color: '#a7f3d0',
    fontSize: 12,
    marginTop: 4
  },
  emergencyCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f59e0b',
    marginBottom: 16
  },
  emergencyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  emergencyBadge: {
    backgroundColor: '#d97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  emergencyBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  emergencyStatusText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600'
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350f'
  },
  emergencyHindiTitle: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '600',
    marginBottom: 6
  },
  emergencyDescription: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
    marginBottom: 12
  },
  emergencyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
    paddingTop: 10
  },
  emergencyTeamCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350f'
  },
  emergencyActionBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  emergencyActionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 11
  },
  categoriesSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 10,
    letterSpacing: 0.5
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  categoryCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  categoryIconSquare: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  categoryIconEmoji: {
    fontSize: 20
  },
  categoryCardInfo: {
    flex: 1
  },
  categoryCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  categoryCardHindi: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500'
  },
  categoryCountBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  categoryCountBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600'
  },
  categoryCardDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 17,
    marginBottom: 10
  },
  categoryCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8
  },
  categoryAvgRate: {
    fontSize: 11,
    color: '#6b7280'
  },
  categoryCardAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669'
  },

  /* REGISTRATION & ONBOARDING STYLES */
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  formHeader: {
    backgroundColor: '#064e3b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  formHeaderTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold'
  },
  formHeaderSubtitle: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 4
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  photoPreviewImg: {
    width: 60,
    height: 60,
    borderRadius: 14
  },
  photoPreviewActions: {
    flex: 1
  },
  photoAttachedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#064e3b'
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6
  },
  photoActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  photoActionButtonText: {
    fontSize: 11,
    color: '#064e3b',
    fontWeight: 'bold'
  },
  photoActionRemove: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  photoActionRemoveText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '600'
  },
  photoPickerBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    padding: 12,
    alignItems: 'center',
    gap: 8
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%'
  },
  pickerBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  pickerBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#064e3b'
  },
  sampleAvatarLabel: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4
  },
  sampleAvatarsRow: {
    flexDirection: 'row',
    gap: 10
  },
  sampleAvatarThumbBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db'
  },
  sampleAvatarThumb: {
    width: '100%',
    height: '100%'
  },
  formInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#111827'
  },
  categoryChipScroll: {
    flexDirection: 'row',
    marginBottom: 6
  },
  categoryChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  categoryChipActive: {
    backgroundColor: '#059669',
    borderColor: '#047857'
  },
  categoryChipText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '600'
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold'
  },
  driverSection: {
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  specGroup: {
    marginTop: 6
  },
  specGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#064e3b',
    marginBottom: 4
  },
  specOptionPill: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#d1d5db'
  },
  specOptionPillActive: {
    backgroundColor: '#064e3b',
    borderColor: '#064e3b'
  },
  specOptionText: {
    fontSize: 11,
    color: '#374151'
  },
  specOptionTextActive: {
    color: '#ffffff',
    fontWeight: 'bold'
  },
  pricingTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8
  },
  pricingTabPill: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db'
  },
  pricingTabPillActive: {
    backgroundColor: '#064e3b',
    borderColor: '#064e3b'
  },
  pricingTabText: {
    fontSize: 11,
    color: '#374151'
  },
  pricingTabTextActive: {
    color: '#ffffff',
    fontWeight: 'bold'
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  rateFieldLabel: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '600'
  },
  rateFieldInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: 'bold',
    width: 90,
    textAlign: 'right'
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10
  },
  columnHalf: {
    flex: 1
  },
  dropdownTrigger: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center'
  },
  dropdownTriggerText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600'
  },
  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold'
  },

  /* MODALS */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: 16
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827'
  },
  modalCloseText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: 'bold'
  },
  modalList: {
    paddingVertical: 8
  },
  modalListItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  modalListItemActive: {
    backgroundColor: '#ecfdf5'
  },
  modalListItemText: {
    fontSize: 14,
    color: '#374151'
  },
  modalListItemTextActive: {
    color: '#064e3b',
    fontWeight: 'bold'
  },

  /* SUCCESS CARD */
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0'
  },
  successIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  successIconEmoji: {
    fontSize: 32
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#064e3b',
    marginBottom: 6
  },
  successSubtitle: {
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16
  },
  boldText: {
    fontWeight: 'bold',
    color: '#111827'
  },
  summaryBox: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  summaryLine: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4
  },
  summaryLabel: {
    fontWeight: '700',
    color: '#111827'
  },
  primaryActionButton: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10
  },
  primaryActionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  secondaryActionButton: {
    paddingVertical: 8
  },
  secondaryActionButtonText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600'
  },

  /* BOTTOM NAVIGATION BAR */
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  navTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  navIconWrapper: {
    position: 'relative'
  },
  navEmoji: {
    fontSize: 20,
    opacity: 0.6
  },
  navEmojiActive: {
    opacity: 1
  },
  navCountBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  navCountBadgeText: {
    fontSize: 9,
    color: '#064e3b',
    fontWeight: 'bold'
  },
  navCenterBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2
  },
  navCenterBadgeActive: {
    backgroundColor: '#064e3b'
  },
  navCenterBadgeText: {
    fontSize: 15
  },
  navTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 2
  },
  navTabLabelActive: {
    color: '#064e3b',
    fontWeight: '800'
  },
  navActiveIndicator: {
    width: 16,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#059669',
    marginTop: 2
  }
});
