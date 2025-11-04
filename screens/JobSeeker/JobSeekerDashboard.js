// ... keep all your existing imports
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Modal
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { getRequest } from '../../services/api';
import { getToken } from '../../services/Auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';


const ITEMS_PER_PAGE = 5;

const JobSeekerDashboard = ({ navigation, route }) => {
  const [token, setToken] = useState(null);
  const [name, setName] = useState('');
  const [matches, setMatches] = useState([]);
  const [applications, setApplications] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [jobsPage, setJobsPage] = useState(1);
  const [userLat, setUserLat] = useState(null);
  const [userLon, setUserLon] = useState(null);
  const USER_LOCATION_KEY = "user_coords";

  // Filters
  const [radiusKm, setRadiusKm] = useState(10); // default 10km
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_on');
  const [sortOrder, setSortOrder] = useState('desc');

  const [showSortDropdown, setShowSortDropdown] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Auth' }],
        });
      }
    };
    checkAuth();
  }, [navigation]);

    useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchData);
    if (route.params?.refreshApplications) {
      fetchData();
    }
    fetchData();
    return unsubscribe;
  }, [navigation, route.params]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const fetchName = async (authToken) => {
    try {
      const res = await getRequest('/me', authToken);
      const user = res.data;

      setName(res.data.name);
      setUserLat(user.latitude);
      setUserLon(user.longitude);
    } catch (error) {
      console.warn('Failed to fetch name:', error);
    }
  };

  // --- fetchAndCacheUserCoords (returns { lat, lon }) ---
  const fetchAndCacheUserCoords = async (authToken) => {
    try {
      // 1) Try cached coords first
      const cached = await AsyncStorage.getItem(USER_LOCATION_KEY);
      let lat = null, lon = null;

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.lat && parsed?.lon) {
            lat = parsed.lat;
            lon = parsed.lon;
            setUserLat(lat);
            setUserLon(lon);
            console.log("✅ Loaded cached coords:", lat, lon);
          }
        } catch (e) {
          console.log("⚠️ Failed parsing cached coords:", e);
        }
      }

      // 2) Fetch fresh profile from /me (prefer this)
      // Pass authToken if available to getRequest
      const res = await getRequest('/me', authToken);
      const freshLat = res?.data?.latitude;
      const freshLon = res?.data?.longitude;

      if (freshLat && freshLon) {
        setUserLat(freshLat);
        setUserLon(freshLon);

        // cache as numbers
        await AsyncStorage.setItem(USER_LOCATION_KEY, JSON.stringify({
          lat: freshLat,
          lon: freshLon
        }));

        console.log("📍 Updated & cached coords:", freshLat, freshLon);
        return { lat: freshLat, lon: freshLon };
      }

      // no fresh coords, return whatever we had (possibly null)
      return { lat, lon };
    } catch (err) {
      console.log("❌ Failed to fetch or cache user coords:", err);
      return { lat: null, lon: null };
    }
  };

  // --- fetchAllJobs (now accepts coordinates and token) ---
  const fetchAllJobs = async (lat = null, lon = null, authToken = null) => {
    setLoadingJobs(true);
    try {
      // Build base URL (your backend is /get-jobs)
      let url = `/get-jobs?sort_by=${sortBy}&sort_order=${sortOrder}`;

      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      if (positionFilter) url += `&position=${encodeURIComponent(positionFilter)}`;
      if (locationFilter) url += `&location=${encodeURIComponent(locationFilter)}`;

      // prefer explicit params, fall back to state
      const useLat = lat ?? userLat;
      const useLon = lon ?? userLon;

      if (useLat && useLon) {
        url += `&lat=${useLat}&lon=${useLon}`;
      }
      if (radiusKm) url += `&radius=${radiusKm}`;

      console.log("➡️ Fetching jobs with URL:", url, "token present:", !!authToken);

      // pass authToken to getRequest if available
      const res = await getRequest(url, authToken);

      // Defensive logging of the full response
      console.log("FULL JOB RESPONSE:", res?.data);

      // Accept either { jobs: [...] } or an array directly
      const jobs = res?.data?.jobs ?? res?.data ?? [];
      if (!Array.isArray(jobs)) {
        console.warn("⚠️ Response jobs is not an array. Setting jobs to empty array.");
        setAllJobs([]);
      } else {
        setAllJobs(jobs);
        console.log("JOB SAMPLE:", jobs[0]);
      }

      setJobsPage(1);
    } catch (error) {
      console.error('Error fetching all jobs:', error);
      Alert.alert('Error', 'Failed to fetch job listings');
    } finally {
      setLoadingJobs(false);
    }
  };

  // --- fetchData (waits for coords and then calls fetchAllJobs with token) ---
  const fetchData = async () => {
    try {
      const t = await getToken();
      setToken(t);

      // fetch basic profile/name (keeps UI responsive)
      await fetchName(t);

      // fetch matches in parallel (optional) but we still await for proper ordering
      await fetchMatches(t);

      // fetch coords (returns { lat, lon })
      const { lat, lon } = await fetchAndCacheUserCoords(t);

      // finally fetch jobs using coords + auth token
      await fetchAllJobs(lat, lon, t);
    } catch (err) {
      console.log("❌ fetchData error:", err);
    }
  };



  const fetchMatches = async (authToken) => {
    setLoadingMatches(true);
    try {
      const res = await getRequest('/match-jobs', authToken);
      setMatches(res.data || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoadingMatches(false);
    }
  };

  const topMatches = matches.slice(0, 3);
  const handleSearch = () => fetchAllJobs();

  const handleSortSelect = (option) => {
    setSortBy(option.value);
    setSortOrder(option.order);
    setShowSortDropdown(false);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setPositionFilter('');
    setLocationFilter('');
    setSortBy('created_on');
    setSortOrder('desc');
    setJobsPage(1);
  };

  const hasActiveFilters = () => {
    return searchQuery || positionFilter || locationFilter || sortBy !== 'created_on' || sortOrder !== 'desc';
  };

  const sortOptions = [
    { label: 'Newest', value: 'created_on', order: 'desc' },
    { label: 'Oldest', value: 'created_on', order: 'asc' },
    { label: 'Title A-Z', value: 'title', order: 'asc' },
    { label: 'Title Z-A', value: 'title', order: 'desc' },
  ];

  const paginatedJobs = allJobs.slice((jobsPage - 1) * ITEMS_PER_PAGE, jobsPage * ITEMS_PER_PAGE);

  const renderDropdown = (visible, setVisible, options, onSelect, selectedValue, isSort = false) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
        <View style={styles.dropdownContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.value + (option.order || '')}
              style={[styles.dropdownItem, index === options.length - 1 && styles.dropdownItemLast]}
              onPress={() => onSelect(option)}
            >
              <Text style={styles.dropdownItemText}>{option.label}</Text>
              {isSort ? (
                option.value === sortBy && option.order === sortOrder && (
                  <Ionicons name="checkmark" size={16} color="#5271ff" />
                )
              ) : (
                option.value === selectedValue && (
                  <Ionicons name="checkmark" size={16} color="#5271ff" />
                )
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Text style={styles.header}>Welcome, {name}</Text>

        {/* AI Job Matches Section */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>AI Job Matches</Text>
            <View style={styles.matchHeaderActions}>
              <TouchableOpacity onPress={() => fetchMatches(token)}>
                <MaterialIcons name="refresh" size={20} color="#5271ff" />
              </TouchableOpacity>
              {matches.length > 3 && (
                <TouchableOpacity
                  style={styles.seeMoreButton}
                  onPress={() => navigation.navigate('AllAIMatchesScreen', { matches })}
                >
                  <Text style={styles.seeMoreText}>See All</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {loadingMatches ? (
            <ActivityIndicator size="small" color="#5271ff" style={styles.loader} />
          ) : topMatches.length === 0 ? (
            <Text style={styles.emptyText}>No job matches found</Text>
          ) : (
            <>
              {topMatches.map((job) => (
                <TouchableOpacity
                  key={job.job_id}
                  onPress={() => navigation.navigate('JobDetails', { job })}
                  style={styles.item}
                >
                  <Text style={styles.jobTitle}>{job.title}</Text>
                  <Text style={styles.company}>{job.company}</Text>
                  {job.match_percentage && (
                    <View style={styles.matchContainer}>
                      <Text style={styles.matchPercentage}>{job.match_percentage}% Match</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {/* Job Search Section */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>Search for Jobs</Text>
            {hasActiveFilters() && (
              <TouchableOpacity onPress={clearAllFilters}>
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search jobs, companies, or keywords..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Position and Location Inputs */}
          <View style={styles.filterRow}>
            <View style={styles.locationInputContainer}>
              <Ionicons name="briefcase-outline" size={16} color="#5271ff" />
              <TextInput
                style={styles.locationInput}
                placeholder="Position"
                value={positionFilter}
                onChangeText={setPositionFilter}
                onSubmitEditing={handleSearch}
              />
            </View>

            <View style={styles.locationInputContainer}>
              <Ionicons name="location-outline" size={16} color="#5271ff" />
              <TextInput
                style={styles.locationInput}
                placeholder="Location"
                value={locationFilter}
                onChangeText={setLocationFilter}
                onSubmitEditing={handleSearch}
              />
            </View>

            
          </View>

          {/* Radius Filter */}
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', marginBottom: 6 }}>
              Search Radius: {radiusKm} km
            </Text>

            <Slider
              minimumValue={1}
              maximumValue={100}
              step={1}
              value={radiusKm}
              onValueChange={(value) => setRadiusKm(value)}
              minimumTrackTintColor="#5271ff"
              style={{ width: '100%' }}
            />

            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              Drag to change search radius
            </Text>
          </View>


          {/* Sort Filter */}
          <View style={styles.sortRow}>
            <TouchableOpacity style={styles.filterButton} onPress={() => setShowSortDropdown(true)}>
              <Ionicons name="filter" size={16} color="#5271ff" />
              <Text style={styles.filterText}>
                {sortOptions.find((opt) => opt.value === sortBy && opt.order === sortOrder)?.label || 'Sort'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#5271ff" />
            </TouchableOpacity>
          </View>

          {/* Job List */}
          {loadingJobs ? (
            <ActivityIndicator size="small" color="#5271ff" style={styles.loader} />
          ) : (
            <>
              {paginatedJobs.length === 0 ? (
                <Text style={styles.emptyText}>
                  {hasActiveFilters() ? 'No jobs found matching your filters' : 'No jobs available'}
                </Text>
              ) : (
                <>
                  {paginatedJobs.map((item) => (
                    <TouchableOpacity
                      key={item.job_id}
                      onPress={() => navigation.navigate('JobDetails', { job: item })}
                      style={styles.item}
                    >
                      <Text style={styles.jobTitle}>{item.title}</Text>
                      <Text style={styles.company}>{item.company}</Text>
                      
                      <Text style={styles.location}>
                        {item.location}
                        {item.distance_km != null && (
                          <Text style={styles.distance}> • {item.distance_km.toFixed(1)} km away</Text>
                        )}
                      </Text>
                      {item.position && <Text style={styles.position}>{item.position}</Text>}
                      
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}
        </View>

        {renderDropdown(showSortDropdown, setShowSortDropdown, sortOptions, handleSortSelect, null, true)}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};


const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  matchHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
  },
  distance: {
    fontSize: 13,
    color: '#5271ff',
    fontWeight: '500',
    marginBottom: 4,
  },
  searchButton: {
    backgroundColor: '#5271ff',
    paddingHorizontal: 15,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  sortRow: {
    marginBottom: 15,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 6,
  },
  activeFilterButton: {
    backgroundColor: '#5271ff',
    borderColor: '#5271ff',
  },
  filterText: {
    fontSize: 13,
    color: '#5271ff',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  locationInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  locationInput: {
    flex: 1,
    paddingVertical: 8,
    marginLeft: 6,
  },
  clearFiltersText: {
    color: '#5271ff',
    fontSize: 14,
    fontWeight: '500',
  },
  item: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  company: {
    fontSize: 14,
    color: '#5271ff',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  position: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  matchPercentage: {
    color: '#5271ff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  loader: {
    marginVertical: 20,
  },
  seeMoreButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#5271ff',
  },
  seeMoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Dropdown styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    paddingTop: 100,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    elevation: 5,
    paddingVertical: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  pagination: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 15,
  },
  paginationButton: {
  padding: 8,
  },
  paginationButtonText: {
  color: '#5271ff',
  fontSize: 14,
  },
  pageText: {
  color: '#666',
  fontSize: 14,
  },
});

export default JobSeekerDashboard;
