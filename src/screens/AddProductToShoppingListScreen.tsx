import React, { useState, useCallback, useMemo } from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { Surface, Text, useTheme, FAB, Chip } from 'react-native-paper';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getInventoryItems,
  getShoppingListItemsByListId,
  addShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
} from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { InventoryItem } from '../database/models';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import SearchBar from '../components/SearchBar';
import { SortMenu } from '../components/SortMenu';
import { sortInventoryItems, SortOrder } from '../utils/sortUtils';
import { preprocessName, calculateSimilarity } from '../utils/similarityUtils';
import { useListContext } from '../context/ListContext';
import { ProductSearchRow } from '../components/ProductSearchRow';

const searchSimilarityThreshold = 0.4;

type AddProductToShoppingListNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AddProductToShoppingList'
>;

type RouteParams = { listId?: number };

export default function AddProductToShoppingListScreen() {
  const route = useRoute();
  const navigation = useNavigation<AddProductToShoppingListNavigationProp>();
  const { listId: contextListId } = useListContext();
  const listId = (route.params as RouteParams)?.listId ?? contextListId ?? 1;

  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('quantityAsc');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [shoppingListByInventoryId, setShoppingListByInventoryId] = useState<
    Map<number, { id: number; quantity: number }>
  >(new Map());

  const loadData = useCallback(async () => {
    try {
      const [inventory, shopping] = await Promise.all([
        getInventoryItems(listId),
        getShoppingListItemsByListId(listId),
      ]);
      setInventoryItems(inventory);
      const map = new Map<number, { id: number; quantity: number }>();
      shopping.forEach((item) => {
        map.set(item.inventoryItemId, { id: item.id, quantity: item.quantity });
      });
      setShoppingListByInventoryId(map);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  }, [listId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredAndSortedInventory = useMemo(() => {
    const filtered = inventoryItems.filter((item) => {
      const processedName = preprocessName(item.productName);
      const processedQuery = preprocessName(searchQuery);
      if (!processedQuery) return true;
      const nameLength = processedName.length;
      const queryLength = processedQuery.length;
      const lengthThreshold = Math.ceil(nameLength * 0.5);
      if (queryLength < lengthThreshold) {
        return processedName.includes(processedQuery);
      }
      return calculateSimilarity(processedName, processedQuery) >= searchSimilarityThreshold;
    });
    return sortInventoryItems(filtered, sortOrder, searchQuery);
  }, [inventoryItems, searchQuery, sortOrder]);

  const handleAddNewProduct = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      await addShoppingListItem(listId, searchQuery.trim(), 1);
      await loadData();
      setSearchQuery('');
    } catch (error) {
      console.error('Erro ao adicionar novo produto:', error);
    }
  }, [searchQuery, listId, loadData]);

  const handlePlus = useCallback(async (item: InventoryItem) => {
    try {
      const existing = shoppingListByInventoryId.get(item.id);
      if (existing) {
        await updateShoppingListItem(existing.id, { quantity: existing.quantity + 1 });
      } else {
        await addShoppingListItem(listId, item.productName, 1);
      }
      await loadData();
    } catch (error) {
      console.error('Erro ao adicionar:', error);
    }
  }, [shoppingListByInventoryId, listId, loadData]);

  const handleMinus = useCallback(async (item: InventoryItem) => {
    const existing = shoppingListByInventoryId.get(item.id);
    if (!existing) return;
    try {
      if (existing.quantity <= 1) {
        await deleteShoppingListItem(existing.id);
      } else {
        await updateShoppingListItem(existing.id, { quantity: existing.quantity - 1 });
      }
      await loadData();
    } catch (error) {
      console.error('Erro ao decrementar:', error);
    }
  }, [shoppingListByInventoryId, loadData]);

  const renderNewProductRow = useCallback(() => {
    if (!searchQuery.trim()) return null;
    return (
      <Pressable onPress={handleAddNewProduct}>
        <Surface style={{ marginBottom: 8, borderRadius: 8, elevation: 1 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            gap: 12,
          }}>
            <Chip icon="plus" mode="outlined" onPress={handleAddNewProduct}>
              Criar "{searchQuery.trim()}"
            </Chip>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>
              novo produto
            </Text>
          </View>
        </Surface>
      </Pressable>
    );
  }, [searchQuery, handleAddNewProduct, theme]);

  const renderInventoryRow = useCallback(({ item }: { item: InventoryItem }) => {
    const listInfo = shoppingListByInventoryId.get(item.id);
    const isOnList = !!listInfo;

    return (
      <ProductSearchRow
        productName={item.productName}
        stockQuantity={item.quantity}
        listQuantity={listInfo?.quantity}
        isOnList={isOnList}
        onPlus={() => handlePlus(item)}
        onMinus={() => handleMinus(item)}
      />
    );
  }, [shoppingListByInventoryId, handlePlus, handleMinus]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Procurar ou incluir novo item"
        />
        <View style={styles.buttonRow}>
          <SortMenu setSortOrder={setSortOrder} />
        </View>
      </View>
      <FlatList
        data={filteredAndSortedInventory}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderInventoryRow}
        ListHeaderComponent={renderNewProductRow}
        contentContainerStyle={styles.list}
      />
      <FAB
        style={styles.fab}
        icon="check"
        onPress={() => navigation.goBack()}
        label="Concluído"
      />
    </SafeAreaView>
  );
}
