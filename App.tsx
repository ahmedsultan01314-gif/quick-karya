import React, { useState, useEffect } from 'react';
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
  ActivityIndicator
} from 'react-native';
import WebApp from './src/App';
import { INITIAL_WORKERS } from './src/data/initialWorkers';
import { CATEGORIES } from './src/data/categories';
import { WorkerProfile, ServiceCategory } from './src/types';

function NativeApp() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [workers, setWorkers] = useState<WorkerProfile[]>(INITIAL_WORKERS);

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
          onPress={() => setSelectedCategory('Emergency Highway Assistance')}
          style={styles.sosButton}
        >
          <Text style={styles.sosText}>⚠️ Highway SOS</Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
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
              All
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => (
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
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Workers List */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        <Text style={styles.sectionTitle}>
          Nearby Available Artisans ({filteredWorkers.length})
        </Text>

        {filteredWorkers.map((worker) => (
          <View key={worker.id} style={styles.workerCard}>
            <View style={styles.workerHeader}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{worker.name.charAt(0)}</Text>
              </View>
              <View style={styles.workerDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  {worker.verified && (
                    <Text style={styles.verifiedBadge}>✓ Verified</Text>
                  )}
                </View>
                <Text style={styles.workerCategory}>{worker.category}</Text>
                <Text style={styles.workerLocation}>
                  📍 {worker.city}, {worker.state} • {worker.experience} yrs exp
                </Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.rateLabel}>Service Rate</Text>
                <Text style={styles.rateValue}>
                  ₹{worker.hourlyRate || worker.rate}
                  <Text style={styles.rateUnit}> {worker.rateUnit || '/hr'}</Text>
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
        ))}
      </ScrollView>
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
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
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
    paddingBottom: 40
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  workerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
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
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b981',
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
  }
});
