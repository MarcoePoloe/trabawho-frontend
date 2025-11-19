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
    if (!searchQuery.trim()) return;

    try {
      setSearchLoading(true);
      setSearchResults([]);
      setSearchPage(1);

      const res = await getRequest(`/search/users?q=${encodeURIComponent(searchQuery)}`);

      if (res?.data?.results) {
        setSearchResults(res.data.results);
      } else {
        setSearchResults([]);
      }

    } catch (err) {
      console.error("Error fetching job seekers:", err);
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
                    style={styles.userItem}
                    onPress={() => 
                      navigation.navigate("ProfileDetail", { user_id: user.user_id })
                    }
                  >
                    <Image 
                      source={{ uri: user.photo }}
                      style={styles.userPhoto}
                    />
                    <Text style={styles.userName}>{user.name}</Text>
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
});

export default EmployerDashboard;
