import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Utensils, Plus, CreditCard as Edit3, Trash2, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { api } from '@/services/supabaseApi';
import { useLanguage } from '@/contexts/LanguageContext';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

interface MenuDisplayProps {
  menuItems: MenuItem[];
  isOwner: boolean;
  restaurantId: string;
  onMenuUpdate: () => void;
}

export default function MenuDisplay({ menuItems, isOwner, restaurantId, onMenuUpdate }: MenuDisplayProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    // Group items by category
    const uniqueCategories = [...new Set(menuItems.map(item => item.category))];
    setCategories(uniqueCategories.sort());
    
    if (uniqueCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(uniqueCategories[0]);
    }
  }, [menuItems]);

  const handleToggleAvailability = async (menuItem: MenuItem) => {
    try {
      await api.updateMenuItem(menuItem.id, {
        is_available: !menuItem.is_available
      });
      onMenuUpdate();
    } catch (error) {
      console.error('Failed to update availability:', error);
      Alert.alert('Error', 'Failed to update item availability');
    }
  };

  const handleDeleteItem = async (menuItem: MenuItem) => {
    Alert.alert(
      'Delete Menu Item',
      `Are you sure you want to delete "${menuItem.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMenuItem(menuItem.id);
              onMenuUpdate();
            } catch (error) {
              console.error('Failed to delete menu item:', error);
              Alert.alert('Error', 'Failed to delete menu item');
            }
          },
        },
      ]
    );
  };

  const formatPrice = (price: number) => {
    return `€${price.toFixed(2)}`;
  };

  const getCategoryItems = (category: string) => {
    return menuItems
      .filter(item => item.category === category)
      .sort((a, b) => {
        // Sort by sort_order first, then by name
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.name.localeCompare(b.name);
      });
  };

  if (categories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Utensils size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>{t('restaurant.noMenu')}</Text>
        <Text style={styles.emptyText}>
          {isOwner ? t('restaurant.noMenuOwner') : t('restaurant.noMenuUser')}
        </Text>
        {isOwner && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push(`/restaurant/menu/${restaurantId}`)}
          >
            <Plus size={20} color="white" />
            <Text style={styles.addButtonText}>Add Menu Items</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Tabs */}
      {categories.length > 1 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryTab,
                selectedCategory === category && styles.activeCategoryTab
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.categoryTabText,
                selectedCategory === category && styles.activeCategoryTabText
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Owner Actions */}
      {isOwner && (
        <View style={styles.ownerActions}>
          <TouchableOpacity 
            style={styles.manageButton}
            onPress={() => router.push(`/restaurant/menu/${restaurantId}`)}
          >
            <Edit3 size={16} color="#f9c435" />
            <Text style={styles.manageButtonText}>Manage Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Menu Items */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {categories.map((category) => {
          if (selectedCategory && category !== selectedCategory) return null;
          
          const categoryItems = getCategoryItems(category);
          if (categoryItems.length === 0) return null;

          return (
            <View key={category} style={styles.categorySection}>
              {categories.length > 1 && !selectedCategory && (
                <Text style={styles.categoryTitle}>{category}</Text>
              )}
              
              {categoryItems.map((item) => (
                <View key={item.id} style={styles.menuItem}>
                  <View style={styles.menuItemContent}>
                    {item.image_url && (
                      <Image 
                        source={{ uri: item.image_url }} 
                        style={styles.menuItemImage}
                      />
                    )}
                    
                    <View style={styles.menuItemInfo}>
                      <View style={styles.menuItemHeader}>
                        <Text style={[
                          styles.menuItemName,
                          !item.is_available && styles.unavailableItem
                        ]}>
                          {item.name}
                        </Text>
                        <Text style={[
                          styles.menuItemPrice,
                          !item.is_available && styles.unavailableItem
                        ]}>
                          {formatPrice(item.price)}
                        </Text>
                      </View>
                      
                      {item.description && (
                        <Text style={[
                          styles.menuItemDescription,
                          !item.is_available && styles.unavailableItem
                        ]}>
                          {item.description}
                        </Text>
                      )}
                      
                      {!item.is_available && (
                        <Text style={styles.unavailableText}>Currently unavailable</Text>
                      )}
                    </View>
                  </View>

                  {/* Owner Controls */}
                  {isOwner && (
                    <View style={styles.itemControls}>
                      <TouchableOpacity
                        style={[
                          styles.controlButton,
                          item.is_available ? styles.availableButton : styles.unavailableButton
                        ]}
                        onPress={() => handleToggleAvailability(item)}
                      >
                        {item.is_available ? (
                          <Eye size={14} color="#10B981" />
                        ) : (
                          <EyeOff size={14} color="#EF4444" />
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => router.push(`/restaurant/menu/${restaurantId}/edit/${item.id}`)}
                      >
                        <Edit3 size={14} color="#6B7280" />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={() => handleDeleteItem(item)}
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeCategoryTab: {
    backgroundColor: '#f29056',
    borderColor: '#f29056',
  },
  categoryTabText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  activeCategoryTabText: {
    color: 'white',
  },
  ownerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 144, 86, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  manageButtonText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#f29056',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#2D3748',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemContent: {
    flexDirection: 'row',
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  menuItemName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    flex: 1,
    marginRight: 8,
  },
  menuItemPrice: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#f29056',
  },
  menuItemDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    lineHeight: 20,
    marginBottom: 4,
  },
  unavailableItem: {
    opacity: 0.6,
    textDecorationLine: 'line-through',
  },
  unavailableText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#EF4444',
    fontStyle: 'italic',
  },
  itemControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableButton: {
    backgroundColor: '#D1FAE5',
  },
  unavailableButton: {
    backgroundColor: '#FEE2E2',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f29056',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: 'white',
  },
});