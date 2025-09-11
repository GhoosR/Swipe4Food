import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, Save, X, Utensils } from 'lucide-react-native';
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

export default function MenuManagementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for new item
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    customCategory: '',
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadData = async () => {
    if (!id) return;
    
    try {
      const restaurantData = await api.getRestaurant(id);
      setRestaurant(restaurantData);
      
      if (restaurantData.menu_items) {
        setMenuItems(restaurantData.menu_items);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load restaurant data');
    } finally {
      setLoading(false);
    }
  };

  // Check authorization
  useEffect(() => {
    if (restaurant && user && restaurant.owner_id !== user.id) {
      Alert.alert(
        'Access Denied',
        'You are not authorized to manage this restaurant\'s menu',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [restaurant, user]);

  const handleAddItem = async () => {
    if (!newItem.name.trim() || !newItem.price.trim()) {
      Alert.alert('Error', 'Please fill in the item name and price');
      return;
    }

    const price = parseFloat(newItem.price);
    if (isNaN(price) || price < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const category = newItem.category === 'custom' ? newItem.customCategory.trim() : newItem.category;
    if (!category) {
      Alert.alert('Error', 'Please select or enter a category');
      return;
    }

    setSaving(true);
    try {
      await api.createMenuItem({
        name: newItem.name.trim(),
        description: newItem.description.trim() || null,
        price,
        category,
        image_url: null,
        is_available: true,
        sort_order: 0,
      }, id!);

      setNewItem({ name: '', description: '', price: '', category: '', customCategory: '' });
      setShowAddModal(false);
      await loadData();
      
      Alert.alert('Success', 'Menu item added successfully!');
    } catch (error) {
      console.error('Failed to add menu item:', error);
      Alert.alert('Error', 'Failed to add menu item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getMenuByCategory = () => {
    const categories: Record<string, any[]> = {};
    
    menuItems.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });

    // Sort items within each category
    Object.keys(categories).forEach(category => {
      categories[category].sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.name.localeCompare(b.name);
      });
    });

    return categories;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Menu Management</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f9c435" />
          <Text style={styles.loadingText}>Loading menu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#2D3748" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Menu Management</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Restaurant not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const menuByCategory = getMenuByCategory();
  const categoryNames = Object.keys(menuByCategory).sort();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#2D3748" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu Management</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={20} color="white" />
          <Text style={styles.addButtonText}>Add Item</Text>
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
        <Text style={styles.restaurantName}>{restaurant.name}</Text>
        <Text style={styles.subtitle}>Manage your menu items</Text>

        {categoryNames.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Utensils size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No menu items yet</Text>
            <Text style={styles.emptyText}>
              Start building your menu by adding your first dish
            </Text>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={20} color="white" />
              <Text style={styles.primaryButtonText}>Add First Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          categoryNames.map(category => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {menuByCategory[category].map((item: any) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.menuItemCard}
                  onPress={() => router.push(`/restaurant/menu/${id}/edit/${item.id}`)}
                >
                  <View style={styles.menuItemInfo}>
                    <Text style={styles.menuItemName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.menuItemDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                    )}
                    <Text style={styles.menuItemPrice}>€{item.price.toFixed(2)}</Text>
                  </View>
                  
                  <View style={styles.itemStatus}>
                    <View style={[
                      styles.statusIndicator,
                      { backgroundColor: item.is_available ? '#10B981' : '#EF4444' }
                    ]} />
                    <Text style={styles.statusText}>
                      {item.is_available ? 'Available' : 'Unavailable'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Menu Item</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <X size={24} color="#2D3748" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Margherita Pizza"
                value={newItem.name}
                onChangeText={(text) => setNewItem(prev => ({ ...prev, name: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe the dish..."
                value={newItem.description}
                onChangeText={(text) => setNewItem(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Price (€) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="12.50"
                value={newItem.price}
                onChangeText={(text) => setNewItem(prev => ({ ...prev, price: text }))}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryChips}>
                  {COMMON_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryChip,
                        newItem.category === category && styles.selectedChip
                      ]}
                      onPress={() => setNewItem(prev => ({ ...prev, category, customCategory: '' }))}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        newItem.category === category && styles.selectedChipText
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.categoryChip,
                      newItem.category === 'custom' && styles.selectedChip
                    ]}
                    onPress={() => setNewItem(prev => ({ ...prev, category: 'custom' }))}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      newItem.category === 'custom' && styles.selectedChipText
                    ]}>
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {newItem.category === 'custom' && (
                <TextInput
                  style={[styles.textInput, { marginTop: 12 }]}
                  placeholder="Enter custom category"
                  value={newItem.customCategory}
                  onChangeText={(text) => setNewItem(prev => ({ ...prev, customCategory: text }))}
                />
              )}
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.disabledButton]}
              onPress={handleAddItem}
              disabled={saving}
            >
              <Save size={20} color="white" />
              <Text style={styles.saveButtonText}>
                {saving ? 'Adding...' : 'Add Item'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  restaurantName: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginTop: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 24,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuItemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 4,
  },
  menuItemPrice: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#f9c435',
  },
  itemStatus: {
    alignItems: 'center',
    gap: 4,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#faf6ee',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputGroup: {
    marginBottom: 20,
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
    backgroundColor: 'white',
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
    backgroundColor: 'white',
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
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f29056',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
});