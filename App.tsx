import React, { useState } from 'react';
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
  Alert
} from 'react-native';
import WebApp from './src/App';
import { INITIAL_WORKERS } from './src/data/initialWorkers';
import { CATEGORIES } from './src/data/categories';
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
  isHeavyMachineryDriver
} from './src/utils/pricing';

const SAMPLE_AVATARS = [
  'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
];

function NativeApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workers');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [workers, setWorkers] = useState<WorkerProfile[]>(INITIAL_WORKERS);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regCategory, setRegCategory] = useState<ServiceCategory>('Plumber');
  const [regExperience, setRegExperience] = useState('4');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('Agartala');
  const [regState, setRegState] = useState('Tripura');
  const [regPincode, setRegPincode] = useState('799001');
  const [regSkills, setRegSkills] = useState('');
  const [regPhoto, setRegPhoto] = useState(SAMPLE_AVATARS[0]);
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

  const filteredWorkers = workers.filter((w) => {
    const matchesCategory =
      selectedCategory === 'All' || w.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch((err) => {
      console.warn('Could not trigger call:', err);
    });
  };

  const handleCategorySelectFromCategories = (cat: string) => {
    setSelectedCategory(cat);
    setActiveTab('workers');
  };

  const togglePricingType = (pt: PricingType) => {
    if (regPricingTypes.includes(pt)) {
      if (regPricingTypes.length > 1) {
        setRegPricingTypes(regPricingTypes.filter((t) => t !== pt));
      }
    } else {
      setRegPricingTypes([...regPricingTypes, pt]);
    }
  };

  const handleRegisterSubmit = () => {
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

    const newWorker: WorkerProfile = {
      id: `w-reg-${Date.now()}`,
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
          : primaryType === 'per_day'
          ? '/day'
          : primaryType === 'day_shift'
          ? '/day'
          : primaryType === 'night_shift'
          ? '/night'
          : '/hr',
      pricingRates: {
        per_hour: parseInt(regRates['per_hour'] || '350', 10),
        per_day: parseInt(regRates['per_day'] || '850', 10),
        per_month: parseInt(regRates['per_month'] || '22000', 10),
        fixed_job: parseInt(regRates['fixed_job'] || '150', 10)
      },
      vehicleType: regCategory === 'Driver' ? regVehicleType : undefined,
      phone: formattedPhone,
      city: regCity.trim() || 'Agartala',
      state: regState.trim() || 'Tripura',
      pincode: regPincode.trim() || '799001',
      latitude: 23.8315,
      longitude: 91.2868,
      verified: true,
      available: true,
      completedJobs: 0,
      languages: ['Bengali', 'Hindi', 'English'],
      skills: regSkills.trim()
        ? regSkills.split(',').map((s) => s.trim())
        : [regCategory === 'Driver' ? `${regVehicleType}` : `${regCategory} services`],
      photo: regPhoto
    };

    setWorkers([newWorker, ...workers]);
    setRegSuccessWorker(newWorker);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#064e3b" />

      {/* Top Emergency SOS Strip */}
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

      {/* Main Brand Header */}
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
        <View style={styles.locationPill}>
          <Text style={styles.locationPillText}>📍 Agartala</Text>
        </View>
      </View>

      {/* BODY CONTENT BY ACTIVE TAB */}

      {/* TAB 1: WORKERS (HOME) */}
      {activeTab === 'workers' && (
        <View style={styles.bodyFlex}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search artisan, skill, or area..."
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
                  All ({workers.length})
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

          {/* Workers List */}
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
                  <Text style={styles.resetFilterText}>Clear Filter</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredWorkers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No artisans found</Text>
                <Text style={styles.emptySubtitle}>
                  Try clearing your search query or selecting another category.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                >
                  <Text style={styles.emptyButtonText}>View All Artisans</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredWorkers.map((worker) => (
                <View key={worker.id} style={styles.workerCard}>
                  <View style={styles.workerHeader}>
                    {worker.photo ? (
                      <Image
                        source={{ uri: worker.photo }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {worker.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.workerDetails}>
                      <View style={styles.nameRow}>
                        <Text style={styles.workerName}>{worker.name}</Text>
                        {worker.verified && (
                          <Text style={styles.verifiedBadge}>✓ Verified</Text>
                        )}
                      </View>
                      <Text style={styles.workerCategory}>{worker.category}</Text>
                      {worker.vehicleType && (
                        <Text style={styles.vehicleTypeTag}>
                          🚗 {worker.vehicleType.split('(')[0].trim()}
                        </Text>
                      )}
                      <Text style={styles.workerLocation}>
                        📍 {worker.city}, {worker.state || 'Tripura'} • {worker.experience} yrs exp
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text style={styles.rateLabel}>Service Rate</Text>
                      <Text style={styles.rateValue}>
                        ₹{worker.hourlyRate || worker.rate || 300}
                        <Text style={styles.rateUnit}>
                          {' '}
                          {worker.rateUnit || '/hr'}
                        </Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => handleCall(worker.phone)}
                    >
                      <Text style={styles.callButtonText}>📞 Call Artisan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
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
                onPress={() =>
                  handleCategorySelectFromCategories('Emergency Highway Assistance')
                }
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

          {CATEGORIES.filter((c) => c.name !== 'Emergency Highway Assistance').map(
            (cat) => {
              const count = workers.filter((w) => w.category === cat.name).length;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.categoryCard}
                  onPress={() => handleCategorySelectFromCategories(cat.name)}
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
            }
          )}
        </ScrollView>
      )}

      {/* TAB 3: WORKER ONBOARDING / REGISTRATION */}
      {activeTab === 'register' && (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
        >
          {regSuccessWorker ? (
            /* Success confirmation card */
            <View style={styles.successCard}>
              <View style={styles.successIconBadge}>
                <Text style={styles.successIconEmoji}>🎉</Text>
              </View>
              <Text style={styles.successTitle}>Welcome to Quick Karya!</Text>
              <Text style={styles.successSubtitle}>
                Your profile for <Text style={styles.boldText}>{regSuccessWorker.name}</Text> has been successfully published to the live artisan directory.
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
                }}
              >
                <Text style={styles.secondaryActionButtonText}>
                  Register Another Artisan
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Registration Form */
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formHeaderTitle}>Worker Onboarding</Text>
                <Text style={styles.formHeaderSubtitle}>
                  Join the proximity artisan network with flexible hourly, daily, or fixed rates.
                </Text>
              </View>

              {/* Photo Avatar Selector */}
              <Text style={styles.inputLabel}>Profile Photo Avatar</Text>
              <View style={styles.avatarRow}>
                {SAMPLE_AVATARS.map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setRegPhoto(url)}
                    style={[
                      styles.avatarSelectCircle,
                      regPhoto === url && styles.avatarSelectCircleActive
                    ]}
                  >
                    <Image source={{ uri: url }} style={styles.avatarThumb} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name or Team Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Rajesh Sharma"
                placeholderTextColor="#9ca3af"
                value={regName}
                onChangeText={setRegName}
              />

              {/* Category Picker */}
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

              {/* Pricing Structure Multi-Select */}
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

              {/* Rates amount inputs for chosen options */}
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

              {/* City and State */}
              <View style={styles.twoColumnRow}>
                <View style={styles.columnHalf}>
                  <Text style={styles.inputLabel}>City *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={regCity}
                    onChangeText={setRegCity}
                  />
                </View>
                <View style={styles.columnHalf}>
                  <Text style={styles.inputLabel}>State *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={regState}
                    onChangeText={setRegState}
                  />
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

              {/* Key Skills */}
              <Text style={styles.inputLabel}>
                Specializations & Skills (Optional)
              </Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Motor repair, CPVC fitting, Bathroom fixtures"
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
                  ✓ Register & Publish Profile
                </Text>
              </TouchableOpacity>
            </View>
          )}
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
            <View style={styles.navCountBadge}>
              <Text style={styles.navCountBadgeText}>{workers.length}</Text>
            </View>
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
    padding: 16,
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
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 20
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16
  },
  emptyButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13
  },
  workerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  workerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#e5e7eb'
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  workerDetails: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  workerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827'
  },
  verifiedBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  workerCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginTop: 1
  },
  vehicleTypeTag: {
    fontSize: 11,
    fontWeight: '500',
    color: '#047857',
    marginTop: 1
  },
  workerLocation: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10
  },
  rateLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textTransform: 'uppercase'
  },
  rateValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827'
  },
  rateUnit: {
    fontSize: 11,
    fontWeight: 'normal',
    color: '#6b7280'
  },
  callButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
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
  avatarRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6
  },
  avatarSelectCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden'
  },
  avatarSelectCircleActive: {
    borderColor: '#059669'
  },
  avatarThumb: {
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
