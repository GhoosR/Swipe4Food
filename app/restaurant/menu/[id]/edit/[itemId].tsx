import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Save, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/supabaseApi';

const COMMON_CATEGORIES = [
  'Appetizers',
  'Soups',
  'Salads',
  'Main Courses',
  'Pasta',
  'Pizza',
  'Seafood',
  'Meat & Poultry',
  'Vegetarian',
  'Desserts',
  'Beverages',
  'Wine & Spirits',
  'Coffee & Tea',
  'Kids Menu',
];

export default function EditMenuItemScreen() {
  const router = useRouter();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuItem, setMenuItem] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    customCategory: '',
    is_available: true,
  });

  useEffect(() => {
    if (id && itemId) {
      loadMenuItem();
    }
  }, [id, itemId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadMenuItem();
    } catch (error) {
      console.error('Failed to refresh menu item:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadMenuItem = async () => {
    if (!id) return;
    
    try {
      // Load restaurant data which includes menu items
      const restaurant = await api.getRestaurant(id);
      const item = restaurant.menu_items?.find((item: any) => item.id === itemId);
      
      if (!item) {
        Alert.alert('Error', 'Menu item not found');
        router.back();
        return;
      }

      // Check authorization
      if (restaurant.owner_id !== user?.id) {
        Alert.alert('Access Denied', 'You are not authorized to edit this menu item');
        router.back();
        return;
      }

      setMenuItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price.toString(),
        category: COMMON_CATEGORIES.includes(item.category) ? item.category : 'custom',
        customCategory: COMMON_CATEGORIES.includes(item.category) ? '' : item.category,
        is_available: item.is_available,
      });
    } catch (error) {
      console.error('Failed to load menu item:', error);
      Alert.alert('Error', 'Failed to load menu item');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.price.trim()) {
      Alert.alert('Error', 'Please fill in the item name and price');
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const category = formData.category === 'custom' ? formData.customCategory.trim() : formData.category;
    if (!category) {
      Alert.alert('Error', 'Please select or enter a category');
      return;
    }

    setSaving(true);
    try {
      await api.updateMenuItem(itemId!, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price,
        category,
        is_available: formData.is_available,
      });

      Alert.alert('Success', 'Menu item updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Failed to update menu item:', error);
      Alert.alert('Error', 'Failed to update menu item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Menu Item',
      `Are you sure you want to delete "${menuItem?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMenuItem(itemId!);
              Alert.alert('Success', 'Menu item deleted successfully!', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('Failed to delete menu item:', error);
              Alert.alert('Error', 'Failed to delete menu item. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Menu Item</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f9c435" />
          <Text style={styles.loadingText}>Loading menu item...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#2D3748" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Menu Item</Text>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving}
        >
          <Save size={20} color="white" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#f29056']}
            tintColor='#f29056'
          />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Item Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Margherita Pizza"
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe the dish..."
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Price (€) *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="12.50"
              value={formData.price}
              onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.categoryChips}>
              {COMMON_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    formData.category === category && styles.selectedChip
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, category, customCategory: '' }))}
                >
                  <Text style={[
                    styles.categoryChipText,
                    formData.category === category && styles.selectedChipText
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.categoryChip,
                  formData.category === 'custom' && styles.selectedChip
                ]}
                onPress={() => setFormData(prev => ({ ...prev, category: 'custom' }))}
              >
                <Text style={[
                  styles.categoryChipText,
                  formData.category === 'custom' && styles.selectedChipText
                ]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {formData.category === 'custom' && (
            <TextInput
              style={[styles.textInput, { marginTop: 12 }]}
              placeholder="Enter custom category"
              value={formData.customCategory}
              onChangeText={(text) => setFormData(prev => ({ ...prev, customCategory: text }))}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Item Available</Text>
              <Text style={styles.switchDescription}>
                Toggle to mark this item as available or unavailable
              </Text>
            </View>
            <Switch
              value={formData.is_available}
              onValueChange={(value) => setFormData(prev => ({ ...prev, is_available: value }))}
              trackColor={{ false: '#E5E7EB', true: '#f29056' }}
              thumbColor={formData.is_available ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Trash2 size={20} color="#EF4444" />
            <Text style={styles.deleteButtonText}>Delete Menu Item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#2D3748',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryChips: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
  },
  selectedChip: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  selectedChipText: {
    color: 'white',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#2D3748',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
  },
  dangerZone: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  dangerTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#EF4444',
    marginBottom: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#EF4444',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginTop: 12,
  },
});