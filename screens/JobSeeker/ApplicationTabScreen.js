// screens/JobSeeker/ApplicationTabScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { getRequest } from "../../services/api";


export default function ApplicationTabScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("applied_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [pinned, setPinned] = useState("");

  // Dropdown states
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showPinnedDropdown, setShowPinnedDropdown] = useState(false);

  // Status options
  const statusOptions = [
  { label: "All Statuses", value: "" },
  { label: "Submitted", value: "submitted" },
  { label: "Viewed", value: "viewed" },
  { label: "Under Review", value: "under_review" },
  { label: "Interview", value: "interview_scheduled" },
  { label: "Accepted", value: "accepted" },
  { label: "Rejected", value: "rejected" },
];

  // Sort options
  const sortOptions = [
    { label: "Newest", value: "applied_at", order: "desc" },
    { label: "Oldest", value: "applied_at", order: "asc" },
    { label: "Status A-Z", value: "status", order: "asc" },
    { label: "Status Z-A", value: "status", order: "desc" },
  ];

  // Pinned options
  const pinnedOptions = [
    { label: "All", value: "" },
    { label: "Pinned", value: "pinned" },
    { label: "Unpinned", value: "unpinned" },
  ];

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      let url = `/job-seeker/applications?sort_by=${sortBy}&sort_order=${sortOrder}`;

      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (status) url += `&status=${status}`;
      if (pinned === "pinned") url += `&pinned=true`;
      if (pinned === "unpinned") url += `&pinned=false`;

      const res = await getRequest(url, token);
      const data = res.data?.applications || [];
      setApplications(data);
    } catch (error) {
      console.error("❌ Error fetching applications:", error);
      setApplications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearch(searchInput);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (isFocused) fetchApplications();
  }, [isFocused, search, status, sortBy, sortOrder, pinned]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchApplications();
  }, []);

  const handleStatusSelect = (selectedStatus) => {
    setStatus(selectedStatus.value);
    setShowStatusDropdown(false);
  };

  const handleSortSelect = (option) => {
    setSortBy(option.value);
    setSortOrder(option.order);
    setShowSortDropdown(false);
  };

  const handlePinnedSelect = (option) => {
    setPinned(option.value);
    setShowPinnedDropdown(false);
  };

  const clearAllFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setSortBy("applied_at");
    setSortOrder("desc");
    setPinned("");
  };

  const hasActiveFilters = () => {
    return search || status || pinned || sortBy !== "applied_at" || sortOrder !== "desc";
  };

  const getStatusLabel = () => {
    const option = statusOptions.find(opt => opt.value === status);
    return option ? option.label : "Status";
  };

  const getSortLabel = () => {
    const option = sortOptions.find(opt => 
      opt.value === sortBy && opt.order === sortOrder
    );
    return option ? option.label : "Sort";
  };

  const getPinnedLabel = () => {
    const option = pinnedOptions.find(opt => opt.value === pinned);
    return option ? option.label : "Pinned";
  };

  const getPinnedIcon = () => {
    switch (pinned) {
      case "pinned":
        return "bookmark";
      case "unpinned":
        return "bookmark-outline";
      default:
        return "bookmarks-outline";
    }
  };

  const handleApplicationPress = (application) => {
    navigation.navigate("ApplicationDetails", { application });
  };

  const getStatusColor = (status) => {
  switch ((status || "").toLowerCase()) {
    case "submitted":
      return "#6c757d"; // gray
    case "viewed":
      return "#5271ff"; // blue
    case "under_review":
      return "#ffb84d"; // amber
    case "interview_scheduled":
      return "#17a2b8"; // teal
    case "accepted":
      return "#28a745"; // green
    case "rejected":
      return "#dc3545"; // red
    default:
      return "#adb5bd"; // light gray fallback
  }
};

