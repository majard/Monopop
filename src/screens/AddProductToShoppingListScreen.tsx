import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Surface, IconButton, useTheme, FAB } from "react-native-paper";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getInventoryItems,
  getShoppingListItemsByListId,
  addShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
} from "../database/database";
import { RootStackParamList } from "../types/navigation";
import { InventoryItem } from "../database/models";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import SearchBar from "../components/SearchBar";
import { SortMenu } from "../components/SortMenu";
import { sortInventoryItems, SortOrder } from "../utils/sortUtils";
import { preprocessName, calculateSimilarity } from "../utils/similarityUtils";
import { useListContext } from "../context/ListContext";

const searchSimilarityThreshold = 0.4;

type AddProductToShoppingListNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "AddProductToShoppingList"
>;

type RouteParams = { listId?: number };

export default function AddProductToShoppingListScreen() {
  const route = useRoute();
  const navigation = useNavigation<AddProductToShoppingListNavigationProp>();
  const { listId: contextListId } = useListContext();
  const listId = (route.params as RouteParams)?.listId ?? contextListId ?? 1;

  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("quantityAsc");
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
      console.error("Erro ao carregar dados:", error);
    }
  }, [listId]);

  useFocusEffect(
    React.useCallback(() => {
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
      const similarity = calculateSimilarity(processedName, processedQuery);
      return similarity >= searchSimilarityThreshold;
    });
    return sortInventoryItems(filtered, sortOrder, searchQuery);
  }, [inventoryItems, searchQuery, sortOrder]);

  const handleAddNewProduct = async () => {
    if (!searchQuery.trim()) return;
    try {
      await addShoppingListItem(listId, searchQuery.trim(), 1);
      await loadData();
    } catch (error) {
      console.error("Erro ao adicionar novo produto:", error);
    }
  };

  const handlePlus = async (item: InventoryItem) => {
    try {
      const existing = shoppingListByInventoryId.get(item.id);
      if (existing) {
        await updateShoppingListItem(existing.id, { quantity: existing.quantity + 1 });
      } else {
        await addShoppingListItem(listId, item.productName, 1);
      }
      await loadData();
    } catch (error) {
      console.error("Erro ao adicionar:", error);
    }
  };

  const handleMinus = async (item: InventoryItem) => {
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
      console.error("Erro ao decrementar:", error);
    }
  };

  const renderNewProductRow = () => (
    <Pressable onPress={handleAddNewProduct} style={localStyles.row}>
      <View style={localStyles.rowLeft} />
      <View style={localStyles.rowCenter}>
        <Text style={localStyles.productName}>{searchQuery.trim()}</Text>
        <Text style={localStyles.hintText}>Adicionar novo produto</Text>
      </View>
      <IconButton icon="plus" size={24} onPress={handleAddNewProduct} iconColor={theme.colors.primary} />
    </Pressable>
  );

  const renderInventoryRow = ({ item }: { item: InventoryItem }) => {
    const listInfo = shoppingListByInventoryId.get(item.id);
    const isOnList = !!listInfo;
    const isQtyOne = isOnList && listInfo.quantity === 1;

    return (
      <Surface style={localStyles.rowSurface}>
        <View style={localStyles.row}>
          <View style={localStyles.rowLeft}>
            {isOnList ? (
              <IconButton
                icon={isQtyOne ? "delete" : "minus"}
                size={24}
                onPress={() => handleMinus(item)}
                iconColor={theme.colors.error}
              />
            ) : (
              <View style={localStyles.placeholderIcon} />
            )}
          </View>
          <View style={localStyles.rowCenter}>
            <View style={localStyles.nameRow}>
              <Text style={localStyles.productName}>{item.productName}</Text>
              {isOnList ? (
                <Text style={localStyles.listQuantity}>{listInfo.quantity}</Text>
              ) : null}
            </View>
            <Text style={localStyles.estoqueLabel}>Estoque: {item.quantity}</Text>
          </View>
          <IconButton
            icon="plus"
            size={24}
            onPress={() => handlePlus(item)}
            iconColor={isOnList ? theme.colors.primary : theme.colors.outline}
          />
        </View>
      </Surface>
    );
  };

  const listHeader = searchQuery.trim() ? renderNewProductRow() : null;

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
        ListHeaderComponent={listHeader}
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

const localStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rowSurface: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  rowLeft: {
    width: 48,
    alignItems: "center",
  },
  rowCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  productName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  listQuantity: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginLeft: 6,
  },
  estoqueLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  placeholderIcon: {
    width: 48,
    height: 48,
  },
});
