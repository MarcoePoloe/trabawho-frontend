// screens/JobSeekerDashboard.js
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
  Modal,
  Image,
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

  // --- Employer Search state (new)
  const [employerQuery, setEmployerQuery] = useState('');
  const [employers, setEmployers] = useState([]);
  const [employersPage, setEmployersPage] = useState(1);
  const [loadingEmployers, setLoadingEmployers] = useState(false);
  const [employersTotal, setEmployersTotal] = useState(null);

  // Employer search filters
  const [employerIndustry, setEmployerIndustry] = useState('');
  const [employerWorkSetup, setEmployerWorkSetup] = useState(null);
  // values: 'onsite', 'hybrid', 'remote_friendly'
  const [employerLocation, setEmployerLocation] = useState('');
  const [employerSortNearest, setEmployerSortNearest] = useState(false);
  const [showEmployerFilters, setShowEmployerFilters] = useState(false);


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
      // await AsyncStorage.setItem('user_id', res.data.id);
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

      // pass authToken to getRequest if available
      const res = await getRequest(url, authToken);

      // Accept either { jobs: [...] } or an array directly
      const jobs = res?.data?.jobs ?? res?.data ?? [];
      if (!Array.isArray(jobs)) {
        console.warn("⚠️ Response jobs is not an array. Setting jobs to empty array.");
        setAllJobs([]);
      } else {
        setAllJobs(jobs);
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
      // ✅ First fetch coords (returns { lat, lon })
      const { lat, lon } = await fetchAndCacheUserCoords(t);

      // ✅ Wait until coords are definitely set before fetching matches
      if (lat && lon) {
        await fetchMatches(t, lat, lon);
      } else {
        console.log("⚠️ Skipping AI matches — no valid location found yet.");
      }

      // finally fetch jobs using coords + auth token
      await fetchAllJobs(lat, lon, t);
    } catch (err) {
      console.log("❌ fetchData error:", err);
    }
  };

  const fetchMatches = async (authToken, lat = null, lon = null) => {
    setLoadingMatches(true);
    try {
      let url = '/match-jobs';

      // ✅ always use latest coords, not possibly stale state
      const useLat = lat ?? userLat;
      const useLon = lon ?? userLon;

      if (useLat && useLon) {
        url += `?lat=${useLat}&lon=${useLon}`;
      } else {
        console.log("⚠️ No coords available for AI matches");
      }

      const res = await getRequest(url, authToken);
      setMatches(res.data || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoadingMatches(false);
    }
  };

  // --- Employer search function (NEW)
  const fetchEmployers = async () => {
    setLoadingEmployers(true);

    try {
      let url = `/search/employers?`;

      if (employerQuery) url += `q=${encodeURIComponent(employerQuery)}&`;
      if (employerIndustry) url += `industry=${encodeURIComponent(employerIndustry)}&`;
      if (employerWorkSetup) url += `work_setup_policy=${encodeURIComponent(employerWorkSetup)}&`;
      if (employerLocation) url += `location=${encodeURIComponent(employerLocation)}&`;

      // radius already available from job search (reuse it)
      if (radiusKm) url += `radius_km=${radiusKm}&`;

      // sort by nearest toggle
      if (employerSortNearest) url += `sort_by_distance=true&`;

      const res = await getRequest(url);
      const results = Array.isArray(res?.data?.results) ? res.data.results : [];

      setEmployers(results);
      setEmployersTotal(results.length);
      setEmployersPage(1);

    } catch (err) {
      console.error("Error fetching employers:", err);
      Alert.alert("Error", "Failed to search employers.");
    } finally {
      setLoadingEmployers(false);
    }
  };


  const paginatedEmployers = employers.slice(
    (employersPage - 1) * ITEMS_PER_PAGE,
    employersPage * ITEMS_PER_PAGE
  );


  // Handler when user taps an employer row
  const handleEmployerPress = (item) => {
    const userId = item.user_id ?? item.id ?? item.employer_id;
    if (!userId) {
      Alert.alert('Error', 'Selected employer has no ID');
      return;
    }
    navigation.navigate('ProfileDetail', { user_id: userId });
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {job.match_percentage != null && (
                      <Text style={styles.matchPercentage}>{job.match_percentage}% Match</Text>
                    )}

                    {job.distance_km != null && (
                      <Text style={styles.distance}>
                        • {job.distance_km.toFixed(1)} km away
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {/* SEARCH EMPLOYERS SECTION */}
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>Search Employers</Text>
          </View>

          {/* Keyword Search */}
          <View style={{ flexDirection: "row", marginBottom: 12 }}>
            <TextInput
              style={[styles.searchInput, { flex: 1 }]}
              placeholder="Search by employer name..."
              value={employerQuery}
              onChangeText={setEmployerQuery}
              onSubmitEditing={fetchEmployers}
            />
            <TouchableOpacity
              style={[styles.searchButton, { marginLeft: 8 }]}
              onPress={fetchEmployers}
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {/* Filter dropdown toggle */}
<TouchableOpacity
  onPress={() => setShowEmployerFilters(!showEmployerFilters)}
  style={{ marginBottom: 12 }}
>
  <Text style={{ color: "#5271ff", fontWeight: "600" }}>
    {showEmployerFilters ? "Hide Filters ▲" : "Show Filters ▼"}
  </Text>
</TouchableOpacity>

{showEmployerFilters && (
  <View style={styles.filtersContainer}>
          {/* Filters */}
          <View style={{ marginBottom: 12 }}>
            {/* Industry */}
            <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
              Industry
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. Technology, Healthcare, Retail"
              value={employerIndustry}
              onChangeText={setEmployerIndustry}
              onSubmitEditing={fetchEmployers}
            />
          </View>

          {/* Work Setup Dropdown */}
          <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
            Work Setup Policy
          </Text>

          <View style={[styles.searchInput, { padding: 0 }]}>
            {["onsite", "hybrid", "remote_friendly"].map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => {
                  if (employerWorkSetup === option) {
                    // unselect if clicked again
                    setEmployerWorkSetup(null);
                  } else {
                    setEmployerWorkSetup(option);
                  }
                }}
                style={{
                  padding: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text>
                  {option === "onsite"
                    ? "Onsite"
                    : option === "hybrid"
                      ? "Hybrid"
                      : "Remote Friendly"}
                </Text>
                {employerWorkSetup === option && (
                  <MaterialIcons name="check" size={18} color="#5271ff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Location Filter */}
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
              Location
            </Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter city or address..."
              value={employerLocation}
              onChangeText={setEmployerLocation}
              onSubmitEditing={fetchEmployers}
            />
          </View>

          {/* Sort by Nearest Toggle */}
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}
            onPress={() => setEmployerSortNearest(!employerSortNearest)}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: 2,
                borderColor: "#5271ff",
                marginRight: 10,
                borderRadius: 4,
                backgroundColor: employerSortNearest ? "#5271ff" : "transparent",
              }}
            />
            <Text style={{ fontSize: 14, fontWeight: "500" }}>Sort by nearest</Text>
          </TouchableOpacity>
 </View>
)}
          {/* Employers List */}
          {loadingEmployers ? (
            <ActivityIndicator size="small" color="#5271ff" style={{ marginTop: 20 }} />
          ) : employers.length === 0 ? (
            <Text style={styles.emptyText}>No employers found.</Text>
          ) : (
            <>
              {paginatedEmployers.map((emp) => (
                <TouchableOpacity
                  key={emp.employer_id}
                  onPress={() => handleEmployerPress(emp)}
                  style={styles.employerRow}
                >
                  <Image
                    source={{ uri: emp.photo }}
                    style={styles.employerAvatar}
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600" }}>
                      {emp.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#777" }}>
                      {emp.industry || "Industry Not Set"}
                    </Text>

                    {emp.work_setup_policy && (
                      <Text style={{ fontSize: 12, color: "#5271ff", marginTop: 2 }}>
                        {emp.work_setup_policy === "onsite"
                          ? "Onsite"
                          : emp.work_setup_policy === "hybrid"
                            ? "Hybrid"
                            : "Remote Friendly"}
                      </Text>
                    )}

                    {emp.distance_km != null && (
                      <Text style={{ fontSize: 12, color: "#888" }}>
                        {emp.distance_km.toFixed(1)} km away
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}

              {/* Pagination */}
              <View style={styles.pagination}>
                <TouchableOpacity
                  disabled={employersPage <= 1}
                  onPress={() => setEmployersPage(employersPage - 1)}
                  style={styles.paginationButton}
                >
                  <Text style={styles.paginationButtonText}>Previous</Text>
                </TouchableOpacity>

                <Text style={styles.pageText}>
                  Page {employersPage} • {employersTotal} results
                </Text>

                <TouchableOpacity
                  disabled={employersPage * ITEMS_PER_PAGE >= employersTotal}
                  onPress={() => setEmployersPage(employersPage + 1)}
                  style={styles.paginationButton}
                >
                  <Text style={styles.paginationButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
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
  filtersContainer: {
  backgroundColor: "#ffffffda",
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: "#e5e5e5",
  marginBottom: 12,
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

  // --- employer result styles
  employerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  employerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eee',
  },
});

export default JobSeekerDashboard;
