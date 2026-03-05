import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, FlatList, Pressable, Alert } from 'react-native';
import { Surface, Text, useTheme, FAB, Chip } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  getInventoryItems, 
  addInventoryItem, 
  addProduct, 
  getProducts,
  deleteInventoryItem,
} from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { Product } from '../database/models';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import SearchBar from '../components/SearchBar';
import { sortInventoryItems, SortOrder } from '../utils/sortUtils';
import { preprocessName, calculateSimilarity } from '../utils/similarityUtils';
import { useListContext } from '../context/ListContext';
import { ProductSearchRow } from '../components/ProductSearchRow';
import ContextualHeader from '../components/ContextualHeader';
import { useList } from '../hooks/useList';
import { SortMenu } from '../components/SortMenu';
import { useInventoryItem } from '../hooks/useInventoryItem';

const searchSimilarityThreshold = 0.4;

type AddInventoryItemScreenProps = NativeStackScreenProps<RootStackParamList, 'AddInventoryItem'>;

interface JustAddedRowProps {
  product: Product;
  inventoryItemId: number;
  onRemove: () => void;
}

const JustAddedRow = ({ product, inventoryItemId, onRemove }: JustAddedRowProps) => {
  const {
    quantity,
    updateInventoryItemQuantity,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  } = useInventoryItem({
    inventoryItemId,
    initialQuantity: 1,
    productName: product.name,
  });

  return (
    <ProductSearchRow
      productName={product.name}
      isOnList={true}
      listQuantity={quantity}
      onPlus={() => updateInventoryItemQuantity(quantity + 1)}
      onMinus={() => {
        if (quantity <= 1) onRemove();
        else updateInventoryItemQuantity(quantity - 1);
      }}
      onStartContinuousIncrement={() => startContinuousAdjustment(true)}
      onStartContinuousDecrement={() => startContinuousAdjustment(false)}
      onStopContinuous={stopContinuousAdjustment}
    />
  );
};

export default function AddInventoryItemScreen() {
  const route = useRoute<AddInventoryItemScreenProps['route']>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { listId: contextListId } = useListContext();
  const listId = route.params?.listId ?? contextListId ?? 1;

  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [existingInventoryProductIds, setExistingInventoryProductIds] = useState<Set<number>>(new Set());
  const justAddedRef = useRef<Map<number, number>>(new Map()); // productId -> inventoryItemId
  const [justAdded, setJustAdded] = useState<Map<number, number>>(new Map());
  const confirmedRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('custom');
  const { listName, handleListNameSave, handleListDelete } = useList(listId);

  const updateJustAdded = useCallback((productId: number, inventoryItemId: number | null) => {
    if (inventoryItemId === null) {
      justAddedRef.current.delete(productId);
    } else {
      justAddedRef.current.set(productId, inventoryItemId);
    }
    setJustAdded(new Map(justAddedRef.current));
  }, []);

  const loadData = useCallback(async () => {
    const [products, inventory] = await Promise.all([
      getProducts(),
      getInventoryItems(listId),
    ]);
    setAllProducts(products);
    const existingIds = new Set(inventory.map(item => item.productId));
    setExistingInventoryProductIds(existingIds);
  }, [listId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (justAddedRef.current.size === 0 || confirmedRef.current) return;
      
      e.preventDefault();
      
      Alert.alert(
        'Sair sem confirmar?',
        `Você adicionou ${justAddedRef.current.size} ${justAddedRef.current.size === 1 ? 'produto' : 'produtos'} ao estoque. Deseja mantê-los ou desfazer?`,
        [
          {
            text: 'Desfazer',
            style: 'destructive',
            onPress: async () => {
              await Promise.all(
                Array.from(justAddedRef.current.values()).map(id => deleteInventoryItem(id))
              );
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Manter',
            style: 'default',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation]);

  const filteredProducts = useMemo(() => {
    const filtered = allProducts.filter((product) => {
      // Exclude products already in inventory
      if (existingInventoryProductIds.has(product.id)) return false;
      // Exclude products just added in this session
      if (justAdded.has(product.id)) return false;
      
      // Apply search filter
      const processedName = preprocessName(product.name);
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
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts, existingInventoryProductIds, justAdded, searchQuery]);

  const handleAddNewProduct = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      const productId = await addProduct(searchQuery.trim());
      const inventoryItemId = await addInventoryItem(listId, productId, 1);
      await loadData();
      updateJustAdded(productId, inventoryItemId);
      setSearchQuery('');
    } catch (error) {
      console.error('Erro ao criar produto:', error);
    }
  }, [searchQuery, listId, updateJustAdded, loadData]);

  const handlePlus = useCallback(async (product: Product) => {
    console.log('handlePlus called with product:', product);
    console.log('product.id:', product?.id);
    console.log('listId:', listId);
    try {
      const inventoryItemId = await addInventoryItem(listId, product.id, 1);
      console.log('addInventoryItem returned:', inventoryItemId);
      updateJustAdded(product.id, inventoryItemId);
    } catch (error) {
      console.error('Erro ao adicionar ao inventário:', error);
    }
  }, [listId, updateJustAdded]);

  const renderJustAddedSection = useCallback(() => {
    if (justAdded.size === 0) return null;
    const items = allProducts.filter(p => justAdded.has(p.id));
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
          Adicionados agora
        </Text>
        {items.map(product => (
          <JustAddedRow
            key={product.id}
            product={product}
            inventoryItemId={justAdded.get(product.id)!}
            onRemove={async () => {
              const inventoryItemId = justAdded.get(product.id)!;
              updateJustAdded(product.id, null);
              await deleteInventoryItem(inventoryItemId);
            }}
          />
        ))}
        <View style={{ 
          height: 1, 
          backgroundColor: theme.colors.outlineVariant,
          marginVertical: 12,
        }} />
      </View>
    );
  }, [justAdded, allProducts, updateJustAdded, theme]);

  const renderNewProductRow = useCallback(() => {
    if (!searchQuery.trim()) return null;
    return (
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
              Criar produto "{searchQuery.trim()}"
            </Chip>
          </View>
        </Surface>
      </Pressable>
    );
  }, [searchQuery, handleAddNewProduct]);

  const renderInventoryRow = useCallback(({ item }: { item: Product }) => (
    <ProductSearchRow
      productName={item.name}
      isOnList={false}
      onPlus={() => handlePlus(item)}
    />
  ), [handlePlus]);

  return (
    <SafeAreaView style={styles.container}>
      <ContextualHeader
        listName={listName}
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />
      <View style={styles.header}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          placeholder="Buscar ou criar produto"
          autoFocus
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
                  Criar produto "{searchQuery.trim()}"
                </Chip>
              </View>
            </Surface>
          </Pressable>
        ) : null}
        <View style={styles.buttonRow}>
          {justAdded.size > 0 ? (
            <Chip
              icon="arrow-up"
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              mode="flat"
              style={{ backgroundColor: theme.colors.primaryContainer }}
              textStyle={{ color: theme.colors.primary }}
            >
              {justAdded.size} {justAdded.size === 1 ? 'adicionado' : 'adicionados'}
            </Chip>
          ) : null}
          <SortMenu setSortOrder={setSortOrder} />
        </View>
      </View>
      <FlatList
        ref={flatListRef}
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderInventoryRow}
        ListHeaderComponent={() => (
          <View>
            {renderJustAddedSection()}
            {filteredProducts.length > 0 ? (
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