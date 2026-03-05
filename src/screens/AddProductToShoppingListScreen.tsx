import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, FlatList, Pressable, Alert } from 'react-native';
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
  // originalQuantity: null means item didn't exist before this session
  const sessionChangesRef = useRef<Map<number, { inventoryItemId: number; originalQuantity: number | null }>>(new Map());
  const [sessionChanges, setSessionChanges] = useState<Map<number, { inventoryItemId: number; originalQuantity: number | null }>>(new Map());
  const confirmedRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  const updateSessionChanges = useCallback((
    inventoryItemId: number, 
    data: { inventoryItemId: number; originalQuantity: number | null } | null
  ) => {
    if (data === null) {
      sessionChangesRef.current.delete(inventoryItemId);
    } else {
      sessionChangesRef.current.set(inventoryItemId, data);
    }
    setSessionChanges(new Map(sessionChangesRef.current));
  }, []);

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

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (sessionChangesRef.current.size === 0 || confirmedRef.current) return;
      
      e.preventDefault();
      
      const count = sessionChangesRef.current.size;
      Alert.alert(
        'Sair sem confirmar?',
        `Você modificou ${count} ${count === 1 ? 'item' : 'itens'} na lista.`,
        [
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: async () => {
              // Revert all session changes
              for (const [inventoryItemId, change] of sessionChangesRef.current) {
                const current = shoppingListByInventoryId.get(inventoryItemId);
                if (change.originalQuantity === null) {
                  // Was added this session — delete it
                  if (current) await deleteShoppingListItem(current.id);
                } else {
                  // Was modified — restore original quantity
                  if (current) {
                    if (change.originalQuantity === 0) {
                      await deleteShoppingListItem(current.id);
                    } else {
                      await updateShoppingListItem(current.id, { quantity: change.originalQuantity });
                    }
                  }
                }
              }
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Confirmar',
            style: 'default',
            onPress: () => {
              confirmedRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, shoppingListByInventoryId]);

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
      // Record original state before first modification
      if (!sessionChangesRef.current.has(item.id)) {
        updateSessionChanges(item.id, {
          inventoryItemId: item.id,
          originalQuantity: existing ? existing.quantity : null,
        });
      }
      if (existing) {
        await updateShoppingListItem(existing.id, { quantity: existing.quantity + 1 });
      } else {
        await addShoppingListItem(listId, item.productName, 1);
      }
      await loadData();
    } catch (error) {
      console.error('Erro ao adicionar:', error);
    }
  }, [shoppingListByInventoryId, listId, loadData, updateSessionChanges]);

  const handleMinus = useCallback(async (item: InventoryItem) => {
    const existing = shoppingListByInventoryId.get(item.id);
    if (!existing) return;
    try {
      // Record original state before first modification
      if (!sessionChangesRef.current.has(item.id)) {
        updateSessionChanges(item.id, {
          inventoryItemId: item.id,
          originalQuantity: existing.quantity,
        });
      }
      if (existing.quantity <= 1) {
        await deleteShoppingListItem(existing.id);
      } else {
        await updateShoppingListItem(existing.id, { quantity: existing.quantity - 1 });
      }
      await loadData();
    } catch (error) {
      console.error('Erro ao decrementar:', error);
    }
  }, [shoppingListByInventoryId, loadData, updateSessionChanges]);

  const renderSessionChangesSection = useCallback(() => {
    if (sessionChanges.size === 0) return null;
    const changedItems = inventoryItems.filter(item => 
      sessionChanges.has(item.id)
    );
    if (changedItems.length === 0) return null;
    return (
      <View>
        <Text variant="labelMedium" style={{
          paddingHorizontal: 4,
          paddingBottom: 8,
          paddingTop: 4,
          color: theme.colors.primary,
          fontWeight: '700',
          textTransform: 'uppercase',
          fontSize: 11,
        }}>
          Modificados agora
        </Text>
        {changedItems.map(item => {
          const listInfo = shoppingListByInventoryId.get(item.id);
          const isOnList = !!listInfo;
          return (
            <ProductSearchRow
              key={item.id}
              productName={item.productName}
              stockQuantity={item.quantity}
              listQuantity={listInfo?.quantity}
              isOnList={isOnList}
              onPlus={() => handlePlus(item)}
              onMinus={() => handleMinus(item)}
            />
          );
        })}
        <View style={{
          height: 1,
          backgroundColor: theme.colors.outlineVariant,
          marginVertical: 12,
        }} />
      </View>
    );
  }, [sessionChanges, inventoryItems, shoppingListByInventoryId, handlePlus, handleMinus, theme]);

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
        {searchQuery.trim() ? (
          <Pressable onPress={handleAddNewProduct}>
            <Surface style={{ borderRadius: 8, elevation: 1, marginBottom: 8 }}>
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
        ) : null}
        <View style={styles.buttonRow}>
          {sessionChanges.size > 0 ? (
            <Chip
              icon="arrow-up"
              mode="flat"
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              style={{ backgroundColor: theme.colors.primaryContainer }}
              textStyle={{ color: theme.colors.primary }}
            >
              {sessionChanges.size} {sessionChanges.size === 1 ? 'modificado' : 'modificados'}
            </Chip>
          ) : null}
          <SortMenu setSortOrder={setSortOrder} />
        </View>
      </View>
      <FlatList
        ref={flatListRef}
        data={filteredAndSortedInventory}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderInventoryRow}
        ListHeaderComponent={() => (
          <View>
            {renderSessionChangesSection()}
            {filteredAndSortedInventory.length > 0 ? (
              <Text variant="labelMedium" style={{
                paddingHorizontal: 4,
                paddingBottom: 8,
                color: theme.colors.onSurfaceVariant,
                textTransform: 'uppercase',
                fontSize: 11,
              }}>
                Produtos
              </Text>
            ) : null}
          </View>
        )}
        contentContainerStyle={styles.list}
      />
      <FAB
        style={styles.fab}
        icon="check"
        onPress={() => {
          confirmedRef.current = true;
          navigation.goBack();
        }}
        label="Concluído"
      />
    </SafeAreaView>
  );
}
