import React, { useState, useCallback } from "react";
import { View, Alert, } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Button,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";
import {
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import {
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { RootStackParamList } from "../types/navigation";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { generateStockListText } from "../utils/stringUtils";
import ImportModal from "../components/ImportModal";
import useInventory from "../hooks/useInventory";
import { SortOrder } from "../utils/sortUtils";
import SearchBar from "../components/SearchBar";
import { useList } from "../hooks/useList";
import { SortMenu } from "../components/SortMenu";
import { AddItemButton } from "../components/AddItemButton";
import InventoryList from "../components/InventoryList";
import ContextualHeader from "../components/ContextualHeader";
import { deleteInventoryItem } from "../database/database";
import { useListContext } from "../context/ListContext";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "MainTabs"
>;

export default function HomeScreen() {
  const { listId } = useListContext();

  const navigation = useNavigation<HomeScreenNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [sortOrder, setSortOrder] = useState<SortOrder>("custom");
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const {
    inventoryItems,
    loadInventoryItems,
    saveInventoryHistorySnapshot,
    handleProductOrderChange,
    filteredInventoryItems,
  } = useInventory(listId, sortOrder, searchQuery);

  const { listName, handleListNameSave, handleListDelete } = useList(listId);

  const handleImportButtonClick = useCallback(() => {
    setIsImportModalVisible(true);
  }, []);

  const handleSortOrderChange = useCallback((order: SortOrder) => {
    setSortOrder(order);
  }, []);

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleEnterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds([]);
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const saveAndCopyStockList = useCallback(async () => {
    try {
      for (const inventoryItem of inventoryItems) {
        await saveInventoryHistorySnapshot(inventoryItem.id);
      }
      const text = generateStockListText(inventoryItems);
      Clipboard.setStringAsync(text);
      Alert.alert("Sucesso", "Lista de estoque copiada para a área de transferência!");
    } catch (error) {
      console.error("Erro ao salvar histórico e copiar lista:", error);
      Alert.alert("Erro", "Não foi possível copiar a lista de estoque.");
    }
  }, [inventoryItems, saveInventoryHistorySnapshot]);

  const handleDeleteSelected = useCallback(() => {
    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja excluir ${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'itens'} do estoque?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            for (const id of selectedIds) {
              await deleteInventoryItem(id);
            }
            await loadInventoryItems();
            handleExitSelectionMode();
          },
        },
      ]
    );
  }, [selectedIds, loadInventoryItems, handleExitSelectionMode]);

  // useFocusEffect is still crucial here to ensure the list refreshes
  // after single product operations (update, delete) performed via useProduct.

  useFocusEffect(
    useCallback(() => {
      loadInventoryItems();
    }, [sortOrder, loadInventoryItems])
  );


  return (
    <SafeAreaView style={styles.container}>
      <ContextualHeader 
        listName={listName} 
        onListNameSave={handleListNameSave}
        onListDelete={handleListDelete}
      />
      
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          </View>
          <SortMenu setSortOrder={handleSortOrderChange} sortOrder={sortOrder} iconOnly />
        </View>
        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            onPress={saveAndCopyStockList}
            style={styles.button}
            icon="content-copy"
            labelStyle={styles.buttonText}
          >
            Salvar
          </Button>
          <Button
            mode="contained"
            onPress={handleImportButtonClick}
            icon="import"
            style={styles.button}
            labelStyle={styles.buttonText}
          >
            Importar
          </Button>
        </View>
      </View>

      {isSelectionMode && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: theme.colors.secondaryContainer,
        }}>
          <Text variant="bodyMedium">
            {selectedIds.length} selecionado{selectedIds.length !== 1 ? 's' : ''}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon="delete"
              iconColor={theme.colors.error}
              onPress={handleDeleteSelected}
              disabled={selectedIds.length === 0}
            />
            <IconButton
              icon="close"
              onPress={handleExitSelectionMode}
            />
          </View>
        </View>
      )}

      <InventoryList
        inventoryItems={filteredInventoryItems}
        handleInventoryItemOrderChange={handleProductOrderChange}
        onInventoryItemUpdated={loadInventoryItems}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onLongPressStart={handleEnterSelectionMode}
      />
      <AddItemButton
        onPress={() => navigation.navigate("AddInventoryItem", { listId })}
        label="Adicionar ao Inventário"
      />
      <ImportModal
        isImportModalVisible={isImportModalVisible}
        setIsImportModalVisible={setIsImportModalVisible}
        loadItems={loadInventoryItems}
        listId={listId}
      />
    </SafeAreaView>
  );
}
