import { parseISO, isSameDay } from "date-fns";
import React, { useState } from "react";
import { Modal, View, Text, TextInput } from "react-native";
import { Button, Portal } from "react-native-paper";
import { useTheme } from "react-native-paper";
import {
  saveInventoryHistorySnapshot,
  getInventoryHistory,
  addProduct,
  addInventoryItem,
  updateInventoryItem,
} from "../database/database";
import { InventoryHistory } from "../database/models";
import { ConfirmationModal, ImportSummaryModal } from "./ImportConfirmationModal";
import { useImportEngine } from "../hooks/useImportEngine";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";

type UseImportEngineOptions = Parameters<typeof useImportEngine>[0];

const applyImportToInventoryItem = async (
  inventoryItemId: number,
  quantity: number,
  importDate: Date | null
) => {
  const productHistory = await getInventoryHistory(inventoryItemId);
  const shouldUpdate = importDate
    ? !checkDateExists(productHistory, importDate)
    : true;

  if (shouldUpdate) {
    await updateInventoryItem(inventoryItemId, quantity);
  }
    
  if (importDate) {
    await saveInventoryHistorySnapshot(inventoryItemId, quantity, importDate);
  }
};

const checkDateExists = (array: InventoryHistory[], targetDate: Date) => {
  if (array.length === 0) return false;
  const parsedTarget = parseISO(targetDate.toISOString());
  return array.some((item) => isSameDay(parseISO(item.date), parsedTarget));
};

const getLastHistoryDate = (productHistory: InventoryHistory[]): Date | null => {
  if (productHistory.length === 0) return null;
  const sorted = [...productHistory].sort(
    (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
  );
  return parseISO(sorted[0].date);
};

export default function ImportModal({
  isImportModalVisible,
  setIsImportModalVisible,
  loadItems,
  listId,
  applyMatch,
  applyNew,
}: {
  isImportModalVisible: boolean;
  setIsImportModalVisible: (visible: boolean) => void;
  loadItems: () => Promise<void>;
  listId: number;
  applyMatch?: UseImportEngineOptions['applyMatch'];
  applyNew?: UseImportEngineOptions['applyNew'];
}) {
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);
  const [importText, setImportText] = useState("");

  const defaultApplyMatch = async ({ productId, inventoryItemId, product, importDate }) => {
    if (inventoryItemId !== null) {
      await applyImportToInventoryItem(inventoryItemId, product.quantity, importDate);
    } else {
      const newIIId = await addInventoryItem(listId, productId, product.quantity);
      if (importDate) await saveInventoryHistorySnapshot(newIIId, product.quantity, importDate);
    }
  };

  const defaultApplyNew = async ({ product, importDate }) => {
    const productId = await addProduct(product.originalName);
    const newIIId = await addInventoryItem(listId, productId, product.quantity);
    if (importDate) await saveInventoryHistorySnapshot(newIIId, product.quantity, importDate);
    return { productId, productName: product.originalName };
  };

  const engine = useImportEngine({
    listId,
    loadItems,
    applyMatch: applyMatch ?? defaultApplyMatch,
    applyNew: applyNew ?? defaultApplyNew,
  });

  const handleImportModalImport = () => {
    const text = importText;
    setIsImportModalVisible(false);
    setImportText("");
    engine.startImport(text);
  };

  const handleImportModalCancel = () => {
    setIsImportModalVisible(false);
    setImportText("");
  };

  const handleSummaryModalDismiss = () => {
    engine.setSummaryModalVisible(false);
    engine.setImportResults([]);
  };

  return (
    <View>
      <Modal
        visible={isImportModalVisible}
        onRequestClose={() => setIsImportModalVisible(false)}
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Importar Lista</Text>
            <TextInput
              style={[styles.textInput, { height: 150, textAlignVertical: "top" }]}
              multiline
              value={importText}
              onChangeText={setImportText}
              placeholder="Cole aqui sua lista de produtos"
            />
            <View style={styles.buttonRow}>
              <Button onPress={handleImportModalCancel} style={styles.stackedButton}>
                Cancelar
              </Button>
              <Button onPress={handleImportModalImport} style={styles.stackedButton}>
                Importar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={engine.confirmationModalVisible}
        currentImportItem={engine.currentImportItem}
        progress={engine.importProgress}
        onAcceptAllSuggestions={engine.handleAcceptAllSuggestions}
        onAddToExisting={engine.handleAddToExisting}
        onCreateNew={engine.handleCreateNew}
        onSkipImport={engine.handleSkipImport}
        onCancelAllImports={engine.handleCancelAllImports}
        onUpdateCurrentItem={engine.setCurrentImportItem}
      />

      <ImportSummaryModal
        visible={engine.summaryModalVisible}
        results={engine.importResults}
        onDismiss={handleSummaryModalDismiss}
      />
    </View>
  );
}