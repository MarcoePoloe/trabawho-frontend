import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { postRequest } from '../../services/api';
import LocationPicker from '../../components/LocationPicker';

const JobCreationFormScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    salary: '',
    position: '',
    description: '',
  });

  const [salaryType, setSalaryType] = useState('fixed'); // 'fixed' | 'range'
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryError, setSalaryError] = useState('');
  const [locationData, setLocationData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Live validation effect
  useEffect(() => {
    const validate = () => {
      if (!formData.title.trim()) return false;
      if (!formData.description.trim()) return false;
      if (!locationData) return false;

      if (salaryType === 'fixed') {
        return formData.salary.trim() !== '';
      }

      if (!salaryMin.trim() || !salaryMax.trim()) return false;

      const minVal = parseInt(salaryMin, 10);
      const maxVal = parseInt(salaryMax, 10);

      if (isNaN(minVal) || isNaN(maxVal)) {
        setSalaryError('Enter valid numeric values');
        return false;
      }
      if (minVal >= maxVal) {
        setSalaryError('Minimum salary must be lower than maximum salary');
        return false;
      }

      setSalaryError('');
      return true;
    };

    setIsValid(validate());
  }, [formData, salaryMin, salaryMax, salaryType, locationData]);

  const handleSubmit = async () => {
    if (!isValid) return;

    let formattedSalary = '';
    if (salaryType === 'fixed') {
      formattedSalary = `₱${formData.salary}`;
    } else {
      formattedSalary = `₱${parseInt(salaryMin).toLocaleString()} - ₱${parseInt(
        salaryMax
      ).toLocaleString()}`;
    }

    try {
      setSubmitting(true);

      const response = await postRequest('/jobs', {
        title: formData.title,
        company: formData.company,
        location: formData.location,
        description: formData.description,
        salary: formattedSalary,
        position: formData.position,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        geocoded_address: locationData.geocoded_address,
      });

      const jobId = response.data?.job_id || response.data?.data?.job_id;
      if (!jobId) throw new Error('Job ID not received from server');

      navigation.replace('PostedJobDetail', { job_id: jobId });
    } catch (error) {
      console.error('Job creation error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.formCard}>
        {/* Job Title */}
        <Text style={styles.label}>Job Title *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(text) => handleChange('title', text)}
          placeholder="Enter job title"
          placeholderTextColor="#999"
        />

        {/* Position */}
        <Text style={styles.label}>Position *</Text>
        <TextInput
          style={styles.input}
          value={formData.position}
          onChangeText={(text) => handleChange('position', text)}
          placeholder="Enter position"
          placeholderTextColor="#999"
        />

        {/* Salary */}
        <Text style={styles.label}>Salary *</Text>
        <View style={styles.salaryTypeContainer}>
          <TouchableOpacity
            style={[
              styles.salaryTypeButton,
              salaryType === 'fixed' && styles.salaryTypeButtonActive,
            ]}
            onPress={() => setSalaryType('fixed')}
          >
            <Text
              style={[
                styles.salaryTypeText,
                salaryType === 'fixed' && styles.salaryTypeTextActive,
              ]}
            >
              Fixed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.salaryTypeButton,
              salaryType === 'range' && styles.salaryTypeButtonActive,
            ]}
            onPress={() => setSalaryType('range')}
          >
            <Text
              style={[
                styles.salaryTypeText,
                salaryType === 'range' && styles.salaryTypeTextActive,
              ]}
            >
              Range
            </Text>
          </TouchableOpacity>
        </View>

        {salaryType === 'fixed' ? (
          <TextInput
            style={styles.input}
            value={formData.salary}
            onChangeText={(text) =>
              handleChange('salary', text.replace(/\D/g, ''))
            }
            placeholder="Enter fixed salary (₱)"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        ) : (
          <View style={styles.salaryRangeContainer}>
            <TextInput
              style={[styles.input, styles.salaryInputHalf]}
              value={salaryMin}
              onChangeText={(text) => setSalaryMin(text.replace(/\D/g, ''))}
              placeholder="Min (₱)"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            <Text style={styles.toText}>to</Text>
            <TextInput
              style={[styles.input, styles.salaryInputHalf]}
              value={salaryMax}
              onChangeText={(text) => setSalaryMax(text.replace(/\D/g, ''))}
              placeholder="Max (₱)"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
        )}

        {!!salaryError && <Text style={styles.errorText}>{salaryError}</Text>}

        {/* Company Name */}
        <Text style={styles.label}>Company Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.company}
          onChangeText={(text) => handleChange('company', text)}
          placeholder="Enter company name"
          placeholderTextColor="#999"
        />

        {/* Location */}
        <Text style={styles.label}>Location *</Text>
        <TextInput
          style={styles.input}
          value={formData.location}
          onChangeText={(text) => handleChange('location', text)}
          placeholder="Enter job location"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Map Location *</Text>
        <LocationPicker onLocationPicked={setLocationData} />

        {/* Description */}
        <Text style={styles.label}>Job Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => handleChange('description', text)}
          placeholder="Describe the job responsibilities, requirements, etc."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Publish</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 16 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: { height: 150, textAlignVertical: 'top' },
  salaryTypeContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  salaryTypeButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#5271ff',
    borderRadius: 8,
    alignItems: 'center',
  },
  salaryTypeButtonActive: { backgroundColor: '#5271ff' },
  salaryTypeText: { color: '#5271ff', fontWeight: '600' },
  salaryTypeTextActive: { color: '#fff' },
  salaryRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  salaryInputHalf: { flex: 1 },
  toText: { color: '#555', fontWeight: '600' },
  errorText: {
    color: '#dc3545',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#4A6FA5',
    padding: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default JobCreationFormScreen;
