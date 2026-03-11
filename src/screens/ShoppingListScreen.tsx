import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Alert, Modal } from 'react-native';
import { Button, Surface, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { concludeShoppingForListWithInvoice, getShoppingListItemsByListId, updateShoppingListItem, deleteShoppingListItem, setSetting, getLowestPriceForProducts, updateProductCategory, addProduct, addShoppingListItem, getReferencePricesForProducts, upsertProductStorePrice, upsertProductBasePrice } from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { ShoppingListItem } from '../database/models';
import { useListContext } from '../context/ListContext';
import { useListData } from '../context/ListDataContext';
import { useList } from '../hooks/useList';
import { EditShoppingItemModal } from '../components/EditShoppingItemModal';
import { ConfirmInvoiceModal, StoreOption } from '../components/ConfirmInvoiceModal';
import ContextualHeader from '../components/ContextualHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddItemButton } from '../components/AddItemButton';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { SortMenu } from '../components/SortMenu';
import { sortItems, SortOrder } from '../utils/sortUtils';
import { ShoppingListItemCard } from '../components/ShoppingListItemCard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SearchBar from '../components/SearchBar';
import ShoppingListSkeleton from '../components/ShoppingListSkeleton';
import ImportModal from '../components/ImportModal';
import { StoreSelector } from '../components/StoreSelector';
import { generateShoppingListText } from '../utils/stringUtils';
import * as Clipboard from 'expo-clipboard';

type ListRow =
  | { type: 'section-header'; title: string; sectionType: 'pending' | 'cart' }
  | { type: 'category-header'; category: string; sectionType: 'pending' | 'cart' }
  | { type: 'item'; item: ShoppingListItemWithDetails; sectionType: 'pending' | 'cart' };

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
  const { categories, stores, defaultStoreMode, defaultStoreId, lastStoreName, refreshStoreSettings, findByProductId } = useListData();
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItemWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ShoppingListItemWithDetails | null>(null);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [defaultStoreName, setDefaultStoreName] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [lastStoreId, setLastStoreId] = useState<number | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>('alphabetical');
  const [actionsVisible, setActionsVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
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
      const [shopping] = await Promise.all([
        getShoppingListItemsByListId(listId),
      ]);

      const enhancedShoppingItems = shopping.map(item => ({
        ...item,
        checked: Boolean(item.checked),
        productName: item.productName || 'Unknown Product',
        productId: item.productId || 0,
        currentInventoryQuantity: item.currentInventoryQuantity || 0,
        price: item.price,
        categoryName: item.categoryName ?? null,
        lowestPrice90d: null, // filled below
      }));

      // Render list immediately with no lowest price data
      setShoppingListItems(enhancedShoppingItems.map(item => ({ ...item, lowestPrice90d: null })));

      // Load lowest prices in background without blocking
      const productIds = enhancedShoppingItems.map(item => item.productId).filter(id => id > 0);
      if (productIds.length > 0) {
        getLowestPriceForProducts(productIds).then(lowestPriceMap => {
          setShoppingListItems(prev => prev.map(item => ({
            ...item,
            lowestPrice90d: lowestPriceMap.get(item.productId) ?? null,
          })));
        }).catch(error => {
          console.error('Error loading lowest prices:', error);
        });
      }

      let storeNameToSet = '';
      let storeIdToSet: number | null = null;

      if (isFirstLoad.current) {
        const lastStoreObj = stores.find(s => s.name === lastStoreName);
        setLastStoreId(lastStoreObj?.id ?? null);

        if (defaultStoreMode === 'last') {
          storeNameToSet = lastStoreName ?? '';
          storeIdToSet = lastStoreObj?.id ?? null;
        } else if (defaultStoreMode === 'fixed' && defaultStoreId) {
          const defaultStore = stores.find(s => s.id === parseInt(defaultStoreId));
          storeNameToSet = defaultStore?.name ?? '';
          storeIdToSet = defaultStore?.id ?? null;
        }

        setDefaultStoreName(storeNameToSet);
        setSelectedStoreId(storeIdToSet);
        isFirstLoad.current = false;

        if (storeIdToSet !== null) {
          await updatePricesForStore(storeIdToSet, enhancedShoppingItems);
        }
      }
    } catch (error) {

      console.error('Erro ao carregar dados:', error);
    } finally {
      setInitialLoading(false);
    }
  }, [listId, stores, defaultStoreMode, defaultStoreId, lastStoreName]);

  const updatePricesForStore = useCallback(async (storeId: number | null, items: ShoppingListItemWithDetails[]) => {
    try {
      const productIds = items.map(item => item.productId).filter(id => id > 0);
      if (productIds.length === 0) return;

      // Full 4-step lookup chain, in batch
      const referencePriceMap = await getReferencePricesForProducts(productIds, storeId);

      const updatedItems = items.map(item => {
        if (item.productId === 0) return item;
        const referencePrice = referencePriceMap.get(item.productId);
        return { ...item, price: referencePrice };
      });

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
    setShoppingListItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, checked: !item.checked } : i
    ));
    try {
      await updateShoppingListItem(item.id, { checked: !item.checked });
    } catch (error) {
      // revert on failure
      setShoppingListItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, checked: item.checked } : i
      ));
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

      if (price && price > 0) {
        const item = shoppingListItems.find(i => i.id === editingItem.id);
        if (item?.productId) {
          if (selectedStoreId !== null) {
            await upsertProductStorePrice(item.productId, selectedStoreId, price);
          } else {
            await upsertProductBasePrice(item.productId, price);
          }
        }
      }

      setEditingItem(null);
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  }, [editingItem, shoppingListItems, selectedStoreId]);

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

  const toggleCategory = useCallback((key: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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

  const rows = useMemo((): ListRow[] => {
    const result: ListRow[] = [];

    const buildSection = (
      items: ShoppingListItemWithDetails[],
      sectionType: 'pending' | 'cart',
      title: string,
      collapsed: boolean
    ) => {
      result.push({ type: 'section-header', title, sectionType });
      if (collapsed) return;

      if (sortOrder === 'category') {
        const grouped = new Map<string, ShoppingListItemWithDetails[]>();
        for (const item of items) {
          const key = item.categoryName ?? 'Sem categoria';
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(item);
        }
        for (const [category, catItems] of grouped) {
          const collapseKey = `${sectionType}:${category}`;
          result.push({ type: 'category-header', category, sectionType });
          if (!collapsedCategories.has(collapseKey)) {
            for (const item of catItems) {
              result.push({ type: 'item', item, sectionType });
            }
          }
        }
      } else {
        for (const item of items) {
          result.push({ type: 'item', item, sectionType });
        }
      }
    };

    buildSection(uncheckedItems, 'pending', `Pendentes (${uncheckedItems.length})`, false);
    buildSection(checkedItems, 'cart', `No carrinho (${checkedItems.length})`, isCartCollapsed);

    return result;
  }, [uncheckedItems, checkedItems, sortOrder, collapsedCategories, isCartCollapsed]);

  const renderItem = useCallback(({ item }: { item: ShoppingListItemWithDetails }) => (
    <ShoppingListItemCard
      item={item}
      onToggleChecked={() => handleToggleChecked(item)}
      onDelete={() => handleDeleteItem(item)}
      onEdit={() => setEditingItem(item)}
    />
  ), [handleToggleChecked, handleDeleteItem]);

  const renderRow = useCallback(({ item: row }: { item: ListRow }) => {
    if (row.type === 'section-header') {
      if (row.sectionType === 'cart') {
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 20 }}>
            <Text style={[localStyles.subsectionTitle, { color: theme.colors.onSurfaceVariant }]}>
              {row.title}
            </Text>
            <Button mode="text" onPress={() => setIsCartCollapsed(!isCartCollapsed)} compact>
              {isCartCollapsed ? 'Mostrar' : 'Ocultar'}
            </Button>
          </View>
        );
      }
      return (
        <Text style={[localStyles.subsectionTitle, { color: theme.colors.onSurfaceVariant, paddingVertical: 8, paddingHorizontal: 20 }]}>
          {row.title}
        </Text>
      );
    }

    if (row.type === 'category-header') {
      const collapseKey = `${row.sectionType}:${row.category}`;
      const isCollapsed = collapsedCategories.has(collapseKey);
      return (
        <Pressable
          onPress={() => toggleCategory(collapseKey)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.colors.surfaceVariant, borderRadius: 8, marginBottom: 4, marginTop: 8 }}
        >
          <Text style={{ color: theme.colors.onSurfaceVariant, textTransform: 'uppercase', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
            {row.category}
          </Text>
          <MaterialCommunityIcons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
      );
    }

    return (
      <ShoppingListItemCard
        item={row.item}
        onToggleChecked={() => handleToggleChecked(row.item)}
        onDelete={() => handleDeleteItem(row.item)}
        onEdit={() => setEditingItem(row.item)}
      />
    );
  }, [theme, isCartCollapsed, collapsedCategories, toggleCategory, handleToggleChecked, handleDeleteItem]);

  const listEmptyComponent = useCallback(() => (
    <View style={{ paddingHorizontal: 16 }}>
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
    </View>
  ), [theme]);

  const openConfirmConclude = useCallback(() => {
    if (checkedItems.length === 0) return;
    setConfirmVisible(true);
  }, [checkedItems.length]);

  const handleConfirmConclude = useCallback(async (storeName: string, date: Date) => {
    if (checkedItems.length === 0) return;
    setLoading(true);
    try {
      await concludeShoppingForListWithInvoice(listId, storeName, date);
      const store = stores.find(s => s.name === storeName);
      if (store) {
        await setSetting('defaultStoreId', store.id.toString());
      }
      setConfirmVisible(false);
      await refreshStoreSettings();
      await loadData();
    } catch (error) {
      console.error('Erro ao concluir compras:', error);
    } finally {
      setLoading(false);
    }
  }, [checkedItems.length, listId, stores, loadData, refreshStoreSettings]);

  const totalCheckedPrice = checkedItems.reduce((total, item) => {
    if (item.price) return total + item.quantity * item.price;
    return total;
  }, 0);

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

  const copyShoppingList = useCallback(async () => {
    const text = generateShoppingListText(shoppingListItems);
    await Clipboard.setStringAsync(text);
    Alert.alert('Lista copiada!', 'Pronta para importar no estoque.');
  }, [shoppingListItems]);

  const bottomBarHeight = checkedItems.length > 0 ? 64 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ContextualHeader
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />

      <View style={[localStyles.topRow, { borderBottomColor: theme.colors.outlineVariant }]}>
        <StoreSelector
          stores={stores}
          selectedStoreId={selectedStoreId}
          onStoreChange={(id) => {
            if (id === null) {
              setSelectedStoreId(null);
              setDefaultStoreName('');
              updatePricesForStore(null, shoppingListItems);
            } else {
              handleStoreSelect(id);
            }
          }}
          nullOptionLabel="Sem loja"
        />

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
        <Pressable
          onPress={() => setActionsVisible(true)}
          style={({ pressed }) => ({
            padding: 8,
            borderRadius: 20,
            backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
          })}
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={22}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
      </View>

      {initialLoading ? (
        <ShoppingListSkeleton />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row, index) =>
            row.type === 'item' ? row.item.id.toString() : `${row.type}-${index}`
          }
          renderItem={renderRow}
          ListEmptyComponent={listEmptyComponent}
          contentContainerStyle={{ paddingBottom: bottomBarHeight + 96 }}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
        />
      )}

      <AddItemButton
        onPress={() => navigation.navigate('AddProductToShoppingList', { listId })}
        label="Adicionar à Lista de Compras"
        style={checkedItems.length > 0 ? { bottom: bottomBarHeight } : undefined}
      />

      <EditShoppingItemModal
        visible={editingItem !== null}
        item={editingItem}
        inventoryItem={editingItem ? findByProductId(editingItem.productId) : undefined}
        onSave={handleSaveEdit}
        onToggleChecked={async () => {
          if (!editingItem) return;
          const updated = { ...editingItem, checked: !editingItem.checked };
          setEditingItem(updated);
          await handleToggleChecked(editingItem);
        }}
        onDelete={() => { handleDeleteItem(editingItem!); setEditingItem(null); }}
        onDismiss={() => setEditingItem(null)}
        onCategoryChange={() => { }}
        categories={categories}
        onCategorySelect={handleCategorySelect}
        key={editingItem?.id ?? 'none'}
      />

      <Modal
        visible={actionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setActionsVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingHorizontal: 16,
              paddingBottom: 32,
              paddingTop: 12,
              elevation: 8,
            }}
            onPress={() => { }}
          >
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: theme.colors.outlineVariant,
              alignSelf: 'center', marginBottom: 16,
            }} />
            <Text style={{
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: theme.colors.onSurfaceVariant,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}>
              Ações
            </Text>
            {[
              { icon: 'content-copy', label: 'Copiar lista', onPress: copyShoppingList },
              { icon: 'import', label: 'Importar lista', onPress: () => setImportModalVisible(true) },
              {
                icon: 'cart-remove',
                label: 'Limpar carrinho',
                onPress: async () => {
                  const unchecked = shoppingListItems.map(i => ({ ...i, checked: false }));
                  setShoppingListItems(unchecked);
                  await Promise.all(
                    shoppingListItems.filter(i => i.checked).map(i =>
                      updateShoppingListItem(i.id, { checked: false })
                    )
                  );
                }
              },
            ].map(action => (
              <Pressable
                key={action.label}
                onPress={() => { setActionsVisible(false); action.onPress(); }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  marginBottom: 2,
                  backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
                })}
              >
                <MaterialCommunityIcons
                  name={action.icon as any}
                  size={20}
                  color={theme.colors.onSurface}
                  style={{ marginRight: 12 }}
                />
                <Text style={{ fontSize: 15, color: theme.colors.onSurface }}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <ImportModal
        isImportModalVisible={importModalVisible}
        setIsImportModalVisible={setImportModalVisible}
        loadItems={loadData}
        listId={listId}
        applyMatch={async ({ productName, product }) => {
          await addShoppingListItem(listId, productName, product.quantity);
        }}
        applyNew={async ({ product }) => {
          const productId = await addProduct(product.originalName);
          await addShoppingListItem(listId, product.originalName, product.quantity);
          return { productId, productName: product.originalName };
        }}
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
        total={totalCheckedPrice}
        onConfirm={handleConfirmConclude}
        onDismiss={() => setConfirmVisible(false)}
        loading={loading}
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