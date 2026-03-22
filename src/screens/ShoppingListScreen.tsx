import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, FlatList } from 'react-native';
import { Button, Surface, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { concludeShoppingForListWithInvoice, getLastStoreName, getShoppingListItemsByListId, getInventoryItems, getStores, updateShoppingListItem, deleteShoppingListItem, getSetting, setSetting } from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { ShoppingListItem } from '../database/models';
import { useListContext } from '../context/ListContext';
import { useList } from '../hooks/useList';
import { ShoppingListItemCard } from '../components/ShoppingListItemCard';
import { EditShoppingItemModal } from '../components/EditShoppingItemModal';
import { ConfirmInvoiceModal, StoreOption } from '../components/ConfirmInvoiceModal';
import ContextualHeader from '../components/ContextualHeader';
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
  const { listName, handleListNameSave, handleListDelete } = useList(listId);
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItemWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItemWithDetails | null>(null);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [defaultStoreName, setDefaultStoreName] = useState('');
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
      const [inventory, shopping, storesList, lastStore] = await Promise.all([
        getInventoryItems(listId),
        getShoppingListItemsByListId(listId),
        getStores(),
        getLastStoreName(),
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
      setStores(storesList);
      setDefaultStoreName(lastStore ?? '');
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

  const openConfirmConclude = () => {
    if (checkedItems.length === 0) return;
    setConfirmVisible(true);
  };

  const handleConfirmConclude = async (storeName: string) => {
    if (checkedItems.length === 0) return;
    setLoading(true);
    try {
      await concludeShoppingForListWithInvoice(listId, storeName);
      
      setConfirmVisible(false);
      await loadData();
      
      // Best-effort save of last used store (non-blocking)
      const store = stores.find(s => s.name === storeName);
      if (store) {
        try {
          await setSetting('lastUsedStoreId', store.id.toString());
        } catch (error) {
          console.error('Failed to save last used store:', error);
          // Don't rethrow - checkout success should not be affected
        }
      }
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

  const bottomBarHeight = checkedItems.length > 0 ? 64 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ContextualHeader 
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />
      
      <ScrollView style={localStyles.scrollContent} contentContainerStyle={{ paddingBottom: bottomBarHeight + 96 }}>
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
              <View style={localStyles.itemsSection}>
                <View style={localStyles.cartHeaderRow}>
                  <Text style={localStyles.subsectionTitle}>No carrinho ({checkedItems.length})</Text>
                  <Button
                    mode="text"
                    onPress={() => setIsCartCollapsed(!isCartCollapsed)}
                    compact
                  >
                    {isCartCollapsed ? 'Mostrar' : 'Ocultar'}
                  </Button>
                </View>
                {!isCartCollapsed && (
                  <FlatList
                    data={checkedItems}
                    renderItem={renderShoppingListItem}
                    keyExtractor={(item) => item.id.toString()}
                    scrollEnabled={false}
                  />
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <AddItemButton
        onPress={() => navigation.navigate('AddProductToShoppingList', { listId })}
        label="Adicionar à Lista de Compras"
        style={checkedItems.length > 0 ? { bottom: bottomBarHeight } : undefined}
      />
      <EditShoppingItemModal
        visible={editingItem !== null}
        item={editingItem}
        onSave={handleSaveEdit}
        onDismiss={() => setEditingItem(null)}
      />

      {checkedItems.length > 0 && (
        <View style={localStyles.bottomBar}>
          <View style={localStyles.bottomBarSummary}>
            <Text style={localStyles.bottomBarLabel}>Total no carrinho:</Text>
            <Text style={localStyles.bottomBarValue}>{formatCurrency(totalCheckedPrice)}</Text>
          </View>
          <Button
            mode="contained"
            onPress={openConfirmConclude}
            disabled={loading}
            loading={loading}
            icon="cart-check"
            style={localStyles.bottomBarButton}
          >
            Concluir compras
          </Button>
        </View>
      )}

      <ConfirmInvoiceModal
        visible={confirmVisible}
        stores={stores}
        defaultStoreName={defaultStoreName}
        onConfirm={handleConfirmConclude}
        onDismiss={() => setConfirmVisible(false)}
        loading={loading}
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
  cartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomBarSummary: {
    flex: 1,
  },
  bottomBarLabel: {
    fontSize: 12,
    color: '#666',
  },
  bottomBarValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  bottomBarButton: {
    borderRadius: 8,
  },
});