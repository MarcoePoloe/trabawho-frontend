import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Image,
  TextInput
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { getRequest } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';

const ITEMS_PER_PAGE = 5;

const EmployerDashboard = ({ navigation }) => {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [jobsPage, setJobsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  // NEW STATES FOR SEARCHING JOB SEEKERS
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);

  // Advanced Filters
  const [locationFilter, setLocationFilter] = useState('');
  const [minExp, setMinExp] = useState('');
  const [maxExp, setMaxExp] = useState('');

  // Skills chip selector
  const [skillInput, setSkillInput] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [sortNearest, setSortNearest] = useState(false);
  const [sortExperience, setSortExperience] = useState(false);

  // Accordion toggle
  const [showFilters, setShowFilters] = useState(false);


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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) fetchData();
  }, [isFocused]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userRes = await getRequest('/me');
      setName(userRes.data.name);

      const jobsRes = await getRequest('/employer/jobs');
      setJobs(jobsRes.data.jobs || []);

    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔍 SEARCH JOB SEEKERS
  const handleSearch = async () => {
    try {
      setSearchLoading(true);
      setSearchResults([]);
      setSearchPage(1);

      const params = new URLSearchParams();

      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      if (locationFilter.trim()) params.append("location", locationFilter.trim());
      if (minExp.trim()) params.append("min_experience", minExp);
      if (maxExp.trim()) params.append("max_experience", maxExp);

      if (selectedSkills.length > 0) {
        params.append("skills", selectedSkills.join(","));
      }

      const res = await getRequest(`/search/jobseekers?${params.toString()}`);

      if (res?.data?.results) {
        let results = res.data.results;

        // Apply sorting by nearest
        if (sortNearest) {
          results = [...results].sort((a, b) => {
            if (a.distance_km == null && b.distance_km == null) return 0;
            if (a.distance_km == null) return 1;
            if (b.distance_km == null) return -1;
            return a.distance_km - b.distance_km;
          });
        }

        if (sortExperience) {
          results = [...results].sort((a, b) => {
            const expA = a.years_of_experience ?? -1;
            const expB = b.years_of_experience ?? -1;

            return expB - expA; // Highest first
          });
        }

        setSearchResults(results);
      } else {
        setSearchResults([]);
      }

    } catch (err) {
      console.error("Error searching job seekers:", err);
    } finally {
      setSearchLoading(false);
    }
  };



  const paginatedSearch = searchResults.slice(
    (searchPage - 1) * ITEMS_PER_PAGE,
    searchPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        <View style={styles.container}>
          <Text style={styles.welcome}>Welcome, {name}</Text>

          {/* ====================================================== */}
          {/* 🔍 SEARCH JOB SEEKERS CARD (NEW)                      */}
          {/* ====================================================== */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Search Job Seekers</Text>

            {/* Search Input Row */}
            <View style={styles.searchRow}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search job seeker by name..."
                style={styles.searchInput}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                <Text style={styles.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>

            {/* Toggle Advanced Filters */}
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              style={{ marginTop: 10 }}
            >
              <Text style={{ color: '#5271ff', fontWeight: '600' }}>
                {showFilters ? "Hide Filters ▲" : "Show Filters ▼"}
              </Text>
            </TouchableOpacity>

            {showFilters && (
              <View style={styles.filtersContainer}>

                {/* Location filter */}
                <TextInput
                  placeholder="Filter by location..."
                  value={locationFilter}
                  onChangeText={setLocationFilter}
                  style={styles.filterInput}
                />

                {/* Skills Chip Selector */}
                <TextInput
                  placeholder="Add skill..."
                  value={skillInput}
                  onChangeText={setSkillInput}
                  onSubmitEditing={() => {
                    if (skillInput.trim() !== '') {
                      setSelectedSkills([...selectedSkills, skillInput.trim()]);
                      setSkillInput('');
                    }
                  }}
                  style={styles.filterInput}
                />

                {/* Skills Preview */}
                <View style={styles.skillFilterRow}>
                  {selectedSkills.map((skill, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.skillBadgeFilter}
                      onPress={() =>
                        setSelectedSkills(selectedSkills.filter((s) => s !== skill))
                      }
                    >
                      <Text style={styles.skillTextFilter}>{skill} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Experience filters */}
                <View style={styles.expRow}>
                  <TextInput
                    placeholder="Min Exp"
                    keyboardType="numeric"
                    value={minExp}
                    onChangeText={(t) => setMinExp(t.replace(/[^0-9]/g, ''))}
                    style={[styles.filterInput, { flex: 1 }]}
                  />

                  <TextInput
                    placeholder="Max Exp"
                    keyboardType="numeric"
                    value={maxExp}
                    onChangeText={(t) => setMaxExp(t.replace(/[^0-9]/g, ''))}
                    style={[styles.filterInput, { flex: 1, marginLeft: 10 }]}
                  />
                </View>
                {/* Sort by Nearest Toggle */}
                <View style={styles.sortRow}>
                  <TouchableOpacity
                    onPress={() => setSortNearest(!sortNearest)}
                    style={styles.checkbox}
                  >
                    <View style={[styles.checkboxBox, sortNearest && styles.checkboxBoxChecked]} />
                    <Text style={styles.sortLabel}>Sort by nearest</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.sortRow}>
                  <TouchableOpacity
                    onPress={() => setSortExperience(!sortExperience)}
                    style={styles.checkbox}
                  >
                    <View style={[
                      styles.checkboxBox,
                      sortExperience && styles.checkboxBoxChecked
                    ]} />
                    <Text style={styles.sortLabel}>Sort by experience</Text>
                  </TouchableOpacity>
                </View>



              </View>
            )}



            {/* Search Loading */}
            {searchLoading && (
              <ActivityIndicator size="small" color="#5271ff" style={{ marginTop: 10 }} />
            )}

            {/* Results */}
            {!searchLoading && paginatedSearch.length > 0 && (
              <View style={{ marginTop: 10 }}>

                {paginatedSearch.map((user) => (
                  <TouchableOpacity
                    key={user.user_id}
                    style={styles.resultCard}
                    onPress={() =>
                      navigation.navigate("ProfileDetail", { user_id: user.user_id })
                    }
                  >
                    {/* LEFT: Profile Photo */}
                    <Image
                      source={{ uri: user.photo }}
                      style={styles.resultPhoto}
                    />

                    {/* RIGHT: Main Info */}
                    <View style={styles.resultInfo}>
                      {/* Name */}
                      <Text style={styles.resultName}>{user.name}</Text>

                      {/* Experience + Distance */}
                      <Text style={styles.resultMeta}>
                        {(user.years_of_experience != null
                          ? `${user.years_of_experience} yrs`
                          : "No exp")}
                        {user.distance_km != null ? ` • ${user.distance_km} km away` : ""}
                      </Text>

                      {/* Location */}
                      <Text style={styles.resultLocation}>
                        {user.location || "No location"}
                      </Text>

                      {/* Skills Preview (inline, condensed) */}
                      {user.skills?.length > 0 && (
                        <Text style={styles.resultSkills}>
                          {user.skills.slice(0, 4).join(" • ")}
                          {user.skills.length > 4 ? " • +" + (user.skills.length - 4) : ""}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                ))}


                {/* Pagination */}
                <View style={styles.pagination}>
                  <TouchableOpacity
                    onPress={() => setSearchPage((p) => Math.max(1, p - 1))}
                    disabled={searchPage === 1}
                  >
                    <Text style={styles.paginationButtonText}>Previous</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      setSearchPage((p) =>
                        p * ITEMS_PER_PAGE < searchResults.length ? p + 1 : p
                      )
                    }
                    disabled={searchPage * ITEMS_PER_PAGE >= searchResults.length}
                  >
                    <Text style={styles.paginationButtonText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ====================================================== */}
          {/* ACTIVE JOB LISTINGS (EXISTING)                         */}
          {/* ====================================================== */}

          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>Active Job Listings</Text>
              <TouchableOpacity onPress={() => navigation.navigate('JobCreationForm')}>
                <MaterialIcons name="add" size={24} color="#4A6FA5" />
              </TouchableOpacity>
            </View>

            {jobs.length === 0 ? (
              <Text style={styles.emptyText}>No jobs posted yet</Text>
            ) : (
              <>
                {jobs
                  .slice((jobsPage - 1) * ITEMS_PER_PAGE, jobsPage * ITEMS_PER_PAGE)
                  .map((job) => (
                    <TouchableOpacity
                      key={job.job_id}
                      onPress={() => navigation.navigate('PostedJobDetail', { job_id: job.job_id })}
                      style={styles.item}
                    >
                      <Text style={styles.jobTitle}>{job.title}</Text>
                      <Text style={styles.company}>{job.company}</Text>
                      <Text style={styles.location}>{job.location}</Text>
                    </TouchableOpacity>
                  ))}

                <View style={styles.pagination}>
                  <TouchableOpacity
                    onPress={() => setJobsPage((p) => Math.max(p - 1, 1))}
                    disabled={jobsPage === 1}
                  >
                    <Text style={styles.paginationButtonText}>Previous</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      setJobsPage((p) =>
                        p * ITEMS_PER_PAGE < jobs.length ? p + 1 : p
                      )
                    }
                    disabled={jobsPage * ITEMS_PER_PAGE >= jobs.length}
                  >
                    <Text style={styles.paginationButtonText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContainer: { flexGrow: 1, paddingBottom: 40 },
  container: { padding: 20 },

  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },

  /* --- Search Card Styles --- */
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchBtn: {
    backgroundColor: '#5271ff',
    paddingHorizontal: 15,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '600',
  },

  /* --- Search Result Item --- */
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userPhoto: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },

  /* Pagination */
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  paginationButtonText: {
    color: '#5271ff',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Jobs section */
  item: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  company: {
    fontSize: 14,
    color: '#4A6FA5',
  },
  location: {
    fontSize: 13,
    color: '#666',
  },

  emptyText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 20,
  },
  userMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  userMetaDistance: {
    fontSize: 13,
    color: '#5271ff',
    marginTop: 2,
  },

  skillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },

  skillBadge: {
    backgroundColor: '#5271ff20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderColor: '#5271ff50',
    borderWidth: 1,
  },

  skillText: {
    fontSize: 12,
    color: '#5271ff',
    fontWeight: '600',
  },

  skillMore: {
    fontSize: 12,
    color: '#555',
    alignSelf: 'center',
    marginLeft: 4,
  },

  filtersContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  filterInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    marginTop: 10,
  },

  skillFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },

  skillBadgeFilter: {
    backgroundColor: '#5271ff20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5271ff50',
  },

  skillTextFilter: {
    color: '#5271ff',
    fontWeight: '600',
  },

  expRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  resultPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eee',
  },

  resultInfo: {
    flex: 1,
    flexDirection: 'column',
  },

  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },

  resultMeta: {
    marginTop: 2,
    fontSize: 13,
    color: '#666',
  },

  resultLocation: {
    marginTop: 2,
    fontSize: 13,
    color: '#777',
  },

  resultSkills: {
    marginTop: 6,
    fontSize: 13,
    color: '#5271ff',
    fontWeight: '600',
    flexWrap: 'wrap',
  },
  resultCardA: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "flex-start",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  resultPhotoA: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#eee",
  },
  resultInfoA: { flex: 1 },
  resultNameA: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  resultMetaA: {
    marginTop: 2,
    fontSize: 13,
    color: "#666",
  },
  resultLocationA: { marginTop: 2, fontSize: 13, color: "#777" },
  resultSkillsA: {
    marginTop: 6,
    fontSize: 13,
    color: "#5271ff",
    fontWeight: "600",
    flexWrap: "wrap",
  },
  resultCardB: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  resultHeaderB: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  resultPhotoB: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#eee",
  },
  resultNameB: { fontSize: 17, fontWeight: "700", color: "#333" },
  resultMetaB: { marginTop: 2, fontSize: 13, color: "#666" },
  resultLocationB: { fontSize: 13, color: "#777", marginTop: 2 },
  skillRowB: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  skillBadgeB: {
    backgroundColor: "#eef1ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  skillTextB: { color: "#5271ff", fontWeight: "600", fontSize: 12 },
  skillMoreB: { fontSize: 12, color: "#555", alignSelf: "center" },
  resultCardC: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  resultNameC: { fontSize: 16, fontWeight: "700", color: "#333" },
  resultMetaC: { fontSize: 13, color: "#666", marginTop: 2 },
  resultLocationC: { fontSize: 13, color: "#777", marginTop: 2 },
  resultSkillsC: {
    marginTop: 6,
    fontSize: 13,
    color: "#5271ff",
    fontWeight: "600",
  },
  resultCardD: {
    flexDirection: "row",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    elevation: 2,
  },
  resultPhotoD: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#eee",
  },
  resultNameD: { fontSize: 16, fontWeight: "700", color: "#333" },
  resultMetaD: { marginTop: 2, fontSize: 13, color: "#666" },
  skillRowD: { flexDirection: "row", gap: 6, marginTop: 6 },
  skillBadgeD: {
    backgroundColor: "#eef1ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  skillTextD: { color: "#5271ff", fontWeight: "600", fontSize: 12 },
  sortRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#5271ff',
    marginRight: 10,
  },

  checkboxBoxChecked: {
    backgroundColor: '#5271ff',
  },

  sortLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },




});

export default EmployerDashboard;
