import React, { useState, useEffect } from "react";
import { parseISO, isSameDay } from "date-fns";
import { Modal, View, Text, ScrollView, Pressable } from "react-native";
import { Button, useTheme } from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import {
  getInventoryHistory,
  updateInventoryItem,
  addSingleInventoryHistoryEntry,
} from "../database/database";
import { InventoryItem } from "../database/models";

interface CurrentImportItem {
  importedProduct: { originalName: string; quantity: number };
  bestMatch: InventoryItem;
  similarProducts: InventoryItem[];
  importDate: Date | null;
  remainingProducts: { originalName: string; quantity: number }[];
}

interface ConfirmationModalProps {
  visible: boolean;
  currentImportItem: CurrentImportItem | null;
  onAcceptAllSuggestions: () => void;
  onAddToExisting: () => void;
  onCreateNew: () => void;
  onSkipImport: () => void;
  onCancelAllImports: () => void;
  onUpdateCurrentItem: (item: CurrentImportItem) => void;
}

export function ConfirmationModal({
  visible,
  currentImportItem,
  onAcceptAllSuggestions,
  onAddToExisting,
  onCreateNew,
  onSkipImport,
  onCancelAllImports,
  onUpdateCurrentItem,
}: ConfirmationModalProps) {
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);
  const [isNewerOrSameDate, setIsNewerOrSameDate] = useState(false);

  useEffect(() => {
    const checkHistory = async () => {
      if (!currentImportItem?.bestMatch) return;
      
      const history = await getInventoryHistory(currentImportItem.bestMatch.id);
      if (history.length === 0) {
        setIsNewerOrSameDate(true);
        return;
      }

      const sortedHistory = history.sort(
        (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
      );

      const lastHistoryDate = parseISO(sortedHistory[0].date);
      const historyDate = currentImportItem.importDate || new Date();

      // Check if the import date is the same or newer than the last history entry
      setIsNewerOrSameDate(historyDate >= lastHistoryDate);
    };

    checkHistory();
  }, [currentImportItem?.bestMatch.id, currentImportItem?.importDate]);

  if (!currentImportItem) return null;

  const { importedProduct, bestMatch, similarProducts, importDate } = currentImportItem;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancelAllImports}
    >
      <View style={styles.modalOverlay}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Produtos de Nomes Parecidos</Text>
            <View style={styles.confirmationContent}>
              <View style={styles.productCompareContainer}>
                <View style={styles.productInfoColumn}>
                  <Text style={styles.productLabel}>Produto Importado:</Text>
                  <Text style={styles.productValue}>
                    {importedProduct.originalName}
                  </Text>
                  <Text style={styles.quantityText}>
                    Quantidade: {importedProduct.quantity}
                  </Text>
                  {importDate && (
                    <Text style={styles.dateText}>
                      Data: {formatDate(importDate)}
                    </Text>
                  )}
                </View>
                <View style={styles.productInfoColumn}>
                  <Text style={styles.productLabel}>Produto Existente:</Text>
                  <Text style={styles.productValue}>{bestMatch.productName}</Text>
                  <Text style={styles.quantityText}>
                    Quantidade: {bestMatch.quantity}
                  </Text>
                </View>
              </View>

              {similarProducts.length > 1 && (
                <View style={styles.similarProductsContainer}>
                  <Text style={styles.sectionTitle}>
                    Outros Produtos Similares:
                  </Text>
                  <ScrollView
                    style={styles.similarProductsScroll}
                    nestedScrollEnabled={true}
                  >
                    {similarProducts.slice(1).map((product, index) => (
                      <Pressable
                        key={product.id}
                        onPress={() => {
                          const updatedSimilarProducts = [
                            product,
                            ...similarProducts.filter(
                              (p) => p.id !== product.id
                            ),
                          ];

                          onUpdateCurrentItem({
                            ...currentImportItem,
                            bestMatch: product,
                            similarProducts: updatedSimilarProducts,
                          });
                        }}
                      >
                        <View
                          key={index}
                          style={styles.similarProductItemContainer}
                        >
                          <Text style={styles.productValue}>
                            {product.productName}
                          </Text>
                          <Text style={styles.quantityText}>
                            Quantidade: {product.quantity}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={onAddToExisting}
                style={[styles.stackedButton, styles.actionButton]}
                labelStyle={styles.buttonLabelStyle}
              >
                Produtos iguais
              </Button>
              <Button
                mode="contained"
                onPress={onCreateNew}
                style={[styles.stackedButton, styles.actionButton]}
                labelStyle={styles.buttonLabelStyle}
              >
                Produtos diferentes
              </Button>
              <Button
                mode="contained"
                onPress={onAcceptAllSuggestions}
                style={[styles.stackedButton, styles.actionButton]}
                labelStyle={styles.buttonLabelStyle}
              >
                Aceitar Todas as Sugestões de Substituição
              </Button>
              <Button
                mode="text"
                onPress={onSkipImport}
                style={styles.stackedButton}
                labelStyle={[styles.buttonLabelStyle, styles.skipButtonLabel]}
              >
                Pular
              </Button>
              <Button
                mode="text"
                onPress={onCancelAllImports}
                style={styles.stackedButton}
                labelStyle={[
                  styles.buttonLabelStyle,
                  styles.cancelButtonLabel,
                ]}
              >
                Cancelar Todos
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
