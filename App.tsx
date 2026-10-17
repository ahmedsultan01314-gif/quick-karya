import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Modal,
  BackHandler,
  ToastAndroid,
  Animated,
  ActivityIndicator
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
  WorkerProfile,
  AppUser,
  UserRole,
  WorkerReview
} from './src/types';
import {
  saveWorkerToCloud,
  subscribeWorkersFromCloud,
  saveReviewToCloud,
  fetchReviewsForWorker,
  saveUserToCloud,
  sendFirebasePhoneOtp,
  verifyFirebasePhoneOtp,
  auth
} from './src/firebase';
import {
  setupNotifications,
  triggerRegistrationNotification,
  triggerCallWorkerNotification
} from './src/utils/notifications';

const STORAGE_KEY = '@quickkarya_workers_v3';
const AUTH_STORAGE_KEY = '@quickkarya_user_session_v1';

const AnimatedView = Animated.View as any;
const AnimatedText = Animated.Text as any;



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
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Workers starts empty - pure directory with real registrations only
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

  // User Auth & Session Gate
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'role_selection'>('phone');
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [pendingVerifiedUser, setPendingVerifiedUser] = useState<AppUser | null>(null);
  const [showSplashScreen, setShowSplashScreen] = useState(true);

  // Auto-dismiss initial brand splash after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplashScreen(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Check persistent session on initial mount
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.phone && parsed?.verified) {
            setCurrentUser(parsed);
            if (parsed.name) setRegName(parsed.name);
            if (parsed.phone) {
              setRegPhone(parsed.phone.replace(/[^0-9]/g, '').slice(-10));
            }
            if (parsed.profilePhoto || parsed.avatar) {
              setRegPhoto(parsed.profilePhoto || parsed.avatar);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Session check error:', err);
      }
      // Mandatory Startup Gate: No verified session exists
      setIsAuthModalOpen(true);
      setAuthStep('phone');
    };

    checkUserSession();
  }, []);

  // OTP resend cooldown timer
  useEffect(() => {
    let timer: any;
    if (otpCooldown > 0) {
      timer = setInterval(() => setOtpCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const handleNativeSendOtp = async () => {
    setAuthError(null);
    setAuthSuccessMsg(null);

    if (!loginName.trim()) {
      setAuthError('Please enter your Full Name to continue.');
      return;
    }

    const clean = loginPhone.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setAuthLoading(true);

    try {
      // Primary: Dispatch natively via Firebase Phone Auth SDK
      try {
        await sendFirebasePhoneOtp(clean);
        setAuthSuccessMsg(`SMS verification code dispatched natively via Firebase Phone Auth to +91 ${clean}.`);
      } catch (fbErr: any) {
        console.warn('Firebase Phone Auth native dispatch note:', fbErr);
        // Seamless fallback to server dispatch
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: clean })
        });
        if (res.ok) {
          const data = await res.json();
          setAuthSuccessMsg(data.message || `6-digit verification code sent directly to +91 ${clean}`);
        } else {
          throw new Error(fbErr?.message || 'Failed to dispatch verification code');
        }
      }

      setLoginOtp(''); // Strictly empty, requiring real SMS verification code from SMS inbox
      setAuthStep('otp');
      setOtpCooldown(60);
    } catch (err: any) {
      setAuthError(err?.message || 'Error sending verification code. Please check your network.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleNativeVerifyOtp = async () => {
    setAuthError(null);
    if (!loginOtp.trim() || loginOtp.trim().length !== 6) {
      setAuthError('Please enter the 6-digit OTP code.');
      return;
    }

    setAuthLoading(true);
    const clean = loginPhone.replace(/[^0-9]/g, '').slice(-10);
    let verifiedUserObj: AppUser | null = null;

    try {
      // 1. Verify directly via Firebase Phone Auth SDK
      try {
        const firebaseUser = await verifyFirebasePhoneOtp(loginOtp.trim());
        if (firebaseUser) {
          verifiedUserObj = {
            id: firebaseUser.uid,
            phone: `+91 ${clean}`,
            name: loginName.trim(),
            role: 'customer',
            verified: true,
            createdAt: new Date().toISOString()
          };
          await saveUserToCloud(verifiedUserObj).catch((e) => console.warn('Firestore user save notice:', e));
        }
      } catch (fbVerifyErr: any) {
        console.warn('Firebase Phone Auth verify, checking server verification:', fbVerifyErr);
        // Fallback to server verification
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: clean,
            code: loginOtp.trim(),
            name: loginName.trim()
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            verifiedUserObj = data.user;
          }
        } else {
          throw new Error(fbVerifyErr?.message || 'Invalid OTP code.');
        }
      }

      if (!verifiedUserObj) {
        setAuthError('Invalid OTP code. Please check and try again.');
        setAuthLoading(false);
        return;
      }

      setPendingVerifiedUser(verifiedUserObj);
      setAuthStep('role_selection');
    } catch (err: any) {
      setAuthError(err?.message || 'Verification failed. Please check your code.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConfirmRole = async (role: UserRole) => {
    if (!pendingVerifiedUser) return;
    const clean = loginPhone.replace(/[^0-9]/g, '').slice(-10);
    const workerId = role === 'worker' ? `QK-${Math.floor(10000 + Math.random() * 90000)}` : undefined;

    const finalUser: AppUser = {
      ...pendingVerifiedUser,
      role,
      workerId,
      name: loginName.trim() || pendingVerifiedUser.name,
      phone: `+91 ${clean}`
    };

    setCurrentUser(finalUser);
    setRegName(finalUser.name);
    setRegPhone(clean);

    try {
      await saveUserToCloud(finalUser);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(finalUser));
    } catch (e) {
      console.warn('User session save error:', e);
    }

    setIsAuthModalOpen(false);
    setAuthStep('phone');

    if (role === 'worker') {
      setActiveTab('register');
    } else {
      setActiveTab('home');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.warn('AsyncStorage logout error:', e);
    }
    setCurrentUser(null);
    setLoginName('');
    setLoginPhone('');
    setLoginOtp('');
    setAuthStep('phone');
    setIsAuthModalOpen(true);
  };

  // Detailed Profile View & Reviews State
  const [detailWorker, setDetailWorker] = useState<WorkerProfile | null>(null);
  const [workerReviews, setWorkerReviews] = useState<WorkerReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Star Rating Modal State
  const [ratingWorker, setRatingWorker] = useState<WorkerProfile | null>(null);
  const [starRating, setStarRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSuccess, setReviewSuccess] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleOpenRating = (worker: WorkerProfile) => {
    setRatingWorker(worker);
    setStarRating(5);
    setReviewComment('');
    setReviewError(null);
    setReviewSuccess(false);
  };

  const handleOpenDetail = (worker: WorkerProfile) => {
    setDetailWorker(worker);
    setLoadingReviews(true);
    fetchReviewsForWorker(worker.id)
      .then((data) => setWorkerReviews(data))
      .catch(() => setWorkerReviews([]))
      .finally(() => setLoadingReviews(false));
  };

  const handleSubmitReview = async () => {
    if (!ratingWorker) return;
    setSubmittingReview(true);
    setReviewError(null);

    try {
      const customerName = currentUser?.name || regName || 'Verified Customer';
      const customerId = currentUser?.id || `cust-${Date.now()}`;
      const newRev: WorkerReview = {
        id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        workerId: ratingWorker.id,
        customerId,
        customerName,
        rating: starRating,
        comment: reviewComment.trim() || undefined,
        serviceRequestId: `direct-${Date.now()}`,
        createdAt: new Date().toISOString(),
        reported: false
      };

      const { newRating, newCount } = await saveReviewToCloud(newRev);

      // Update in local workers state immediately in real-time
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === ratingWorker.id ? { ...w, rating: newRating, reviewCount: newCount } : w
        )
      );

      if (detailWorker && detailWorker.id === ratingWorker.id) {
        setDetailWorker((prev) =>
          prev ? { ...prev, rating: newRating, reviewCount: newCount } : null
        );
        setWorkerReviews((prev) => [newRev, ...prev]);
      }

      setReviewSuccess(true);
      setTimeout(() => {
        setRatingWorker(null);
        setReviewSuccess(false);
      }, 1400);
    } catch (err: any) {
      setReviewError(err?.message || 'Could not submit review to cloud database.');
    } finally {
      setSubmittingReview(false);
    }
  };

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

  // Subtle animated right-arrow scroll indicator for Service Category selector
  const categoryScrollRef = useRef<ScrollView>(null);
  const categoryScrollArrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(categoryScrollArrowAnim, {
          toValue: 5,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(categoryScrollArrowAnim, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [categoryScrollArrowAnim]);

  // State & City Selector Modals & Search query in Modals
  const [isStateModalOpen, setIsStateModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [stateSearchText, setStateSearchText] = useState('');
  const [citySearchText, setCitySearchText] = useState('');
  const [formGpsLoading, setFormGpsLoading] = useState(false);

  // Dedicated Roadside Assistance Screen State
  const [isHighwaySosOpen, setIsHighwaySosOpen] = useState(false);

  // Quick-dial and WhatsApp triggers for 24/7 Roadside Assistance
  const handleSosCall = (phone: string, serviceTitle: string) => {
    triggerCallWorkerNotification(
      serviceTitle,
      phone,
      'Emergency Highway Assistance',
      currentUser?.name || 'Driver in Distress',
      currentUser?.phone || ''
    );
    Linking.openURL(`tel:${phone}`);
  };

  const handleSosWhatsApp = (phone: string, serviceTitle: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const coords = `${userCoords.latitude.toFixed(5)}, ${userCoords.longitude.toFixed(5)}`;
    const msg = `🚨 *HIGHWAY SOS (24/7) - ${serviceTitle.toUpperCase()} REQUEST*
Hello, I am stranded on the highway and need urgent assistance:
📍 Location: ${userLocationName}
🌐 GPS Coordinates: ${coords}
🗺️ Google Maps: https://maps.google.com/?q=${coords}
👤 Driver: ${currentUser?.name || 'Driver in Distress'}
📱 Phone: ${currentUser?.phone || ''}
Please dispatch assistance immediately!`;

    const targetPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    Linking.openURL(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`);
  };

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

  // 1. Cloud Firestore Real-time synchronization with local offline cache fallback & Notifications setup
  useEffect(() => {
    setupNotifications().catch(() => {});

    // First, load from local offline cache (AsyncStorage) immediately
    const loadOfflineCache = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = parsed.filter(
              (w) =>
                !w.name?.toLowerCase().includes('kastu') &&
                !w.name?.toLowerCase().includes('santirkey')
            );
            setWorkers(clean);
            if (clean.length !== parsed.length) {
              AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean)).catch(() => {});
            }
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
          const clean = cloudWorkers.filter(
            (w) =>
              !w.name?.toLowerCase().includes('kastu') &&
              !w.name?.toLowerCase().includes('santirkey')
          );
          setWorkers(clean);
          // Persist to local offline cache
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clean)).catch(
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

  // Handle hardware Back button on Android smoothly without abrupt app exit
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let lastBackPressTime = 0;

    const backAction = () => {
      // 0. If Highway SOS screen is open, close it
      if (isHighwaySosOpen) {
        setIsHighwaySosOpen(false);
        return true;
      }

      // 0.1 If Rating Modal is open, close it
      if (ratingWorker) {
        setRatingWorker(null);
        return true;
      }

      // 0.1 If Worker Detail Modal is open, close it
      if (detailWorker) {
        setDetailWorker(null);
        return true;
      }

      // 0.2 If Auth Modal is active (first-time login gate)
      if (isAuthModalOpen && !currentUser) {
        if (authStep === 'role_selection') {
          setAuthStep('otp');
          return true;
        }
        if (authStep === 'otp') {
          setAuthStep('phone');
          return true;
        }
        if (ToastAndroid?.show) {
          ToastAndroid.show('Please enter your name and mobile number to continue', ToastAndroid.SHORT);
        }
        return true;
      }

      // 1. If any modal is open, close it first
      if (isStateModalOpen) {
        setIsStateModalOpen(false);
        return true;
      }
      if (isCityModalOpen) {
        setIsCityModalOpen(false);
        return true;
      }

      // 2. If viewing a category filter, reset to 'All'
      if (selectedCategory !== 'All') {
        setSelectedCategory('All');
        return true;
      }

      // 3. If on an inner tab (Register, Categories, Profile), navigate back to Home
      if (activeTab !== 'home' && activeTab !== 'workers') {
        setActiveTab('home');
        return true;
      }

      // 4. If search query is entered on Home, clear search query first
      if (searchQuery.trim().length > 0) {
        setSearchQuery('');
        return true;
      }

      // 5. On Home tab with no active search/modal: double tap back within 2 seconds to exit gracefully
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressTime = now;
      if (ToastAndroid?.show) {
        ToastAndroid.show('Press back again to exit Quick Karya', ToastAndroid.SHORT);
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [
    isAuthModalOpen,
    currentUser,
    authStep,
    isStateModalOpen,
    isCityModalOpen,
    selectedCategory,
    activeTab,
    searchQuery,
    ratingWorker,
    detailWorker
  ]);

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

  // Direct Phone Call handler using Expo Linking with explicit customer identity push alert
  const handleCall = (workerPhone: string, workerName?: string, workerCategory?: string) => {
    const cleanPhone = workerPhone.replace(/[^0-9+]/g, '');
    const callerName = currentUser?.name || regName || 'Customer';
    const callerPhone = currentUser?.phone || (regPhone ? `+91 ${regPhone}` : '+91 9876543210');

    // Trigger push notification to worker device with explicit customer identity
    triggerCallWorkerNotification(
      workerName || 'Worker',
      cleanPhone,
      workerCategory || 'Artisan',
      callerName,
      callerPhone
    ).catch(() => {});

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

    // Trigger local push notification on phone
    triggerRegistrationNotification(newWorker.name, newWorker.category).catch(() => {});

    setRegSuccessWorker(newWorker);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#001F3F" />

      {/* 0. OFFICIAL STARTUP SPLASH SCREEN */}
      {showSplashScreen && (
        <Modal visible={showSplashScreen} transparent={false} animationType="fade">
          <View style={styles.splashFullScreen}>
            <StatusBar barStyle="light-content" backgroundColor="#001F3F" />
            <View style={styles.splashContent}>
              <View style={styles.splashEmblemRing}>
                <Image
                  source={require('./assets/icon.png')}
                  style={styles.splashEmblemImg}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.splashTitle}>Quick Karya</Text>
              <Text style={styles.splashSubtitle}>DIRECT ARTISAN CALL DIRECTORY</Text>
              <View style={styles.splashDivider} />
              <Text style={styles.splashTagline}>Instant Nearby Verified Artisans • Live GPS Proximity</Text>
              <ActivityIndicator size="small" color="#FFA500" style={styles.splashLoader} />
            </View>
          </View>
        </Modal>
      )}

      {/* TOP EMERGENCY HIGHWAY SOS BAR */}
      <View style={styles.topEmergencyStrip}>
        <View style={styles.dotRow}>
          <View style={styles.greenDot} />
          <Text style={styles.topStripText}>Free Proximity Contact Directory</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setIsHighwaySosOpen(true);
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
            <Image
              source={require('./assets/icon.png')}
              style={styles.headerLogoImg}
              resizeMode="cover"
            />
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

      {/* TAB 1: HOME (PROXIMITY DIRECTORY) */}
      {(activeTab === 'home' || activeTab === 'workers') && (
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
                    : selectedCategory !== 'All'
                    ? `0 Registered Artisans in ${selectedCategory}`
                    : 'No Matching Artisans'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {workers.length === 0
                    ? 'The directory currently has 0 registered workers. Be the first genuine local worker to register your profile for direct phone calls!'
                    : selectedCategory !== 'All'
                    ? `Currently 0 registered workers in ${selectedCategory}. We maintain 100% verified genuine worker listings with zero fake or dummy profiles.`
                    : 'No service providers found matching your current search. We maintain 100% verified genuine worker listings with zero dummy profiles.'}
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
                const workerAvatarUri =
                  worker.photo || worker.avatar || worker.avatarUrl || worker.photoUrl;
                const hasValidAvatar = Boolean(
                  workerAvatarUri && !avatarErrors[worker.id]
                );

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
                      {/* Tappable Card Header: Avatar, Name, Category, Verified */}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handleOpenDetail(worker)}
                        style={styles.cardHeaderRow}
                      >
                        {/* Avatar inside Circular Frame with Golden/Orange Rim */}
                        <View style={styles.avatarContainer}>
                          {hasValidAvatar ? (
                            <Image
                              source={{ uri: workerAvatarUri }}
                              style={styles.avatarImg}
                              resizeMode="cover"
                              onError={() => {
                                setAvatarErrors((prev) => ({
                                  ...prev,
                                  [worker.id]: true
                                }));
                              }}
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
                          <Text style={styles.cardTapHint}>
                            View Profile & Reviews →
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Middle Stats Row: Rating stars & Availability */}
                      <View style={styles.cardStatsRow}>
                        <TouchableOpacity
                          style={styles.cardRatingBadge}
                          onPress={() => handleOpenDetail(worker)}
                        >
                          <Text style={styles.cardRatingText}>
                            ⭐ {(worker.rating || 5.0).toFixed(1)}
                          </Text>
                          <Text style={styles.cardReviewCountText}>
                            ({worker.reviewCount || 0} reviews)
                          </Text>
                        </TouchableOpacity>

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

                      {/* Two-Button Action Row: Rate Artisan ⭐ and Call Worker 📞 */}
                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.rateArtisanButton}
                          onPress={() => handleOpenRating(worker)}
                        >
                          <Text style={styles.rateArtisanButtonIcon}>⭐</Text>
                          <Text style={styles.rateArtisanButtonText}>
                            Rate Artisan
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.callNowButtonHalf,
                            isEmergency && styles.callNowButtonEmergency
                          ]}
                          onPress={() => handleCall(worker.phone, worker.name, worker.category)}
                        >
                          <Text style={styles.callNowButtonIcon}>📞</Text>
                          <Text style={styles.callNowButtonText}>
                            Call Worker
                          </Text>
                        </TouchableOpacity>
                      </View>
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
                  setIsHighwaySosOpen(true);
                }}
              >
                <Text style={styles.emergencyActionBtnText}>
                  Open Roadside Assistance →
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
                  setActiveTab('home');
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
                  setActiveTab('home');
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
              <View style={styles.categoryLabelRow}>
                <Text style={styles.inputLabelNoMargin}>Service Category *</Text>
                <View style={styles.categoryScrollIndicatorHint}>
                  <Text style={styles.scrollIndicatorDots}>•••</Text>
                  <AnimatedText
                    style={[
                      styles.scrollIndicatorArrow,
                      { transform: [{ translateX: categoryScrollArrowAnim }] }
                    ]}
                  >
                    →
                  </AnimatedText>
                  <Text style={styles.scrollIndicatorLabel}>Scroll for more</Text>
                </View>
              </View>

              <View style={styles.categoryScrollContainer}>
                <ScrollView
                  ref={categoryScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryChipScrollContent}
                  style={styles.categoryChipScroll}
                >
                  {CATEGORIES.map((c) => {
                    const isSelected = regCategory === c.name;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                          setRegCategory(c.name);
                          setRegSubRole('');
                        }}
                        style={[
                          styles.categoryChip,
                          isSelected
                            ? styles.categoryChipActive
                            : styles.categoryChipUnselected
                        ]}
                        activeOpacity={0.75}
                      >
                        {isSelected && (
                          <View style={styles.categoryTickIcon}>
                            <Text style={styles.categoryTickIconText}>✓</Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected
                              ? styles.categoryChipTextActive
                              : styles.categoryChipTextUnselected
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Subtle Right-Arrow Scroll Indicator Button */}
                <TouchableOpacity
                  style={styles.categoryRightArrowBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    categoryScrollRef.current?.scrollTo({ x: 340, animated: true });
                  }}
                >
                  <AnimatedView
                    style={[
                      styles.categoryRightArrowInner,
                      { transform: [{ translateX: categoryScrollArrowAnim }] }
                    ]}
                  >
                    <Text style={styles.categoryRightArrowDots}>••</Text>
                    <Text style={styles.categoryRightArrowText}>→</Text>
                  </AnimatedView>
                </TouchableOpacity>
              </View>

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

      {/* TAB 4: MY PROFILE (PERMANENT WORKER ID & VERIFIED SESSION) */}
      {activeTab === 'profile' && (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
        >
          {/* Profile Header Banner */}
          <View style={styles.profileCard}>
            <View style={styles.profileHeaderBanner}>
              <View style={styles.profileAvatarLarge}>
                {regPhoto || currentUser?.profilePhoto || currentUser?.avatar ? (
                  <Image
                    source={{
                      uri:
                        regPhoto ||
                        currentUser?.profilePhoto ||
                        currentUser?.avatar
                    }}
                    style={styles.profileAvatarImg}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.profileAvatarText}>
                    {regName ? regName.slice(0, 2).toUpperCase() : 'QK'}
                  </Text>
                )}
              </View>
              <View style={styles.profileHeaderInfo}>
                <Text style={styles.profileUserName}>
                  {currentUser?.name || regName || 'Quick Karya Member'}
                </Text>
                <Text style={styles.profileUserPhone}>
                  {currentUser?.phone || (regPhone ? `+91 ${regPhone}` : '+91 Verified Mobile')}
                </Text>
                <View style={styles.profileRoleBadge}>
                  <Text style={styles.profileRoleBadgeText}>
                    {currentUser?.role === 'worker' || workers.some((w) => regPhone && w.phone.includes(regPhone))
                      ? 'Verified Worker'
                      : 'Customer Account'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Permanent Worker ID Section */}
            <View style={styles.workerIdBox}>
              <Text style={styles.workerIdLabel}>PERMANENT WORKER ID</Text>
              <Text style={styles.workerIdCode}>
                {currentUser?.workerId ||
                  workers.find((w) => regPhone && w.phone.includes(regPhone))?.workerId ||
                  `QK-${Math.abs((regPhone || '799001').split('').reduce((a, b) => a + b.charCodeAt(0), 10000))}`}
              </Text>
              <Text style={styles.workerIdHint}>
                Permanently registered on Quick Karya cloud backend.
              </Text>
            </View>

            {/* Worker Details Summary */}
            <View style={styles.profileStatsGrid}>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatLabel}>Role</Text>
                <Text style={styles.profileStatVal}>
                  {currentUser?.role === 'worker' ? 'Artisan / Worker' : 'Customer'}
                </Text>
              </View>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatLabel}>Status</Text>
                <Text style={styles.profileStatVal}>✓ Phone Verified</Text>
              </View>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatLabel}>Location</Text>
                <Text style={styles.profileStatVal}>{regCity}, {regState}</Text>
              </View>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatLabel}>Directory</Text>
                <Text style={styles.profileStatVal}>100% Free Access</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <TouchableOpacity
              style={styles.profileActionBtn}
              onPress={() => setActiveTab('register')}
            >
              <Text style={styles.profileActionBtnText}>
                ✎ Edit / Register Worker Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileLogoutBtn}
              onPress={handleLogout}
            >
              <Text style={styles.profileLogoutBtnText}>
                Switch Account / Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR */}
      {/* FIXED BOTTOM NAVIGATION BAR WITH 3D STYLED ICONS IN DEEP NAVY BLUE */}
      <View style={styles.bottomNavContainer}>
        {/* Tab 1: Home (Proximity Directory) */}
        <TouchableOpacity
          style={styles.navTabButton}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.nav3dBadge,
              (activeTab === 'workers' || activeTab === 'home') && styles.nav3dBadgeActive
            ]}
          >
            <Text
              style={[
                styles.navEmoji,
                (activeTab === 'workers' || activeTab === 'home') && styles.navEmojiActive
              ]}
            >
              🏠
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
              (activeTab === 'workers' || activeTab === 'home') && styles.navTabLabelActive
            ]}
          >
            Home
          </Text>
          {(activeTab === 'workers' || activeTab === 'home') && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>

        {/* Tab 2: Register (Worker Onboarding) */}
        <TouchableOpacity
          style={styles.navTabButton}
          onPress={() => setActiveTab('register')}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.nav3dBadge,
              activeTab === 'register' && styles.nav3dBadgeActive
            ]}
          >
            <Text
              style={[
                styles.navEmoji,
                activeTab === 'register' && styles.navEmojiActive
              ]}
            >
              ➕
            </Text>
          </View>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'register' && styles.navTabLabelActive
            ]}
          >
            Register
          </Text>
          {activeTab === 'register' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>

        {/* Tab 3: Categories */}
        <TouchableOpacity
          style={styles.navTabButton}
          onPress={() => setActiveTab('categories')}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.nav3dBadge,
              activeTab === 'categories' && styles.nav3dBadgeActive
            ]}
          >
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
          {activeTab === 'categories' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>

        {/* Tab 4: My Profile */}
        <TouchableOpacity
          style={styles.navTabButton}
          onPress={() => setActiveTab('profile')}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.nav3dBadge,
              activeTab === 'profile' && styles.nav3dBadgeActive
            ]}
          >
            <Text
              style={[
                styles.navEmoji,
                activeTab === 'profile' && styles.navEmojiActive
              ]}
            >
              👤
            </Text>
          </View>
          <Text
            style={[
              styles.navTabLabel,
              activeTab === 'profile' && styles.navTabLabelActive
            ]}
          >
            My Profile
          </Text>
          {activeTab === 'profile' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
      </View>

      {/* MANDATORY STARTUP WELCOME & MOBILE OTP LOGIN MODAL */}
      <Modal
        visible={isAuthModalOpen && !currentUser}
        animationType="slide"
        transparent={false}
        statusBarTranslucent={true}
        onRequestClose={() => {
          // Handled by hardware BackHandler
        }}
      >
        <SafeAreaView style={styles.authGateContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#001F3F" />
          <ScrollView
            contentContainerStyle={styles.authGateScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top Hero Brand Header */}
            <View style={styles.authHeroHeader}>
              <View style={styles.authLogoBadge}>
                <Image
                  source={require('./assets/icon.png')}
                  style={styles.authLogoImg}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.authAppTitle}>Quick Karya</Text>
              <Text style={styles.authAppSubtitle}>
                DIRECT ARTISAN CALL DIRECTORY
              </Text>
              <View style={styles.authTrustBadgeRow}>
                <Text style={styles.authTrustBadge}>⚡ 100% Free Contact</Text>
                <Text style={styles.authTrustBadge}>🔒 No Middlemen</Text>
              </View>
            </View>

            {/* Step 1: Name & 10-Digit Mobile */}
            {authStep === 'phone' && (
              <View style={styles.authCard}>
                <View style={styles.authCardHeader}>
                  <Text style={styles.authCardTitle}>Welcome & Verification</Text>
                  <Text style={styles.authCardSubtitle}>
                    Enter your name and mobile number to access verified artisan contacts near you.
                  </Text>
                </View>

                {authError && (
                  <View style={styles.authErrorBox}>
                    <Text style={styles.authErrorText}>⚠️ {authError}</Text>
                  </View>
                )}

                {/* Full Name Input */}
                <View style={styles.authFieldGroup}>
                  <Text style={styles.authLabel}>YOUR FULL NAME / आपका नाम *</Text>
                  <TextInput
                    style={styles.authInput}
                    placeholder="e.g. Ramesh Kumar / Artisan"
                    placeholderTextColor="#9ca3af"
                    value={loginName}
                    onChangeText={setLoginName}
                    autoCapitalize="words"
                  />
                </View>

                {/* 10-Digit Mobile Number */}
                <View style={styles.authFieldGroup}>
                  <Text style={styles.authLabel}>10-DIGIT MOBILE NUMBER / मोबाइल नंबर *</Text>
                  <View style={styles.authPhoneInputRow}>
                    <View style={styles.authCountryCode}>
                      <Text style={styles.authCountryCodeText}>🇮🇳 +91</Text>
                    </View>
                    <TextInput
                      style={styles.authPhoneInput}
                      placeholder="9876543210"
                      placeholderTextColor="#9ca3af"
                      value={loginPhone}
                      onChangeText={(t) => setLoginPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.authPrimaryBtn, authLoading && styles.authBtnDisabled]}
                  onPress={handleNativeSendOtp}
                  disabled={authLoading}
                >
                  <Text style={styles.authPrimaryBtnText}>
                    {authLoading ? 'Sending OTP...' : 'Get 6-Digit OTP →'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.authSecurityNote}>
                  <Text style={styles.authSecurityNoteText}>
                    🔒 Genuine 6-digit SMS OTP verification. Your session stays permanently logged in on this device.
                  </Text>
                </View>
              </View>
            )}

            {/* Step 2: 6-Digit OTP Verification */}
            {authStep === 'otp' && (
              <View style={styles.authCard}>
                <View style={styles.authCardHeader}>
                  <Text style={styles.authCardTitle}>Enter 6-Digit OTP</Text>
                  <Text style={styles.authCardSubtitle}>
                    Sent to +91 {loginPhone.slice(-10)}
                  </Text>
                </View>

                {authSuccessMsg && (
                  <View style={styles.authSuccessBox}>
                    <Text style={styles.authSuccessText}>✓ {authSuccessMsg}</Text>
                  </View>
                )}

                {authError && (
                  <View style={styles.authErrorBox}>
                    <Text style={styles.authErrorText}>⚠️ {authError}</Text>
                  </View>
                )}

                {/* OTP Input */}
                <View style={styles.authFieldGroup}>
                  <Text style={styles.authLabel}>ENTER 6-DIGIT VERIFICATION CODE</Text>
                  <TextInput
                    style={styles.authOtpInput}
                    placeholder="• • • • • •"
                    placeholderTextColor="#9ca3af"
                    value={loginOtp}
                    onChangeText={(t) => setLoginOtp(t.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                {/* Verify Button */}
                <TouchableOpacity
                  style={[styles.authPrimaryBtn, authLoading && styles.authBtnDisabled]}
                  onPress={handleNativeVerifyOtp}
                  disabled={authLoading}
                >
                  <Text style={styles.authPrimaryBtnText}>
                    {authLoading ? 'Verifying OTP...' : 'Verify & Continue →'}
                  </Text>
                </TouchableOpacity>

                {/* Resend & Change Phone Row */}
                <View style={styles.authOtpActionsRow}>
                  <TouchableOpacity
                    onPress={() => setAuthStep('phone')}
                    style={styles.authTextBtn}
                  >
                    <Text style={styles.authTextBtnText}>✎ Edit Number</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleNativeSendOtp}
                    disabled={otpCooldown > 0}
                    style={styles.authTextBtn}
                  >
                    <Text style={[styles.authTextBtnText, otpCooldown > 0 && styles.authTextBtnDisabled]}>
                      {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 3: Role Selection (Customer vs Worker) */}
            {authStep === 'role_selection' && (
              <View style={styles.authCard}>
                <View style={styles.authCardHeader}>
                  <View style={styles.authVerifiedPill}>
                    <Text style={styles.authVerifiedPillText}>✓ Phone Verified</Text>
                  </View>
                  <Text style={styles.authCardTitle}>Choose Your Role</Text>
                  <Text style={styles.authCardSubtitle}>
                    Welcome, {loginName}! How would you like to use Quick Karya?
                  </Text>
                </View>

                {/* Option 1: Customer */}
                <TouchableOpacity
                  style={styles.authRoleOption}
                  onPress={() => handleConfirmRole('customer')}
                >
                  <View style={styles.authRoleIconBox}>
                    <Text style={styles.authRoleIconText}>🔍</Text>
                  </View>
                  <View style={styles.authRoleInfo}>
                    <Text style={styles.authRoleTitle}>Customer / ग्राहक</Text>
                    <Text style={styles.authRoleDesc}>
                      Browse local plumbers, electricians, drivers & call workers directly.
                    </Text>
                    <Text style={styles.authRoleAction}>Join as Customer →</Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: Artisan / Worker */}
                <TouchableOpacity
                  style={[styles.authRoleOption, styles.authRoleOptionWorker]}
                  onPress={() => handleConfirmRole('worker')}
                >
                  <View style={[styles.authRoleIconBox, styles.authRoleIconBoxWorker]}>
                    <Text style={styles.authRoleIconText}>🛠️</Text>
                  </View>
                  <View style={styles.authRoleInfo}>
                    <Text style={styles.authRoleTitle}>Artisan / Worker / कारीगर</Text>
                    <Text style={styles.authRoleDesc}>
                      Register your artisan skills to get permanent Worker ID & receive direct calls.
                    </Text>
                    <Text style={styles.authRoleActionWorker}>Join as Worker / Register →</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* DETAILED WORKER PROFILE & WRITTEN REVIEWS MODAL */}
      <Modal
        visible={Boolean(detailWorker)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setDetailWorker(null)}
      >
        {detailWorker && (
          <SafeAreaView style={styles.detailModalContainer}>
            <StatusBar barStyle="light-content" backgroundColor="#001F3F" />
            {/* Header */}
            <View style={styles.detailHeader}>
              <View style={styles.detailHeaderTop}>
                <TouchableOpacity
                  style={styles.detailCloseBtn}
                  onPress={() => setDetailWorker(null)}
                >
                  <Text style={styles.detailCloseBtnText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.detailHeaderBadge}>Artisan Profile</Text>
                <View style={{ width: 32 }} />
              </View>

              <View style={styles.detailProfileRow}>
                {(() => {
                  const detailAvatarUri =
                    detailWorker.photo ||
                    detailWorker.avatar ||
                    detailWorker.avatarUrl ||
                    detailWorker.photoUrl;
                  const hasValidDetailAvatar = Boolean(
                    detailAvatarUri && !avatarErrors[detailWorker.id]
                  );
                  return hasValidDetailAvatar ? (
                    <Image
                      source={{ uri: detailAvatarUri }}
                      style={styles.detailAvatar}
                      resizeMode="cover"
                      onError={() => {
                        setAvatarErrors((prev) => ({
                          ...prev,
                          [detailWorker.id]: true
                        }));
                      }}
                    />
                  ) : (
                    <View style={styles.detailAvatarInitial}>
                      <Text style={styles.detailAvatarInitialText}>
                        {detailWorker.name
                          .split(' ')
                          .map((n) => n[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join('')
                          .toUpperCase() || 'WK'}
                      </Text>
                    </View>
                  );
                })()}

                <View style={styles.detailNameCol}>
                  <Text style={styles.detailWorkerName} numberOfLines={1}>
                    {detailWorker.name}
                  </Text>
                  <Text style={styles.detailWorkerCategory}>
                    {detailWorker.category}
                    {detailWorker.subRole ? ` • ${detailWorker.subRole}` : ''}
                  </Text>
                  <View style={styles.detailWorkerIdPill}>
                    <Text style={styles.detailWorkerIdText}>
                      ID: {detailWorker.workerId || `QK-${detailWorker.id.slice(-5).toUpperCase()}`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Scrollable Profile Body */}
            <ScrollView style={styles.detailBodyScroll}>
              {/* Quick Info Grid */}
              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Artisan Overview</Text>
                <View style={styles.detailStatsGrid}>
                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Rating</Text>
                    <Text style={styles.detailStatValue}>
                      ⭐ {(detailWorker.rating || 5.0).toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Experience</Text>
                    <Text style={styles.detailStatValue}>
                      {detailWorker.experience} Yrs
                    </Text>
                  </View>
                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Status</Text>
                    <Text style={styles.detailStatValue}>
                      {(detailWorker.isVerified ?? detailWorker.verified) ? '✓ Verified' : 'Community'}
                    </Text>
                  </View>
                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatLabel}>Total Reviews</Text>
                    <Text style={styles.detailStatValue}>
                      {detailWorker.reviewCount || 0}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Location & Service Charges */}
              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Location & Fair Rates</Text>
                <View style={styles.detailLocationBox}>
                  <Text style={styles.detailLocationText}>
                    📍 {detailWorker.city}, {detailWorker.state || 'India'}
                    {detailWorker.pincode ? ` (${detailWorker.pincode})` : ''}
                  </Text>
                  {detailWorker.distanceKm !== undefined && (
                    <Text style={styles.detailDistanceText}>
                      ⚡ {detailWorker.distanceKm} km from current GPS location
                    </Text>
                  )}
                </View>
                <View style={styles.detailRatesRow}>
                  <View>
                    <Text style={styles.detailRatesLabel}>Direct Dial Directory</Text>
                    <Text style={styles.detailRatesSub}>
                      100% Free Contact • Rates agreed upon call
                    </Text>
                  </View>
                  <View style={styles.detailRatesBadge}>
                    <Text style={styles.detailRatesBadgeText}>Free Call</Text>
                  </View>
                </View>
              </View>

              {/* Skills Tags */}
              {detailWorker.skills && detailWorker.skills.length > 0 && (
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>Skills & Specialties</Text>
                  <View style={styles.detailSkillsRow}>
                    {detailWorker.skills.map((s, idx) => (
                      <View key={idx} style={styles.detailSkillPill}>
                        <Text style={styles.detailSkillPillText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Customer Written Reviews & Star Ratings */}
              <View style={styles.detailCard}>
                <View style={styles.detailReviewsHeader}>
                  <View>
                    <Text style={styles.detailCardTitle}>
                      Customer Ratings & Reviews
                    </Text>
                    <Text style={styles.detailReviewsSubtitle}>
                      ⭐ {(detailWorker.rating || 5.0).toFixed(1)} average from {detailWorker.reviewCount || 0} reviews
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.detailRateSmallBtn}
                    onPress={() => handleOpenRating(detailWorker)}
                  >
                    <Text style={styles.detailRateSmallBtnText}>Rate Artisan ⭐</Text>
                  </TouchableOpacity>
                </View>

                {loadingReviews ? (
                  <View style={styles.detailEmptyReviews}>
                    <Text style={styles.detailEmptyReviewsText}>Loading reviews from Firestore...</Text>
                  </View>
                ) : workerReviews.length === 0 ? (
                  <View style={styles.detailEmptyReviews}>
                    <Text style={styles.detailEmptyReviewsText}>
                      No written customer reviews yet for this artisan.
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleOpenRating(detailWorker)}
                    >
                      <Text style={styles.detailEmptyReviewsLink}>
                        Be the first customer to leave a review →
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.detailReviewsList}>
                    {workerReviews.map((rev) => (
                      <View key={rev.id} style={styles.detailReviewItem}>
                        <View style={styles.detailReviewHeader}>
                          <Text style={styles.detailReviewName}>
                            {rev.customerName}
                          </Text>
                          <Text style={styles.detailReviewStars}>
                            {'⭐'.repeat(rev.rating)}
                          </Text>
                        </View>
                        {rev.comment ? (
                          <Text style={styles.detailReviewComment}>
                            &quot;{rev.comment}&quot;
                          </Text>
                        ) : null}
                        <Text style={styles.detailReviewDate}>
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Bottom Actions Bar */}
            <View style={styles.detailBottomBar}>
              <TouchableOpacity
                style={styles.detailBottomRateBtn}
                onPress={() => handleOpenRating(detailWorker)}
              >
                <Text style={styles.detailBottomRateBtnText}>⭐ Rate Artisan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.detailBottomCallBtn}
                onPress={() => handleCall(detailWorker.phone, detailWorker.name, detailWorker.category)}
              >
                <Text style={styles.detailBottomCallBtnIcon}>📞</Text>
                <Text style={styles.detailBottomCallBtnText}>Call Worker</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>

      {/* INTERACTIVE STAR RATING & WRITTEN REVIEW MODAL */}
      <Modal
        visible={Boolean(ratingWorker)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setRatingWorker(null)}
      >
        <View style={styles.ratingModalOverlay}>
          <View style={styles.ratingModalCard}>
            <View style={styles.ratingModalHeader}>
              <View>
                <Text style={styles.ratingModalTitle}>Rate Artisan ⭐</Text>
                <Text style={styles.ratingModalSubtitle}>
                  {ratingWorker?.name} • {ratingWorker?.category}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setRatingWorker(null)}>
                <Text style={styles.ratingModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.ratingModalBody}>
              {reviewError && (
                <View style={styles.authErrorBox}>
                  <Text style={styles.authErrorText}>⚠️ {reviewError}</Text>
                </View>
              )}

              {reviewSuccess ? (
                <View style={styles.ratingSuccessBox}>
                  <Text style={{ fontSize: 32 }}>🎉</Text>
                  <Text style={styles.ratingSuccessTitle}>Rating Submitted!</Text>
                  <Text style={styles.ratingSuccessDesc}>
                    Your genuine star rating and review have been saved to Cloud Firestore in real-time.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Star Picker */}
                  <View style={styles.ratingPickerBox}>
                    <Text style={styles.ratingPickerPrompt}>
                      Tap to select your rating (1 to 5 Stars):
                    </Text>
                    <View style={styles.ratingStarsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          style={styles.ratingStarBtn}
                          onPress={() => setStarRating(star)}
                        >
                          <Text
                            style={[
                              styles.ratingStarIcon,
                              { opacity: star <= starRating ? 1 : 0.25 }
                            ]}
                          >
                            ⭐
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.ratingSelectedText}>
                      {starRating === 1
                        ? '1 Star - Poor'
                        : starRating === 2
                        ? '2 Stars - Fair'
                        : starRating === 3
                        ? '3 Stars - Good'
                        : starRating === 4
                        ? '4 Stars - Very Good'
                        : '5 Stars - Excellent! ⭐'}
                    </Text>
                  </View>

                  {/* Comment Text Box */}
                  <Text style={styles.ratingInputLabel}>
                    Written Customer Review / Feedback:
                  </Text>
                  <TextInput
                    style={styles.ratingTextInput}
                    placeholder="Write your feedback about craftsmanship, punctuality, and behavior..."
                    placeholderTextColor="#9ca3af"
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    multiline={true}
                    numberOfLines={3}
                  />

                  {/* Action Buttons */}
                  <View style={styles.ratingModalActions}>
                    <TouchableOpacity
                      style={styles.ratingCancelBtn}
                      onPress={() => setRatingWorker(null)}
                      disabled={submittingReview}
                    >
                      <Text style={styles.ratingCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.ratingSubmitBtn,
                        submittingReview && styles.ratingSubmitBtnDisabled
                      ]}
                      onPress={handleSubmitReview}
                      disabled={submittingReview}
                    >
                      <Text style={styles.ratingSubmitBtnText}>
                        {submittingReview ? 'Submitting...' : 'Submit Rating ⭐'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* DEDICATED HIGHWAY SOS (24/7) ROADSIDE ASSISTANCE SCREEN */}
      <Modal
        visible={isHighwaySosOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsHighwaySosOpen(false)}
      >
        <SafeAreaView style={styles.sosScreenContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#991b1b" />

          {/* SOS TOP BAR */}
          <View style={styles.sosScreenHeader}>
            <View style={styles.sosScreenHeaderLeft}>
              <View style={styles.sosScreenHeaderIconBox}>
                <Text style={styles.sosScreenHeaderIconText}>🚨</Text>
              </View>
              <View>
                <View style={styles.sosLivePill}>
                  <View style={styles.sosLiveDot} />
                  <Text style={styles.sosLivePillText}>24/7 HIGHWAY RESCUE</Text>
                </View>
                <Text style={styles.sosScreenHeaderTitle}>Roadside Assistance</Text>
                <Text style={styles.sosScreenHeaderSubtitle}>
                  Towing, Mobile Mechanic & Fuel Delivery
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.sosScreenCloseBtn}
              onPress={() => setIsHighwaySosOpen(false)}
            >
              <Text style={styles.sosScreenCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* QUICK HELPLINES BAR */}
          <View style={styles.sosHelplinesRow}>
            <TouchableOpacity
              style={styles.sosHelplineBtn}
              onPress={() => Linking.openURL('tel:1033')}
            >
              <Text style={styles.sosHelplineBtnText}>📞 NHAI Highway: 1033</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sosHelplineBtn, styles.sosHelplineBtnRed]}
              onPress={() => Linking.openURL('tel:112')}
            >
              <Text style={styles.sosHelplineBtnText}>🚨 National SOS: 112</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sosScreenScroll}
            contentContainerStyle={styles.sosScreenScrollContent}
          >
            {/* LIVE BREAKDOWN GPS CARD */}
            <View style={styles.sosLocationCard}>
              <View style={styles.sosLocationCardTop}>
                <Text style={styles.sosLocationCardTitle}>📍 Live Breakdown Location</Text>
                <TouchableOpacity
                  style={styles.sosCopyGpsBtn}
                  onPress={() => {
                    const coords = `${userCoords.latitude.toFixed(5)}, ${userCoords.longitude.toFixed(5)}`;
                    if (ToastAndroid?.show) {
                      ToastAndroid.show(`GPS: ${coords} (${userLocationName})`, ToastAndroid.LONG);
                    } else {
                      Alert.alert('GPS Location', `Coordinates: ${coords}\nLocation: ${userLocationName}`);
                    }
                  }}
                >
                  <Text style={styles.sosCopyGpsBtnText}>📋 View / Share GPS</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sosLocationNameText}>{userLocationName}</Text>
              <Text style={styles.sosLocationCoordsText}>
                Coordinates: {userCoords.latitude.toFixed(5)}, {userCoords.longitude.toFixed(5)}
              </Text>
              <Text style={styles.sosLocationHintText}>
                Share these exact coordinates with rescue mechanics & towing dispatchers so they locate you easily on the highway.
              </Text>
            </View>

            {/* SECTION: EMERGENCY HIGHWAY SERVICES */}
            <Text style={styles.sosSectionHeading}>
              EMERGENCY HIGHWAY SERVICES (QUICK DIAL & WHATSAPP)
            </Text>

            {/* SERVICE 1: TOWING SUPPORT */}
            <View style={styles.sosServiceCard}>
              <View style={styles.sosServiceCardHeader}>
                <View style={[styles.sosServiceIconBox, { backgroundColor: '#fef3c7' }]}>
                  <Text style={styles.sosServiceIconEmoji}>🚛</Text>
                </View>
                <View style={styles.sosServiceInfo}>
                  <View style={styles.sosServiceTitleRow}>
                    <Text style={styles.sosServiceTitle}>Towing Support</Text>
                    <Text style={styles.sosServiceHindi}>टोइंग सहायता</Text>
                  </View>
                  <View style={styles.sosResponseBadge}>
                    <Text style={styles.sosResponseBadgeText}>⚡ 15–30 Min Rapid Dispatch</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.sosServiceDesc}>
                24/7 Flatbed towing, hydraulic crane recovery, highway ditch winch & pull-out for cars, SUVs, and commercial trucks.
              </Text>
              <View style={styles.sosActionRow}>
                <TouchableOpacity
                  style={styles.sosCallBtn}
                  onPress={() => handleSosCall('+919862154321', 'Towing Support')}
                >
                  <Text style={styles.sosCallBtnText}>📞 Call Towing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sosWhatsAppBtn}
                  onPress={() => handleSosWhatsApp('+919862154321', 'Towing Support')}
                >
                  <Text style={styles.sosWhatsAppBtnText}>💬 WhatsApp SOS</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SERVICE 2: ON-SPOT MECHANIC */}
            <View style={styles.sosServiceCard}>
              <View style={styles.sosServiceCardHeader}>
                <View style={[styles.sosServiceIconBox, { backgroundColor: '#dbeafe' }]}>
                  <Text style={styles.sosServiceIconEmoji}>🔧</Text>
                </View>
                <View style={styles.sosServiceInfo}>
                  <View style={styles.sosServiceTitleRow}>
                    <Text style={styles.sosServiceTitle}>On-Spot Mechanic</Text>
                    <Text style={styles.sosServiceHindi}>ऑन-स्पॉट मैकेनिक</Text>
                  </View>
                  <View style={styles.sosResponseBadge}>
                    <Text style={styles.sosResponseBadgeText}>⚡ Mobile Garage Van Dispatch</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.sosServiceDesc}>
                Highway tyre puncture repair, spare replacement, battery jump start, radiator overheating, clutch & brake troubleshooting.
              </Text>
              <View style={styles.sosActionRow}>
                <TouchableOpacity
                  style={styles.sosCallBtn}
                  onPress={() => handleSosCall('+919862154322', 'On-Spot Mechanic')}
                >
                  <Text style={styles.sosCallBtnText}>📞 Call Mechanic</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sosWhatsAppBtn}
                  onPress={() => handleSosWhatsApp('+919862154322', 'On-Spot Mechanic')}
                >
                  <Text style={styles.sosWhatsAppBtnText}>💬 WhatsApp SOS</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SERVICE 3: FUEL DELIVERY */}
            <View style={styles.sosServiceCard}>
              <View style={styles.sosServiceCardHeader}>
                <View style={[styles.sosServiceIconBox, { backgroundColor: '#d1fae5' }]}>
                  <Text style={styles.sosServiceIconEmoji}>⛽</Text>
                </View>
                <View style={styles.sosServiceInfo}>
                  <View style={styles.sosServiceTitleRow}>
                    <Text style={styles.sosServiceTitle}>Fuel Delivery</Text>
                    <Text style={styles.sosServiceHindi}>इंधन डिलीवरी</Text>
                  </View>
                  <View style={styles.sosResponseBadge}>
                    <Text style={styles.sosResponseBadgeText}>⚡ Rapid Canister Delivery</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.sosServiceDesc}>
                Emergency 5L–10L sealed petrol or diesel delivered directly to your stalled vehicle on the highway.
              </Text>
              <View style={styles.sosActionRow}>
                <TouchableOpacity
                  style={styles.sosCallBtn}
                  onPress={() => handleSosCall('+919862154323', 'Fuel Delivery')}
                >
                  <Text style={styles.sosCallBtnText}>📞 Call Fuel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sosWhatsAppBtn}
                  onPress={() => handleSosWhatsApp('+919862154323', 'Fuel Delivery')}
                >
                  <Text style={styles.sosWhatsAppBtnText}>💬 WhatsApp SOS</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* INDEPENDENT REGISTERED HIGHWAY RESCUE TEAMS */}
            <View style={styles.sosRescueHeaderRow}>
              <Text style={styles.sosSectionHeading}>
                INDEPENDENT HIGHWAY RESCUE ARTISANS ({workers.filter(w => w.category === 'Emergency Highway Assistance').length})
              </Text>
              <Text style={styles.sosDirectTag}>Direct Phone Call</Text>
            </View>

            {workers.filter(w => w.category === 'Emergency Highway Assistance').length > 0 ? (
              workers
                .filter(w => w.category === 'Emergency Highway Assistance')
                .map((worker) => (
                  <View key={worker.id} style={styles.sosWorkerCard}>
                    <View style={styles.sosWorkerInfo}>
                      <Text style={styles.sosWorkerName}>{worker.name}</Text>
                      <Text style={styles.sosWorkerSub}>
                        {worker.city}, {worker.state} • {worker.experience} yrs exp
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.sosWorkerCallBtn}
                      onPress={() => handleCall(worker.phone, worker.name, worker.category)}
                    >
                      <Text style={styles.sosWorkerCallBtnText}>📞 Call</Text>
                    </TouchableOpacity>
                  </View>
                ))
            ) : (
              /* CLEAN EMPTY STATE - Zero fake or dummy listings */
              <View style={styles.sosCleanEmptyCard}>
                <Text style={styles.sosCleanEmptyIcon}>✓</Text>
                <Text style={styles.sosCleanEmptyTitle}>0 Independent Rescue Teams in Sector</Text>
                <Text style={styles.sosCleanEmptyDesc}>
                  No independent roadside workers currently registered here. Zero dummy profiles maintained. Use our 24/7 Rapid Emergency Dispatch services above or National Highway Helpline 1033.
                </Text>
                <TouchableOpacity
                  style={styles.sosRegisterTeamBtn}
                  onPress={() => {
                    setIsHighwaySosOpen(false);
                    setRegCategory('Emergency Highway Assistance');
                    setActiveTab('register');
                  }}
                >
                  <Text style={styles.sosRegisterTeamBtnText}>➕ Register as Highway Rescue Team</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* BOTTOM CLOSE BAR */}
          <View style={styles.sosBottomBar}>
            <TouchableOpacity
              style={styles.sosBottomCloseBtn}
              onPress={() => setIsHighwaySosOpen(false)}
            >
              <Text style={styles.sosBottomCloseBtnText}>Close Roadside Assistance</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
    backgroundColor: '#001F3F'
  },
  splashFullScreen: {
    flex: 1,
    backgroundColor: '#001F3F',
    justifyContent: 'center',
    alignItems: 'center'
  },
  splashContent: {
    alignItems: 'center',
    paddingHorizontal: 32
  },
  splashEmblemRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#FFA500',
    backgroundColor: '#00162e',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FFA500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8
  },
  splashEmblemImg: {
    width: 134,
    height: 134,
    borderRadius: 67
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 6
  },
  splashSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 2,
    textAlign: 'center'
  },
  splashDivider: {
    width: 60,
    height: 3,
    backgroundColor: '#FFA500',
    borderRadius: 2,
    marginVertical: 14
  },
  splashTagline: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500'
  },
  splashLoader: {
    marginTop: 8
  },
  bodyFlex: {
    flex: 1
  },
  topEmergencyStrip: {
    backgroundColor: '#00162e',
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 165, 0, 0.2)'
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
    color: '#cbd5e1',
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
    backgroundColor: '#001F3F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#0a2e5c'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#001F3F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: '#FFA500',
    overflow: 'hidden'
  },
  headerLogoImg: {
    width: 36,
    height: 36,
    borderRadius: 8
  },
  authLogoImg: {
    width: 66,
    height: 66,
    borderRadius: 18
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
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  locationPill: {
    backgroundColor: '#0a2e5c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e4d8c'
  },
  locationPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#001F3F'
  },
  searchInput: {
    backgroundColor: '#00162e',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#0a2e5c'
  },
  categoryContainer: {
    backgroundColor: '#001F3F',
    paddingBottom: 10
  },
  categoryScroll: {
    paddingHorizontal: 16
  },
  categoryPill: {
    backgroundColor: '#0a2e5c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1e4d8c'
  },
  categoryPillActive: {
    backgroundColor: '#FFA500',
    borderColor: '#FFD700'
  },
  categoryPillText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600'
  },
  categoryPillTextActive: {
    color: '#001F3F',
    fontWeight: '900'
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
    position: 'relative',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#FFA500',
    backgroundColor: '#001F3F',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#001F3F'
  },
  avatarInitialBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#001F3F',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarInitialText: {
    color: '#FFD700',
    fontSize: 16,
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
    backgroundColor: '#001F3F',
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
  categoryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  inputLabelNoMargin: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151'
  },
  categoryScrollIndicatorHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a'
  },
  scrollIndicatorDots: {
    fontSize: 10,
    color: '#b45309',
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginRight: 3
  },
  scrollIndicatorArrow: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: 'bold',
    marginRight: 4
  },
  scrollIndicatorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e'
  },
  categoryScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  categoryChipScroll: {
    flex: 1
  },
  categoryChipScrollContent: {
    paddingRight: 6,
    alignItems: 'center'
  },
  categoryChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    marginRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  categoryChipUnselected: {
    backgroundColor: '#0a2e5c',
    borderWidth: 1.5,
    borderColor: '#1e4d8c'
  },
  categoryChipActive: {
    backgroundColor: '#FFA500',
    borderWidth: 1.5,
    borderColor: '#FFD700'
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700'
  },
  categoryChipTextUnselected: {
    color: '#cbd5e1'
  },
  categoryChipTextActive: {
    color: '#001F3F'
  },
  categoryTickIcon: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5
  },
  categoryTickIconText: {
    color: '#064e3b',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12
  },
  categoryRightArrowBtn: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 14,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2
  },
  categoryRightArrowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryRightArrowDots: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#b45309',
    letterSpacing: 1,
    marginRight: 2
  },
  categoryRightArrowText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400e'
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

  /* BOTTOM NAVIGATION BAR IN DEEP NAVY BLUE #001F3F WITH 3D ICONS */
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 66,
    backgroundColor: '#001F3F',
    borderTopWidth: 1.5,
    borderTopColor: '#0a2e5c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.35,
    shadowRadius: 6
  },
  navTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  nav3dBadge: {
    width: 36,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0a2e5c',
    borderWidth: 1,
    borderColor: '#1e4d8c',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 4
  },
  nav3dBadgeActive: {
    backgroundColor: '#133d73',
    borderColor: '#FFA500',
    borderWidth: 1.5,
    shadowColor: '#FFA500',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6
  },
  navIconWrapper: {
    position: 'relative'
  },
  navEmoji: {
    fontSize: 16,
    opacity: 0.75
  },
  navEmojiActive: {
    opacity: 1
  },
  navCountBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#FFA500',
    borderColor: '#FFD700',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    elevation: 3
  },
  navCountBadgeText: {
    fontSize: 8.5,
    color: '#001F3F',
    fontWeight: '900'
  },
  navCenterBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#0a2e5c',
    borderWidth: 1,
    borderColor: '#1e4d8c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2
  },
  navCenterBadgeActive: {
    backgroundColor: '#133d73',
    borderColor: '#FFA500',
    borderWidth: 1.5
  },
  navCenterBadgeText: {
    fontSize: 15
  },
  navTabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2
  },
  navTabLabelActive: {
    color: '#FFD700',
    fontWeight: '800'
  },
  navActiveIndicator: {
    width: 18,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#FFA500',
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
  },
  subRoleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb'
  },
  subRoleChipActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5'
  },
  subRoleChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4b5563'
  },
  subRoleChipTextActive: {
    color: '#065f46',
    fontWeight: '700'
  },
  /* PROFILE VIEW STYLES */
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16
  },
  profileHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  profileAvatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#064e3b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  profileAvatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  profileAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  profileHeaderInfo: {
    flex: 1
  },
  profileUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827'
  },
  profileUserPhone: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  profileRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4
  },
  profileRoleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46'
  },
  workerIdBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginVertical: 14
  },
  workerIdLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
    letterSpacing: 0.5
  },
  workerIdCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#064e3b',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  workerIdHint: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 4
  },
  profileStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14
  },
  profileStatCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10
  },
  profileStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase'
  },
  profileStatVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 2
  },
  profileActionBtn: {
    backgroundColor: '#064e3b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  profileActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold'
  },
  profileLogoutBtn: {
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
    backgroundColor: '#fef2f2'
  },
  profileLogoutBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700'
  },
  /* AUTH GATE & ONBOARDING MODAL STYLES */
  authGateContainer: {
    flex: 1,
    backgroundColor: '#001F3F'
  },
  authGateScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20
  },
  authHeroHeader: {
    alignItems: 'center',
    marginBottom: 20
  },
  authLogoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#001F3F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFA500',
    overflow: 'hidden',
    marginBottom: 10
  },
  authLogoText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900'
  },
  authAppTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  authAppSubtitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 2
  },
  authTrustBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  authTrustBadge: {
    backgroundColor: '#0a2e5c',
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e4d8c'
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  authCardHeader: {
    marginBottom: 16
  },
  authCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827'
  },
  authCardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 18
  },
  authErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14
  },
  authErrorText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600'
  },
  authSuccessBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14
  },
  authSuccessText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '600'
  },
  authFieldGroup: {
    marginBottom: 16
  },
  authLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  authInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827'
  },
  authPhoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  authCountryCode: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  authCountryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151'
  },
  authPhoneInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    letterSpacing: 1
  },
  authOtpInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#FFA500',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    color: '#001F3F',
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center'
  },
  authPrimaryBtn: {
    backgroundColor: '#001F3F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#001F3F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  authBtnDisabled: {
    opacity: 0.6
  },
  authPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  authSecurityNote: {
    marginTop: 14,
    alignItems: 'center'
  },
  authSecurityNoteText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16
  },
  authOtpActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14
  },
  authTextBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  authTextBtnText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '700'
  },
  authTextBtnDisabled: {
    color: '#9ca3af'
  },
  authVerifiedPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 8
  },
  authVerifiedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46'
  },
  authRoleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginBottom: 12,
    gap: 12
  },
  authRoleOptionWorker: {
    borderColor: '#a7f3d0',
    backgroundColor: '#f0fdf4'
  },
  authRoleIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center'
  },
  authRoleIconBoxWorker: {
    backgroundColor: '#dcfce7'
  },
  authRoleIconText: {
    fontSize: 22
  },
  authRoleInfo: {
    flex: 1
  },
  authRoleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827'
  },
  authRoleDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 15
  },
  authRoleAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 4
  },
  authRoleActionWorker: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
    marginTop: 4
  },

  /* WORKER CARD ACTION ROW */
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  rateArtisanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderColor: '#FFA500',
    borderWidth: 2,
    paddingVertical: 10,
    borderRadius: 12
  },
  rateArtisanButtonIcon: {
    fontSize: 13
  },
  rateArtisanButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#001F3F'
  },
  callNowButtonHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#001F3F',
    borderWidth: 1,
    borderColor: '#0a2e5c',
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 2
  },
  cardTapHint: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 3
  },

  /* DETAILED WORKER PROFILE MODAL */
  detailModalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  detailHeader: {
    backgroundColor: '#001F3F',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 16
  },
  detailHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  detailCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  detailCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  detailHeaderBadge: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700'
  },
  detailProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  detailAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: '#FFA500',
    backgroundColor: '#001F3F'
  },
  detailAvatarInitial: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#001F3F',
    borderWidth: 2.5,
    borderColor: '#FFA500',
    justifyContent: 'center',
    alignItems: 'center'
  },
  detailAvatarInitialText: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: 'bold'
  },
  detailNameCol: {
    flex: 1
  },
  detailWorkerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  detailWorkerCategory: {
    fontSize: 13,
    color: '#a7f3d0',
    marginTop: 2
  },
  detailWorkerIdPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5, 150, 105, 0.4)',
    borderColor: '#34d399',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6
  },
  detailWorkerIdText: {
    color: '#ecfdf5',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier'
  },
  detailBodyScroll: {
    flex: 1,
    padding: 16
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12
  },
  detailCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8
  },
  detailStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  detailStatBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6'
  },
  detailStatLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2
  },
  detailStatValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827'
  },
  detailLocationBox: {
    marginBottom: 10
  },
  detailLocationText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600'
  },
  detailDistanceText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2
  },
  detailRatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 10,
    borderColor: '#a7f3d0',
    borderWidth: 1
  },
  detailRatesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#065f46'
  },
  detailRatesSub: {
    fontSize: 10,
    color: '#047857',
    marginTop: 2
  },
  detailRatesBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  detailRatesBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  detailSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  detailSkillPill: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  detailSkillPillText: {
    fontSize: 11,
    color: '#374151',
    fontWeight: '500'
  },
  detailReviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  detailReviewsSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1
  },
  detailRateSmallBtn: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8
  },
  detailRateSmallBtnText: {
    fontSize: 11,
    color: '#78350f',
    fontWeight: 'bold'
  },
  detailReviewsList: {
    marginTop: 6
  },
  detailReviewItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 8
  },
  detailReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  detailReviewName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  detailReviewStars: {
    fontSize: 10
  },
  detailReviewComment: {
    fontSize: 12,
    color: '#4b5563',
    fontStyle: 'italic',
    lineHeight: 16
  },
  detailReviewDate: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4
  },
  detailEmptyReviews: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10
  },
  detailEmptyReviewsText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 6
  },
  detailEmptyReviewsLink: {
    fontSize: 11,
    color: '#059669',
    fontWeight: 'bold'
  },
  detailBottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    elevation: 8
  },
  detailBottomRateBtn: {
    flex: 1,
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailBottomRateBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#78350f'
  },
  detailBottomCallBtn: {
    flex: 1,
    backgroundColor: '#064e3b',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  detailBottomCallBtnIcon: {
    fontSize: 14
  },
  detailBottomCallBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff'
  },

  /* RATING MODAL STYLES */
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  ratingModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6, 78, 59, 0.2)',
    elevation: 10
  },
  ratingModalHeader: {
    backgroundColor: '#064e3b',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ratingModalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  ratingModalSubtitle: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 2
  },
  ratingModalCloseText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    padding: 4
  },
  ratingModalBody: {
    padding: 16
  },
  ratingPickerBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fef3c7',
    padding: 12,
    alignItems: 'center',
    marginBottom: 14
  },
  ratingPickerPrompt: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8
  },
  ratingStarsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6
  },
  ratingStarBtn: {
    padding: 4
  },
  ratingStarIcon: {
    fontSize: 26
  },
  ratingSelectedText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#78350f'
  },
  ratingInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6
  },
  ratingTextInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: '#f9fafb'
  },
  ratingModalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14
  },
  ratingCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center'
  },
  ratingCancelBtnText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '600'
  },
  ratingSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#064e3b',
    alignItems: 'center'
  },
  ratingSubmitBtnDisabled: {
    opacity: 0.6
  },
  ratingSubmitBtnText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold'
  },
  ratingSuccessBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 10
  },
  ratingSuccessTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#065f46',
    marginTop: 6
  },
  ratingSuccessDesc: {
    fontSize: 11,
    color: '#047857',
    textAlign: 'center',
    marginTop: 2
  },

  /* 24/7 HIGHWAY SOS ROADSIDE ASSISTANCE SCREEN STYLES */
  sosScreenContainer: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  sosScreenHeader: {
    backgroundColor: '#991b1b',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sosScreenHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10
  },
  sosScreenHeaderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  sosScreenHeaderIconText: {
    fontSize: 24
  },
  sosLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 2
  },
  sosLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f87171',
    marginRight: 5
  },
  sosLivePillText: {
    color: '#fef08a',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  sosScreenHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  sosScreenHeaderSubtitle: {
    fontSize: 11,
    color: '#fee2e2',
    marginTop: 1
  },
  sosScreenCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sosScreenCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  sosHelplinesRow: {
    flexDirection: 'row',
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  sosHelplineBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sosHelplineBtnRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)'
  },
  sosHelplineBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  sosScreenScroll: {
    flex: 1
  },
  sosScreenScrollContent: {
    padding: 14,
    paddingBottom: 24
  },
  sosLocationCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14
  },
  sosLocationCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  sosLocationCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#78350f'
  },
  sosCopyGpsBtn: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  sosCopyGpsBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#92400e'
  },
  sosLocationNameText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 2
  },
  sosLocationCoordsText: {
    fontSize: 11,
    color: '#92400e',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2
  },
  sosLocationHintText: {
    fontSize: 10,
    color: '#b45309',
    marginTop: 4,
    lineHeight: 14
  },
  sosSectionHeading: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4
  },
  sosServiceCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  sosServiceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  sosServiceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  sosServiceIconEmoji: {
    fontSize: 20
  },
  sosServiceInfo: {
    flex: 1
  },
  sosServiceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  sosServiceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827'
  },
  sosServiceHindi: {
    fontSize: 11,
    color: '#6b7280'
  },
  sosResponseBadge: {
    alignSelf: 'flex-start',
    marginTop: 2
  },
  sosResponseBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#dc2626'
  },
  sosServiceDesc: {
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 16,
    marginBottom: 10
  },
  sosActionRow: {
    flexDirection: 'row',
    gap: 8
  },
  sosCallBtn: {
    flex: 1,
    backgroundColor: '#b91c1c',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sosCallBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  sosWhatsAppBtn: {
    flex: 1,
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sosWhatsAppBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  sosRescueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8
  },
  sosDirectTag: {
    fontSize: 10,
    color: '#059669',
    fontWeight: 'bold'
  },
  sosWorkerCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sosWorkerInfo: {
    flex: 1
  },
  sosWorkerName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111827'
  },
  sosWorkerSub: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2
  },
  sosWorkerCallBtn: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  sosWorkerCallBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  sosCleanEmptyCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginVertical: 6
  },
  sosCleanEmptyIcon: {
    fontSize: 18,
    color: '#059669',
    fontWeight: 'bold',
    marginBottom: 4
  },
  sosCleanEmptyTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4
  },
  sosCleanEmptyDesc: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10
  },
  sosRegisterTeamBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  sosRegisterTeamBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#064e3b'
  },
  sosBottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    alignItems: 'center'
  },
  sosBottomCloseBtn: {
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center'
  },
  sosBottomCloseBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151'
  }
});
