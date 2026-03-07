import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable } from 'react-native';
import { Button, Surface, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { concludeShoppingForListWithInvoice, getLastStoreName, getShoppingListItemsByListId, getInventoryItems, getStores, updateShoppingListItem, deleteShoppingListItem, getSetting, setSetting, getLastUnitPriceForProductAtStore, getLastUnitPriceForProduct, getLowestPriceForProducts, getCategories, updateProductCategory } from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { ShoppingListItem } from '../database/models';
import { useListContext } from '../context/ListContext';
import { useList } from '../hooks/useList';
import { EditShoppingItemModal } from '../components/EditShoppingItemModal';
import { ConfirmInvoiceModal, StoreOption } from '../components/ConfirmInvoiceModal';
import ContextualHeader from '../components/ContextualHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddItemButton } from '../components/AddItemButton';
import { ItemPickerDialog } from '../components/ItemPickerDialog';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { SortMenu } from '../components/SortMenu';
import { sortItems, SortOrder } from '../utils/sortUtils';
import ShoppingList from '../components/ShoppingList';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SearchBar from '../components/SearchBar';

type ShoppingListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShoppingList'>;

interface ShoppingListItemWithDetails extends Omit<ShoppingListItem, 'checked'> {
  checked: boolean;
  productName: string;
  productId: number;
  currentInventoryQuantity: number;
  price?: number;
  categoryName?: string | null;
  lowestPrice90d: { price: number; storeName: string } | null;
}

export default function ShoppingListScreen() {
  const { listId } = useListContext();
  const { listName, handleListNameSave, handleListDelete } = useList(listId);
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItemWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItemWithDetails | null>(null);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [defaultStoreName, setDefaultStoreName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [lastStoreId, setLastStoreId] = useState<number | null>(null);
  const [storePickerVisible, setStorePickerVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('alphabetical');
  const navigation = useNavigation<ShoppingListScreenNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const isFirstLoad = useRef(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [listId])
  );

  const loadData = useCallback(async () => {
    try {
      const [inventory, shopping, storesList, lastStore, categoriesList] = await Promise.all([
        getInventoryItems(listId),
        getShoppingListItemsByListId(listId),
        getStores(),
        getLastStoreName(),
        getCategories(),
      ]);

      const enhancedShoppingItems = shopping.map(item => {
        const inventoryItem = inventory.find(inv => inv.id === item.inventoryItemId);
        return {
          ...item,
          checked: Boolean(item.checked),
          productName: inventoryItem?.productName || 'Unknown Product',
          productId: inventoryItem?.productId || 0,
          currentInventoryQuantity: inventoryItem?.quantity || 0,
          price: item.price,
          categoryName: item.categoryName ?? null,
        };
      });

      const productIds = enhancedShoppingItems.map(item => item.productId).filter(id => id > 0);
      const lowestPriceMap = await getLowestPriceForProducts(productIds);

      const withStats = enhancedShoppingItems.map(item => ({
        ...item,
        lowestPrice90d: lowestPriceMap.get(item.productId) ?? null,
      }));
      setShoppingListItems(withStats);
      setStores(storesList);
      setCategories(categoriesList);

      const [defaultStoreMode, defaultStoreId] = await Promise.all([
        getSetting('defaultStoreMode'),
        getSetting('defaultStoreId'),
      ]);

      let storeNameToSet = '';
      let storeIdToSet: number | null = null;

      if (isFirstLoad.current) {
        const lastStoreObj = storesList.find(s => s.name === lastStore);
        setLastStoreId(lastStoreObj?.id ?? null);

        if (defaultStoreMode === 'last') {
          storeNameToSet = lastStore ?? '';
          storeIdToSet = lastStoreObj?.id ?? null;
        } else if (defaultStoreMode === 'fixed' && defaultStoreId) {
          const defaultStore = storesList.find(s => s.id === parseInt(defaultStoreId));
          storeNameToSet = defaultStore?.name ?? '';
          storeIdToSet = defaultStore?.id ?? null;
        }

        setDefaultStoreName(storeNameToSet);
        setSelectedStoreId(storeIdToSet);
        isFirstLoad.current = false;

        if (storeIdToSet !== null) {
          updatePricesForStore(storeIdToSet, withStats);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  }, [listId]);

  const updatePricesForStore = useCallback(async (storeId: number, items: ShoppingListItemWithDetails[]) => {
    try {
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          const storePrice = await getLastUnitPriceForProductAtStore(item.productId, storeId);
          if (storePrice !== null) {
            return { ...item, price: storePrice };
          } else {
            const lastPrice = await getLastUnitPriceForProduct(item.productId);
            return { ...item, price: lastPrice ?? item.price };
          }
        })
      );
      setShoppingListItems(updatedItems);
    } catch (error) {
      console.error('Error updating prices for store:', error);
    }
  }, []);

  const handleStoreSelect = useCallback((storeId: number) => {
    setSelectedStoreId(storeId);
    const selectedStore = stores.find(s => s.id === storeId);
    setDefaultStoreName(selectedStore?.name ?? '');
    updatePricesForStore(storeId, shoppingListItems);
  }, [stores, shoppingListItems, updatePricesForStore]);

  const handleToggleChecked = useCallback(async (item: ShoppingListItemWithDetails) => {
    try {
      await updateShoppingListItem(item.id, { checked: !item.checked });
      setShoppingListItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !item.checked } : i));
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  }, []);

  const handleDeleteItem = useCallback(async (item: ShoppingListItemWithDetails) => {
    try {
      await deleteShoppingListItem(item.id);
      await loadData();
    } catch (error) {
      console.error('Erro ao deletar item:', error);
    }
  }, [loadData]);

  const handleSaveEdit = useCallback(async (quantity: number, price: number | undefined) => {
    if (!editingItem) return;
    try {
      await updateShoppingListItem(editingItem.id, { quantity, price });
      setShoppingListItems(prev =>
        prev.map(item =>
          item.id === editingItem.id ? { ...item, quantity, price } : item
        )
      );
      setEditingItem(null);
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  }, [editingItem]);

  const handleCategorySelect = useCallback(async (categoryId: number) => {
    if (!editingItem) return;
    try {
      await updateProductCategory(editingItem.productId, categoryId);
      await loadData();
      const selectedCategory = categories.find(c => c.id === categoryId);
      setEditingItem(prev => prev ? { ...prev, categoryName: selectedCategory?.name ?? null } : null);
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
    }
  }, [editingItem, loadData, categories]);

  const sortShoppingItems = useCallback((items: ShoppingListItemWithDetails[]) => {
    const mapped = items.map(item => ({
      ...item,
      productName: item.productName,
      quantity: item.quantity,
      stockQuantity: item.currentInventoryQuantity,
      sortOrder: 0,
      categoryName: item.categoryName ?? null,
    }));
    return sortItems(mapped, sortOrder, '') as ShoppingListItemWithDetails[];
  }, [sortOrder]);

  const filteredShoppingItems = useMemo(() => {
    if (!searchQuery.trim()) return shoppingListItems;
    const q = searchQuery.toLowerCase().trim();
    return shoppingListItems.filter(item =>
      item.productName.toLowerCase().includes(q)
    );
  }, [shoppingListItems, searchQuery]);

  const checkedItems = filteredShoppingItems.filter(item => item.checked);
  const uncheckedItems = filteredShoppingItems.filter(item => !item.checked);

  const sortedUnchecked = useMemo(() => sortShoppingItems(uncheckedItems), [uncheckedItems, sortOrder, sortShoppingItems]);
  const sortedChecked = useMemo(() => sortShoppingItems(checkedItems), [checkedItems, sortOrder, sortShoppingItems]);

  const openConfirmConclude = useCallback(() => {
    if (checkedItems.length === 0) return;
    setConfirmVisible(true);
  }, [checkedItems.length]);

  const handleConfirmConclude = useCallback(async (storeName: string) => {
    if (checkedItems.length === 0) return;
    setLoading(true);
    try {
      await concludeShoppingForListWithInvoice(listId, storeName);
      const store = stores.find(s => s.name === storeName);
      if (store) {
        await setSetting('defaultStoreId', store.id.toString());
      }
      setConfirmVisible(false);
      await loadData();
    } catch (error) {
      console.error('Erro ao concluir compras:', error);
    } finally {
      setLoading(false);
    }
  }, [checkedItems.length, listId, stores, loadData]);

  const totalCheckedPrice = checkedItems.reduce((total, item) => {
    if (item.price) return total + item.quantity * item.price;
    return total;
  }, 0);

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

  const bottomBarHeight = checkedItems.length > 0 ? 64 : 0;

  const listHeaderComponent = useCallback(() => (
    <View style={{ paddingHorizontal: 16 }}>
      {sortedUnchecked.length > 0 && (
        <>
          <Text style={[localStyles.subsectionTitle, { 
            color: theme.colors.onSurfaceVariant,
            paddingVertical: 8,
            paddingHorizontal: 4,
          }]}>
            Pendentes ({sortedUnchecked.length})
          </Text>
          <ShoppingList
            items={sortedUnchecked}
            sortOrder={sortOrder}
            onToggleChecked={handleToggleChecked}
            onDelete={handleDeleteItem}
            onEdit={(item) => setEditingItem(item)}
          />
        </>
      )}

      {sortedChecked.length > 0 || true ? (
        <>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 8,
            paddingHorizontal: 4,
          }}>
            <Text style={[localStyles.subsectionTitle, { 
              color: theme.colors.onSurfaceVariant 
            }]}>
              No carrinho ({sortedChecked.length})
            </Text>
            <Button mode="text" onPress={() => setIsCartCollapsed(!isCartCollapsed)} compact>
              {isCartCollapsed ? 'Mostrar' : 'Ocultar'}
            </Button>
          </View>
          {!isCartCollapsed && (
            <ShoppingList
              items={sortedChecked}
              sortOrder={sortOrder}
              onToggleChecked={handleToggleChecked}
              onDelete={handleDeleteItem}
              onEdit={(item) => setEditingItem(item)}
            />
          )}
        </>
      ) : null}

      {filteredShoppingItems.length === 0 && (
        <Surface style={localStyles.emptyState}>
          <Text style={{ 
            textAlign: 'center', 
            color: theme.colors.onSurfaceVariant, 
            fontSize: 16, 
            lineHeight: 24 
          }}>
            Sua lista de compras está vazia.{'\n'}
            Toque no botão abaixo para adicionar produtos!
          </Text>
        </Surface>
      )}
    </View>
  ), [uncheckedItems, checkedItems, sortOrder, sortShoppingItems, isCartCollapsed, theme, handleToggleChecked, handleDeleteItem, setEditingItem, sortedUnchecked, sortedChecked]);

  return (
    <SafeAreaView style={styles.container}>
      <ContextualHeader
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />

      <View style={[localStyles.topRow, { borderBottomColor: theme.colors.outlineVariant }]}>
        <Pressable
          onPress={() => setStorePickerVisible(true)}
          style={[localStyles.storeButton, { borderColor: theme.colors.outline }]}
        >
          <MaterialCommunityIcons
            name="store-outline"
            size={18}
            color={defaultStoreName ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
        </Pressable>

        <View style={localStyles.searchWrapper}>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </View>

        <SortMenu
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          mode="shoppingList"
          iconOnly
        />
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => ''}
        scrollEnabled={true}
        ListHeaderComponent={listHeaderComponent}
        contentContainerStyle={{ paddingBottom: bottomBarHeight + 96 }}
      />

      <AddItemButton
        onPress={() => navigation.navigate('AddProductToShoppingList', { listId })}
        label="Adicionar à Lista de Compras"
        style={checkedItems.length > 0 ? { bottom: bottomBarHeight } : undefined}
      />

      <EditShoppingItemModal
        visible={editingItem !== null}
        item={editingItem}
        onSave={handleSaveEdit}
        onToggleChecked={async () => {
          if (!editingItem) return;
          const updated = { ...editingItem, checked: !editingItem.checked };
          setEditingItem(updated);
          await handleToggleChecked(editingItem);
        }}
        onDelete={() => { handleDeleteItem(editingItem!); setEditingItem(null); }}
        onDismiss={() => setEditingItem(null)}
        onCategoryChange={() => {}}
        categories={categories}
        onCategorySelect={handleCategorySelect}
      />

      {checkedItems.length > 0 && (
        <View style={[localStyles.bottomBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
          <View style={localStyles.bottomBarSummary}>
            <Text style={[localStyles.bottomBarLabel, { color: theme.colors.onSurfaceVariant }]}>Total no carrinho:</Text>
            <Text style={[localStyles.bottomBarValue, { color: theme.colors.primary }]}>{formatCurrency(totalCheckedPrice)}</Text>
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
      <ItemPickerDialog
        visible={storePickerVisible}
        items={stores}
        selectedId={selectedStoreId}
        onSelect={handleStoreSelect}
        onDismiss={() => setStorePickerVisible(false)}
        title="Escolher loja"
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  storeButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrapper: {
    flex: 1,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    margin: 16,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
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
  },
  bottomBarValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomBarButton: {
    borderRadius: 8,
  },
});