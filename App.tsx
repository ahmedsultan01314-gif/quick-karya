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
import { CATEGORIES, CATEGORY_SUB_ROLES } from './src/data/categories';
import {
  INDIAN_STATES,
  STATE_CITIES,
  DEFAULT_POPULAR_CITIES,
  getCitiesForState
} from './src/data/indianStates';
import {
  ActiveTab,
  ServiceCategory,
  WorkerProfile
} from './src/types';
import {
  saveWorkerToCloud,
  subscribeWorkersFromCloud
} from './src/firebase';

const STORAGE_KEY = '@quickkarya_workers_v3';

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
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
  // Workers starts empty - pure directory with real registrations only
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

  // Registration Form State (Strictly: Profile Photo, Full Name, Service Category, Experience, Mobile, City, State, Pincode)
  const [regName, setRegName] = useState('');
  const [regCategory, setRegCategory] = useState<ServiceCategory>('Plumber');
  const [regSubRole, setRegSubRole] = useState<string>('');
  const [regExperience, setRegExperience] = useState('4');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('Agartala');
  const [regState, setRegState] = useState('Tripura');
  const [regPincode, setRegPincode] = useState('799001');
  const [regPhoto, setRegPhoto] = useState<string>('');
  const [regSuccessWorker, setRegSuccessWorker] = useState<WorkerProfile | null>(null);

  // State & City Selector Modals & Search query in Modals
  const [isStateModalOpen, setIsStateModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [stateSearchText, setStateSearchText] = useState('');
  const [citySearchText, setCitySearchText] = useState('');
  const [formGpsLoading, setFormGpsLoading] = useState(false);

  // Quick-fill State, City, Pincode using device GPS
  const handleUseGpsInForm = async () => {
    setFormGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow GPS access to auto-fill your location details.'
        );
        setFormGpsLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      setUserCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });

      let detectedCity = '';
      let detectedState = '';
      let detectedPin = '';

      // Try expo-location reverseGeocodeAsync
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        });
        if (geo) {
          detectedCity = geo.city || geo.subregion || '';
          detectedState = geo.region || '';
          detectedPin = geo.postalCode || '';
        }
      } catch (e) {
        // Fallback to server endpoint
      }

      if (!detectedCity || !detectedState) {
        try {
          const res = await fetch(
            `/api/reverse-geocode?lat=${loc.coords.latitude}&lng=${loc.coords.longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.city) detectedCity = data.city;
            if (data.state) detectedState = data.state;
            if (data.pincode) detectedPin = data.pincode;
          }
        } catch {
          // Fallback coordinates
        }
      }

      if (detectedCity) setRegCity(detectedCity);
      if (detectedState) setRegState(detectedState);
      if (detectedPin) setRegPincode(detectedPin);

      if (detectedCity && detectedState) {
        setUserLocationName(`${detectedCity}, ${detectedState}`);
        Alert.alert(
          'GPS Location Auto-Filled',
          `✓ Detected: ${detectedCity}, ${detectedState} ${detectedPin ? `(${detectedPin})` : ''}`
        );
      } else {
        Alert.alert('GPS Location', `Coordinates updated: ${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
      }
    } catch (err: any) {
      Alert.alert('Location Error', err?.message || 'Could not fetch GPS location.');
    } finally {
      setFormGpsLoading(false);
    }
  };

  // 1. Cloud Firestore Real-time synchronization with local offline cache fallback
  useEffect(() => {
    // First, load from local offline cache (AsyncStorage) immediately
    const loadOfflineCache = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWorkers(parsed);
          }
        }
      } catch (err) {
        console.warn('Error reading from offline storage cache:', err);
      }
    };
    loadOfflineCache();

    // Subscribe to Cloud Firestore for live real-time sync across all devices
    const unsubscribe = subscribeWorkersFromCloud(
      (cloudWorkers) => {
        if (Array.isArray(cloudWorkers)) {
          setWorkers(cloudWorkers);
          // Persist to local offline cache
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cloudWorkers)).catch(
            (e) => console.warn('Error caching cloud workers locally:', e)
          );
        }
      },
      (err) => {
        console.warn('Firestore live sync listener error:', err);
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
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

    const formattedPhone = cleanPhone.startsWith('91')
      ? `+${cleanPhone}`
      : `+91 ${cleanPhone.slice(-10, -5)} ${cleanPhone.slice(-5)}`;

    const newWorker: WorkerProfile = {
      id: `w-local-${Date.now()}`,
      name: regName.trim(),
      category: regCategory,
      subRole: regSubRole ? regSubRole.trim() : undefined,
      experience: expNum,
      rating: 5.0,
      reviewCount: 1,
      hourlyRate: 0,
      rate: 0,
      phone: formattedPhone,
      city: regCity.trim() || 'Agartala',
      state: regState.trim() || 'Tripura',
      pincode: regPincode.trim() || '799001',
      latitude: userCoords.latitude,
      longitude: userCoords.longitude,
      verified: false,
      isVerified: false,
      available: true,
      completedJobs: 1,
      languages: ['Bengali', 'Hindi', 'English'],
      skills: regSubRole ? [regSubRole.trim(), regCategory] : [regCategory],
      photo: regPhoto || undefined,
      emergencyAvailable: regCategory === 'Emergency Highway Assistance'
    };

    const updated = [newWorker, ...workers];
    setWorkers(updated);

    // Save to local offline cache fallback
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed saving to AsyncStorage:', e);
    }

    // Save to Cloud Firestore so all other phones receive live update immediately
    saveWorkerToCloud(newWorker).catch((err) => {
      console.warn('Could not sync to cloud database immediately:', err);
    });

    setRegSuccessWorker(newWorker);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064e3b" />

      {/* TOP EMERGENCY HIGHWAY SOS BAR */}
      <View style={styles.topEmergencyStrip}>
        <View style={styles.dotRow}>
          <View style={styles.greenDot} />
          <Text style={styles.topStripText}>Free Proximity Contact Directory</Text>
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
            <Text style={styles.brandSubtitle}>DIRECT ARTISAN CALL DIRECTORY</Text>
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
              placeholder="Search artisan, trade, area, or phone..."
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
                    ? 'The directory currently has no registered workers. Be the first local worker to register your profile for direct phone calls!'
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
              /* CLEAN WORKER CARD UI WITHOUT ANY PRICES OR RATES */
              filteredWorkers.map((worker) => {
                const isEmergency =
                  worker.category === 'Emergency Highway Assistance';
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
                            {(worker.isVerified ?? worker.verified) ? (
                              <View style={styles.cardVerifiedBadge}>
                                <Text style={styles.cardVerifiedBadgeText}>
                                  ✓ Verified
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          {/* Profession & Experience */}
                          <View style={styles.cardSubDetailsRow}>
                            <Text style={styles.cardCategoryText}>
                              {worker.category}
                            </Text>
                            {worker.subRole ? (
                              <>
                                <Text style={styles.cardDot}>•</Text>
                                <Text style={styles.cardSubRoleText}>
                                  {worker.subRole}
                                </Text>
                              </>
                            ) : null}
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

                      {/* Prominent Dark Green Call Button (Pure Directory: "Call Worker") */}
                      <TouchableOpacity
                        style={[
                          styles.callNowButton,
                          isEmergency && styles.callNowButtonEmergency
                        ]}
                        onPress={() => handleCall(worker.phone)}
                      >
                        <Text style={styles.callNowButtonIcon}>📞</Text>
                        <Text style={styles.callNowButtonText}>
                          Call Worker
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
                        : cat.name === 'Laundry / Clothes Wash'
                        ? '🧺'
                        : cat.name === 'Hotel Staff'
                        ? '🏨'
                        : cat.name === 'Restaurant Staff'
                        ? '🍽️'
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
                  <Text style={styles.categoryAvgRate}>Direct Dial Contact</Text>
                  <Text style={styles.categoryCardAction}>
                    View Artisans →
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* TAB 3: WORKER ONBOARDING / REGISTRATION (PURE DIRECTORY FIELDS ONLY) */}
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
                Your profile for <Text style={styles.boldText}>{regSuccessWorker.name}</Text> has been saved locally and published to the free contact directory!
              </Text>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Category: </Text>
                  {regSuccessWorker.category}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Direct Phone: </Text>
                  {regSuccessWorker.phone}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryLabel}>Experience: </Text>
                  {regSuccessWorker.experience} years
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
                  View Your Profile in Directory →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => {
                  setRegSuccessWorker(null);
                  setRegName('');
                  setRegPhone('');
                  setRegPhoto('');
                }}
              >
                <Text style={styles.secondaryActionButtonText}>
                  Register Another Worker
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ONBOARDING FORM: Profile Photo, Full Name, Category, Experience, Mobile, City, State, Pincode */
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formHeaderTitle}>Worker Registration</Text>
                <Text style={styles.formHeaderSubtitle}>
                  100% free proximity contact directory — clients call you directly.
                </Text>
              </View>

              {/* 1. Profile Avatar Photo */}
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

              {/* 2. Full Name */}
              <Text style={styles.inputLabel}>Full Name or Team Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Rajesh Sharma"
                placeholderTextColor="#9ca3af"
                value={regName}
                onChangeText={setRegName}
              />

              {/* 3. Service Category */}
              <Text style={styles.inputLabel}>Service Category *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryChipScroll}
              >
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      setRegCategory(c.name);
                      setRegSubRole('');
                    }}
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

              {/* Sub-Role Selector for Categories with Specialized Sub-Roles */}
              {CATEGORY_SUB_ROLES[regCategory] && (
                <View style={styles.subRoleContainer}>
                  <Text style={styles.inputLabel}>Select Specific Role / Specialty</Text>
                  <View style={styles.subRoleRow}>
                    {CATEGORY_SUB_ROLES[regCategory]!.map((role) => (
                      <TouchableOpacity
                        key={role}
                        onPress={() => setRegSubRole(regSubRole === role ? '' : role)}
                        style={[
                          styles.subRoleBtn,
                          regSubRole === role && styles.subRoleBtnActive
                        ]}
                      >
                        <Text
                          style={[
                            styles.subRoleBtnText,
                            regSubRole === role && styles.subRoleBtnTextActive
                          ]}
                        >
                          {regSubRole === role ? `✓ ${role}` : role}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* 4. Experience (Years) */}
              <Text style={styles.inputLabel}>Experience (Years) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 5"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={regExperience}
                onChangeText={setRegExperience}
              />

              {/* 5. Mobile Number */}
              <Text style={styles.inputLabel}>Mobile Number (Direct Calls) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="10-digit mobile number (e.g. 9862154321)"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={regPhone}
                onChangeText={setRegPhone}
              />

              {/* 6. Service Location Header with Auto-Detect via GPS Button */}
              <View style={styles.locationSectionHeaderRow}>
                <Text style={styles.inputSectionLabel}>Service Location Details *</Text>
                <TouchableOpacity
                  style={styles.gpsAutoFillBtn}
                  onPress={handleUseGpsInForm}
                  disabled={formGpsLoading}
                >
                  <Text style={styles.gpsAutoFillBtnText}>
                    {formGpsLoading ? '📍 Locating...' : '📍 Use GPS Location'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* State Dropdown Trigger */}
              <Text style={styles.inputLabel}>State *</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => {
                  setStateSearchText('');
                  setIsStateModalOpen(true);
                }}
              >
                <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                  {regState} ▼
                </Text>
              </TouchableOpacity>

              {/* Dynamic City Selection: Combo-Box with State Filtering & Free Manual Typing */}
              <View style={styles.cityFieldHeaderRow}>
                <Text style={styles.inputLabel}>City / Town *</Text>
                <Text style={styles.cityFieldHintText}>
                  Pick from {regState} or type custom
                </Text>
              </View>

              <View style={styles.cityComboContainer}>
                <TextInput
                  style={styles.cityComboInput}
                  placeholder={`Type city in ${regState}...`}
                  placeholderTextColor="#9ca3af"
                  value={regCity}
                  onChangeText={setRegCity}
                />
                <TouchableOpacity
                  style={styles.cityComboDropdownBtn}
                  onPress={() => {
                    setCitySearchText('');
                    setIsCityModalOpen(true);
                  }}
                >
                  <Text style={styles.cityComboDropdownText}>Pick ▼</Text>
                </TouchableOpacity>
              </View>

              {/* Quick-Select Chips for Top Cities in Selected State */}
              <View style={styles.quickCitiesContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickCitiesScroll}
                >
                  <Text style={styles.quickCitiesLabel}>Popular:</Text>
                  {getCitiesForState(regState).slice(0, 6).map((qc) => (
                    <TouchableOpacity
                      key={qc}
                      onPress={() => setRegCity(qc)}
                      style={[
                        styles.quickCityChip,
                        regCity.toLowerCase() === qc.toLowerCase() && styles.quickCityChipActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickCityChipText,
                          regCity.toLowerCase() === qc.toLowerCase() && styles.quickCityChipTextActive
                        ]}
                      >
                        {qc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* 7. Pincode */}
              <Text style={styles.inputLabel}>Pincode *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                maxLength={6}
                value={regPincode}
                onChangeText={setRegPincode}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleRegisterSubmit}
              >
                <Text style={styles.submitButtonText}>
                  ✓ Publish Free Profile
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
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search state..."
                  placeholderTextColor="#9ca3af"
                  value={stateSearchText}
                  onChangeText={setStateSearchText}
                />
                <ScrollView style={styles.modalList}>
                  {INDIAN_STATES.filter((s) =>
                    !stateSearchText.trim() ||
                    s.toLowerCase().includes(stateSearchText.toLowerCase().trim())
                  ).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.modalListItem,
                        regState === s && styles.modalListItemActive
                      ]}
                      onPress={() => {
                        setRegState(s);
                        const stateCities = getCitiesForState(s);
                        if (stateCities.length > 0 && !stateCities.includes(regCity)) {
                          setRegCity(stateCities[0]);
                        }
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

          {/* STATE-FILTERED CITY PICKER MODAL */}
          <Modal
            visible={isCityModalOpen}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsCityModalOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Cities in {regState} ({getCitiesForState(regState).length})
                  </Text>
                  <TouchableOpacity onPress={() => setIsCityModalOpen(false)}>
                    <Text style={styles.modalCloseText}>✕ Close</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder={`Search or type city in ${regState}...`}
                  placeholderTextColor="#9ca3af"
                  value={citySearchText}
                  onChangeText={setCitySearchText}
                />
                {citySearchText.trim() !== '' && (
                  <TouchableOpacity
                    style={styles.modalCustomOption}
                    onPress={() => {
                      setRegCity(citySearchText.trim());
                      setIsCityModalOpen(false);
                    }}
                  >
                    <Text style={styles.modalCustomOptionText}>
                      ✍️ Use custom city: &quot;{citySearchText.trim()}&quot;
                    </Text>
                  </TouchableOpacity>
                )}
                <ScrollView style={styles.modalList}>
                  {getCitiesForState(regState)
                    .filter((c) =>
                      !citySearchText.trim() ||
                      c.toLowerCase().includes(citySearchText.toLowerCase().trim())
                    )
                    .map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.modalListItem,
                          regCity.toLowerCase() === c.toLowerCase() && styles.modalListItemActive
                        ]}
                        onPress={() => {
                          setRegCity(c);
                          setIsCityModalOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalListItemText,
                            regCity.toLowerCase() === c.toLowerCase() && styles.modalListItemTextActive
                          ]}
                        >
                          {c}
                        </Text>
                        {regCity.toLowerCase() === c.toLowerCase() && (
                          <Text style={styles.modalCheckText}>✓</Text>
                        )}
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

  /* WORKER CARD STYLES */
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
  },
  cardSubRoleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  subRoleContainer: {
    marginTop: 8,
    marginBottom: 6
  },
  subRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  subRoleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff'
  },
  subRoleBtnActive: {
    backgroundColor: '#064e3b',
    borderColor: '#064e3b'
  },
  subRoleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151'
  },
  subRoleBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold'
  },

  /* LOCATION & COMBO-BOX STYLES */
  locationSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6'
  },
  inputSectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  gpsAutoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  gpsAutoFillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46'
  },
  cityFieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6
  },
  cityFieldHintText: {
    fontSize: 11,
    color: '#065f46',
    fontWeight: '600'
  },
  cityComboContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginTop: 4,
    overflow: 'hidden'
  },
  cityComboInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500'
  },
  cityComboDropdownBtn: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb'
  },
  cityComboDropdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46'
  },
  quickCitiesContainer: {
    marginTop: 6,
    marginBottom: 4
  },
  quickCitiesScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2
  },
  quickCitiesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    marginRight: 2
  },
  quickCityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  quickCityChipActive: {
    backgroundColor: '#064e3b',
    borderColor: '#064e3b'
  },
  quickCityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151'
  },
  quickCityChipTextActive: {
    color: '#ffffff',
    fontWeight: 'bold'
  },
  modalSearchInput: {
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    fontSize: 13,
    color: '#111827'
  },
  modalCustomOption: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8
  },
  modalCustomOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46'
  },
  modalCheckText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669'
  }
});