const formatStatusLabel = (status) => {
  if (!status) return "Submitted";

  const normalized = status.replace(/_/g, " ").trim().toLowerCase();

  if (normalized === "interview scheduled") return "Interview";

  // Capitalize first letter of each word
  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleApplicationPress(item)}
    >
      <Text style={styles.jobTitle}>
        {item.jobs?.title || "Unknown Position"}
      </Text>
      <Text style={styles.company}>{item.jobs?.company || "Unknown Company"}</Text>
      <Text style={styles.date}>
        Applied on: {new Date(item.applied_at).toLocaleDateString()}
      </Text>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{formatStatusLabel(item.status)}</Text>
        </View>
        <Text style={styles.viewIndicator}>Tap to view →</Text>
      </View>
    </TouchableOpacity>
  );

  const renderDropdown = (visible, setVisible, options, onSelect, selectedValue, isSort = false) => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setVisible(false)}
      >
        <View style={styles.dropdownContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.value + (option.order || "")}
              style={[
                styles.dropdownItem,
                index === options.length - 1 && styles.dropdownItemLast,
              ]}
              onPress={() => onSelect(option)}
            >
              <Text style={styles.dropdownItemText}>{option.label}</Text>
              {isSort ? (
                (option.value === sortBy && option.order === sortOrder) && (
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

  if (loading && !refreshing)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5271ff" />
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Applications</Text>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#555" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search job title, company, or location..."
          value={searchInput}
          onChangeText={setSearchInput}
          returnKeyType="search"
        />
        {searchInput ? (
          <TouchableOpacity onPress={() => setSearchInput("")}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter bar - 2-row grid layout */}
      <View style={styles.filterContainer}>
        {/* First Row: Status and Sort */}
        <View style={styles.filterRow}>
          {/* Status Dropdown */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              status && styles.activeFilterButton
            ]}
            onPress={() => setShowStatusDropdown(true)}
          >
            <Ionicons 
              name="flag-outline" 
              size={16} 
              color={status ? "#fff" : "#5271ff"} 
            />
            <Text style={[
              styles.filterText,
              status && styles.activeFilterText
            ]}>
              {getStatusLabel()}
            </Text>
            <Ionicons 
              name="chevron-down" 
              size={14} 
              color={status ? "#fff" : "#5271ff"} 
            />
          </TouchableOpacity>

          {/* Sort Dropdown */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              (sortBy !== "applied_at" || sortOrder !== "desc") && styles.activeFilterButton
            ]}
            onPress={() => setShowSortDropdown(true)}
          >
            <Ionicons 
              name="filter" 
              size={16} 
              color={(sortBy !== "applied_at" || sortOrder !== "desc") ? "#fff" : "#5271ff"} 
            />
            <Text style={[
              styles.filterText,
              (sortBy !== "applied_at" || sortOrder !== "desc") && styles.activeFilterText
            ]}>
              {getSortLabel()}
            </Text>
            <Ionicons 
              name="chevron-down" 
              size={14} 
              color={(sortBy !== "applied_at" || sortOrder !== "desc") ? "#fff" : "#5271ff"} 
            />
          </TouchableOpacity>
        </View>

        {/* Second Row: Pinned and Clear */}
        <View style={styles.filterRow}>
          {/* Pinned Dropdown */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              pinned && styles.activeFilterButton
            ]}
            onPress={() => setShowPinnedDropdown(true)}
          >
            <Ionicons
              name={getPinnedIcon()}
              size={16}
              color={pinned ? "#fff" : "#5271ff"}
            />
            <Text style={[
              styles.filterText,
              pinned && styles.activeFilterText
            ]}>
              {getPinnedLabel()}
            </Text>
            <Ionicons 
              name="chevron-down" 
              size={14} 
              color={pinned ? "#fff" : "#5271ff"} 
            />
          </TouchableOpacity>

          {/* Clear Filters Button - Always visible but disabled when no filters */}
          <TouchableOpacity
            style={[
              styles.clearFilterButton,
              !hasActiveFilters() && styles.clearFilterButtonDisabled
            ]}
            onPress={clearAllFilters}
            disabled={!hasActiveFilters()}
          >
            <Ionicons 
              name="close-circle" 
              size={16} 
              color={hasActiveFilters() ? "#ff6d6d" : "#ccc"} 
            />
            <Text style={[
              styles.clearFilterText,
              !hasActiveFilters() && styles.clearFilterTextDisabled
            ]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Filters Indicator */}
      {hasActiveFilters() && (
        <View style={styles.activeFiltersIndicator}>
          <Text style={styles.activeFiltersText}>
            {search && "Search • "}
            {status && "Status • "}
            {pinned && "Pinned • "}
            {(sortBy !== "applied_at" || sortOrder !== "desc") && "Sorted"}
          </Text>
        </View>
      )}

      {/* Dropdown Modals */}
      {renderDropdown(
        showStatusDropdown,
        setShowStatusDropdown,
        statusOptions,
        handleStatusSelect,
        status
      )}

      {renderDropdown(
        showSortDropdown,
        setShowSortDropdown,
        sortOptions,
        handleSortSelect,
        null,
        true
      )}

      {renderDropdown(
        showPinnedDropdown,
        setShowPinnedDropdown,
        pinnedOptions,
        handlePinnedSelect,
        pinned
      )}

      {/* List */}
      <FlatList
        data={applications}
        keyExtractor={(item) => item.application_id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#5271ff"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No applications found</Text>
            {hasActiveFilters() && (
              <TouchableOpacity onPress={clearAllFilters}>
                <Text style={styles.clearEmptyText}>Clear filters to see all applications</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", padding: 15 },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 12,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    marginLeft: 6,
    marginRight: 6,
  },
  filterContainer: {
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 6,
  },
  activeFilterButton: {
    backgroundColor: "#5271ff",
    borderColor: "#5271ff",
  },
  filterText: { 
    fontSize: 13, 
    color: "#5271ff", 
    fontWeight: '500',
  },
  activeFilterText: {
    color: "#fff",
  },
  clearFilterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#ff6d6d",
    gap: 6,
  },
  clearFilterButtonDisabled: {
    borderColor: "#e0e0e0",
  },
  clearFilterText: {
    fontSize: 13,
    color: "#ff6d6d",
    fontWeight: '500',
  },
  clearFilterTextDisabled: {
    color: "#ccc",
  },
  activeFiltersIndicator: {
    backgroundColor: "#E8F0FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  activeFiltersText: {
    fontSize: 12,
    color: "#5271ff",
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },
  jobTitle: { fontSize: 16, fontWeight: "600", color: "#333" },
  company: { fontSize: 14, color: "#5271ff" },
  date: { fontSize: 12, color: "#666", marginTop: 4 },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: { fontSize: 13, color: "#fff" },
  viewIndicator: {
    fontSize: 12,
    color: "#5271ff",
    fontStyle: "italic",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    textAlign: "center",
    color: "#777",
    marginTop: 16,
    fontSize: 16,
  },
  clearEmptyText: {
    textAlign: "center",
    color: "#5271ff",
    marginTop: 8,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  // Dropdown styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    paddingTop: 100,
  },
  dropdownContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 12,
    elevation: 5,
    paddingVertical: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },
});