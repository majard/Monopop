import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, FlatList } from 'react-native';
import { Button, Surface, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getShoppingListItemsByListId, getInventoryItems, updateShoppingListItem, deleteShoppingListItem, concludeShoppingForList } from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { ShoppingListItem } from '../database/models';
import { useListContext } from '../context/ListContext';
import { ShoppingListItemCard } from '../components/ShoppingListItemCard';
import { EditShoppingItemModal } from '../components/EditShoppingItemModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddItemButton } from '../components/AddItemButton';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';

type ShoppingListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShoppingList'>;

interface ShoppingListItemWithDetails extends Omit<ShoppingListItem, 'checked'> {
  checked: boolean; // Converted from database number to boolean
  productName: string;
  productId: number;
  currentInventoryQuantity: number;
  price?: number;
}

export default function ShoppingListScreen() {
  const { listId } = useListContext();
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItemWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItemWithDetails | null>(null);
  const navigation = useNavigation<ShoppingListScreenNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  // Load inventory items and shopping list items on component mount and focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [listId])
  );

  const loadData = async () => {
    try {
      const [inventory, shopping] = await Promise.all([
        getInventoryItems(listId),
        getShoppingListItemsByListId(listId)
      ]);

      const enhancedShoppingItems = shopping.map(item => {
        const inventoryItem = inventory.find(inv => inv.id === item.inventoryItemId);
        return {
          ...item,
          checked: Boolean(item.checked),
          productName: inventoryItem?.productName || 'Unknown Product',
          productId: inventoryItem?.productId || 0,
          currentInventoryQuantity: inventoryItem?.quantity || 0,
        };
      });

      setShoppingListItems(enhancedShoppingItems);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleToggleChecked = async (item: ShoppingListItemWithDetails) => {
    try {
      await updateShoppingListItem(item.id, { checked: !item.checked });
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  };

  const handleConcludeShopping = async () => {
    if (checkedItems.length === 0) return;
    setLoading(true);
    try {
      await concludeShoppingForList(listId);
      await loadData();
    } catch (error) {
      console.error('Erro ao concluir compras:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item: ShoppingListItemWithDetails) => {
    try {
      await deleteShoppingListItem(item.id);
      await loadData();
    } catch (error) {
      console.error('Erro ao deletar item:', error);
    }
  };

  const renderShoppingListItem = ({ item }: { item: ShoppingListItemWithDetails }) => (
    <ShoppingListItemCard
      item={item}
      onToggleChecked={() => handleToggleChecked(item)}
      onDelete={() => handleDeleteItem(item)}
      onEdit={() => setEditingItem(item)}
    />
  );

  const checkedItems = shoppingListItems.filter(item => item.checked);
  const uncheckedItems = shoppingListItems.filter(item => !item.checked);

  const totalCheckedPrice = checkedItems.reduce((total, item) => {
    if (item.price) {
      return total + (item.quantity * item.price);
    }
    return total;
  }, 0);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  const handleSaveEdit = async (quantity: number, price: number | undefined) => {
    if (!editingItem) return;
    try {
      await updateShoppingListItem(editingItem.id, { quantity, price });
      await loadData();
      setEditingItem(null);
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={localStyles.sectionTitle}>Lista de Compras</Text>
      </View>
      <ScrollView style={localStyles.scrollContent}>
        {shoppingListItems.length === 0 ? (
          <Surface style={localStyles.emptyState}>
            <Text style={localStyles.emptyStateText}>
              Sua lista de compras está vazia.{'\n'}
              Toque no botão abaixo para adicionar produtos!
            </Text>
          </Surface>
        ) : (
          <>
            {uncheckedItems.length > 0 && (
              <View style={localStyles.itemsSection}>
                <Text style={localStyles.subsectionTitle}>Pendentes ({uncheckedItems.length})</Text>
                <FlatList
                  data={uncheckedItems}
                  renderItem={renderShoppingListItem}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                />
              </View>
            )}
            
            {checkedItems.length > 0 && (
              <View style={localStyles.totalSection}>
                <Text style={localStyles.totalLabel}>Total no carrinho:</Text>
                <Text style={localStyles.totalValue}>{formatCurrency(totalCheckedPrice)}</Text>
              </View>
            )}

            {checkedItems.length > 0 && (
              <View style={localStyles.concludeSection}>
                <Button
                  mode="contained"
                  onPress={handleConcludeShopping}
                  disabled={loading}
                  loading={loading}
                  icon="cart-check"
                  style={localStyles.concludeButton}
                >
                  Concluir compras
                </Button>
              </View>
            )}


            {checkedItems.length > 0 && (
              <View style={localStyles.itemsSection}>
                <Text style={localStyles.subsectionTitle}>No carrinho ({checkedItems.length})</Text>
                <FlatList
                  data={checkedItems}
                  renderItem={renderShoppingListItem}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>

      <AddItemButton
        onPress={() => navigation.navigate('AddProductToShoppingList', { listId })}
        label="Adicionar à Lista de Compras"
      />
      <EditShoppingItemModal
        visible={editingItem !== null}
        item={editingItem}
        onSave={handleSaveEdit}
        onDismiss={() => setEditingItem(null)}
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    marginBottom: 32,
  },
  concludeSection: {
    marginBottom: 16,
  },
  concludeButton: {
    paddingVertical: 8,
  },
  itemsSection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    lineHeight: 24,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 16,
    marginHorizontal: 8,
    marginBottom: 16,
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
});