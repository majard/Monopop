import React, { useState, useCallback } from "react";
import { View, Alert, Modal, Pressable, StyleSheet } from "react-native";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
import { ActionMenuButton } from "../components/ActionMenuButton";

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
  const [actionsVisible, setActionsVisible] = useState(false);

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

  const saveStockList = useCallback(async () => {
    try {
      for (const inventoryItem of inventoryItems) {
        await saveInventoryHistorySnapshot(inventoryItem.id);
      }
      Alert.alert("Sucesso", "Histórico de estoque salvo!");
    } catch (error) {
      console.error("Erro ao salvar histórico:", error);
      Alert.alert("Erro", "Não foi possível salvar o histórico.");
    }
  }, [inventoryItems, saveInventoryHistorySnapshot]);

  const copyStockList = useCallback(async () => {
    try {
      const text = generateStockListText(inventoryItems);
      await Clipboard.setStringAsync(text);
      Alert.alert(
        "Lista copiada!",
        "Deseja também salvar o histórico de estoque?",
        [
          { text: "Não", style: "cancel" },
          { text: "Salvar", onPress: saveStockList },
        ]
      );
    } catch (error) {
      console.error("Erro ao copiar lista:", error);
      Alert.alert("Erro", "Não foi possível copiar a lista.");
    }
  }, [inventoryItems, saveStockList]);

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
      
      <View style={[homeStyles.topRow, { borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={homeStyles.searchWrapper}>
          <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        </View>
        <SortMenu setSortOrder={handleSortOrderChange} sortOrder={sortOrder} iconOnly />
        <ActionMenuButton onPress={() => setActionsVisible(true)} />
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
        sortOrder={sortOrder}
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
            onPress={() => {}}
          >
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: theme.colors.outlineVariant,
              alignSelf: 'center', marginBottom: 16,
            }} />
            <Text variant="titleSmall" style={{
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: theme.colors.onSurfaceVariant,
              marginBottom: 8,
              paddingHorizontal: 4,
            }}>
              Ações
            </Text>

            {[
              { icon: 'content-copy', label: 'Copiar lista', onPress: copyStockList },
              { icon: 'content-save-outline', label: 'Salvar histórico', onPress: saveStockList },
              { icon: 'import', label: 'Importar', onPress: handleImportButtonClick },
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
    </SafeAreaView>
  );
}

const homeStyles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 4,
  },
  searchWrapper: {
    flex: 1,
  },
});
