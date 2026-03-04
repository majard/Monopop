import React, { useState, useCallback } from "react";
import { View, Alert, } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Button,
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
import { EditableName } from "../components/EditableName";
import { AddItemButton } from "../components/AddItemButton";
import InventoryList from "../components/InventoryList";
import ContextualHeader from "../components/ContextualHeader";
import { saveInventoryHistorySnapshot } from "../database/database";
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

  // useFocusEffect is still crucial here to ensure the list refreshes
  // after single product operations (update, delete) performed via useProduct.

  useFocusEffect(
    useCallback(() => {
      loadInventoryItems();
    }, [sortOrder, loadInventoryItems])
  );

  const saveAndCopyStockList = async () => {
    try {
      for (const inventoryItem of inventoryItems) {

        await saveInventoryHistorySnapshot(inventoryItem.id);
      }
      const text = generateStockListText(inventoryItems);
      Clipboard.setStringAsync(text);
      Alert.alert(
        "Sucesso",
        "Lista de estoque copiada para a área de transferência!"
      );
    } catch (error) {
      console.error("Erro ao salvar histórico e copiar lista:", error);
      Alert.alert("Erro", "Não foi possível copiar a lista de estoque.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ContextualHeader listName={listName} />
      
      <View style={styles.header}>
        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

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

          <SortMenu setSortOrder={handleSortOrderChange} />
        </View>
      </View>

      <InventoryList
        inventoryItems={filteredInventoryItems}
        handleInventoryItemOrderChange={handleProductOrderChange}
        onInventoryItemUpdated={loadInventoryItems}
      />
      <AddItemButton
        onPress={() => navigation.navigate("AddInventoryItem", { listId })}
        label="Adicionar ao Estoque"
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
