import React, { useState, useEffect } from "react";
import { parseISO } from "date-fns";
import { Modal, View, Text, ScrollView, Pressable } from "react-native";
import { Button, useTheme } from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { getInventoryHistory } from "../database/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchCandidate {
  productId: number;
  productName: string;
  inventoryItemId: number | null; // null = exists globally but not in this list
  score: number;
  source: "list" | "global";
}

export interface CurrentImportItem {
  importedProduct: { originalName: string; quantity: number };
  bestMatch: MatchCandidate;
  similarCandidates: MatchCandidate[];
  importDate: Date | null;
  remainingProducts: { originalName: string; quantity: number }[];
}

export interface ImportResult {
  originalName: string;
  quantity: number;
  outcome: 'exact' | 'similar' | 'created' | 'skipped';
  matchedName?: string;
  quantityExtracted: boolean;
  importDate: Date | null;
}

interface ConfirmationModalProps {
  visible: boolean;
  currentImportItem: CurrentImportItem | null;
  progress: { current: number; total: number; imported: number } | null;
  onAcceptAllSuggestions: () => void;
  onAddToExisting: () => void;
  onCreateNew: () => void;
  onSkipImport: () => void;
  onCancelAllImports: () => void;
  onUpdateCurrentItem: (item: CurrentImportItem) => void;
}

interface ImportSummaryModalProps {
  visible: boolean;
  results: ImportResult[];
  onDismiss: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfirmationModal({
  visible,
  currentImportItem,
  progress,
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

      const { inventoryItemId } = currentImportItem.bestMatch;

      // If the product isn't in this list yet, any date is effectively "newer"
      if (inventoryItemId === null) {
        setIsNewerOrSameDate(true);
        return;
      }

      const history = await getInventoryHistory(inventoryItemId);
      if (history.length === 0) {
        setIsNewerOrSameDate(true);
        return;
      }

      const sortedHistory = [...history].sort(
        (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
      );

      const lastHistoryDate = parseISO(sortedHistory[0].date);
      const historyDate = currentImportItem.importDate || new Date();
      setIsNewerOrSameDate(historyDate >= lastHistoryDate);
    };

    checkHistory();
  }, [currentImportItem?.bestMatch?.productId, currentImportItem?.importDate]);

  if (!currentImportItem) return null;

  const { importedProduct, bestMatch, similarCandidates, importDate } = currentImportItem;

  const formatDate = (date: Date) =>
    date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const sourceLabel = (candidate: MatchCandidate) =>
    candidate.source === "list" ? "nesta lista" : "global";

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancelAllImports}
    >
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Produtos de Nomes Parecidos</Text>

            {progress && (
              <Text style={{
                fontSize: 12,
                color: theme.colors.onSurfaceVariant,
                marginTop: 4,
                marginBottom: 8,
                textAlign: "center",
              }}>
                Produto {progress.current} de {progress.total}
              </Text>
            )}

            <View style={styles.confirmationContent}>
              <View style={styles.productCompareContainer}>
                {/* Imported product */}
                <View style={styles.productInfoColumn}>
                  <Text style={styles.productLabel}>Produto Importado:</Text>
                  <Text style={styles.productValue}>{importedProduct.originalName}</Text>
                  <Text style={styles.quantityText}>
                    Quantidade: {importedProduct.quantity}
                  </Text>
                  {importDate && (
                    <Text style={styles.dateText}>Data: {formatDate(importDate)}</Text>
                  )}
                </View>

                {/* Best match candidate */}
                <View style={styles.productInfoColumn}>
                  <Text style={styles.productLabel}>Produto Existente:</Text>
                  <Text style={styles.productValue}>{bestMatch.productName}</Text>
                  <Text style={styles.quantityText}>
                    Score: {(bestMatch.score * 100).toFixed(0)}%
                  </Text>
                  <Text style={[styles.quantityText, { color: theme.colors.onSurfaceVariant }]}>
                    ({sourceLabel(bestMatch)})
                  </Text>
                </View>
              </View>

              {/* Other candidates */}
              {similarCandidates.length > 1 && (
                <View style={styles.similarProductsContainer}>
                  <Text style={styles.sectionTitle}>Outros Produtos Similares:</Text>
                  <ScrollView style={styles.similarProductsScroll} nestedScrollEnabled>
                    {similarCandidates.slice(1).map((candidate) => (
                      <Pressable
                        key={candidate.productId}
                        onPress={() => {
                          const reordered = [
                            candidate,
                            ...similarCandidates.filter(
                              (c) => c.productId !== candidate.productId
                            ),
                          ];
                          onUpdateCurrentItem({
                            ...currentImportItem,
                            bestMatch: candidate,
                            similarCandidates: reordered,
                          });
                        }}
                      >
                        <View style={styles.similarProductItemContainer}>
                          <Text style={styles.productValue}>{candidate.productName}</Text>
                          <Text style={styles.quantityText}>
                            Score: {(candidate.score * 100).toFixed(0)}% · {sourceLabel(candidate)}
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
                Aceitar Todas as Sugestões
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
                labelStyle={[styles.buttonLabelStyle, styles.cancelButtonLabel]}
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

// ─── Import Summary Modal ────────────────────────────────────────────────────────

export function ImportSummaryModal({
  visible,
  results,
  onDismiss,
}: ImportSummaryModalProps) {
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  // Group results by outcome
  const exactResults = results.filter(r => r.outcome === 'exact');
  const similarResults = results.filter(r => r.outcome === 'similar');
  const createdResults = results.filter(r => r.outcome === 'created');
  const skippedResults = results.filter(r => r.outcome === 'skipped');

  const renderResultItem = (result: ImportResult, outcome: string) => {
    const quantityText = result.quantity > 0 ? ` (quantidade: ${result.quantity})` : '';
    const quantityWarning = !result.quantityExtracted ? ' ⚠ sem quantidade' : '';
    
    let content = result.originalName + quantityText + quantityWarning;
    
    if (outcome === 'similar' && result.matchedName) {
      content = `${result.originalName} → ${result.matchedName}${quantityText}${quantityWarning}`;
    }

    return (
      <Text key={`${outcome}-${result.originalName}`} style={[
        styles.productValue,
        { 
          color: outcome === 'exact' ? theme.colors.primary : 
                 outcome === 'similar' ? theme.colors.secondary :
                 outcome === 'created' ? theme.colors.tertiary || theme.colors.primary :
                 theme.colors.onSurfaceVariant,
          marginBottom: 4
        }
      ]}>
        {outcome === 'exact' && '✓ '}
        {outcome === 'similar' && '↔ '}
        {outcome === 'created' && '★ '}
        {outcome === 'skipped' && '— '}
        {content}
      </Text>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Resumo da Importação</Text>
            
            {/* Header with counts */}
            <Text style={{
              fontSize: 14,
              color: theme.colors.onSurfaceVariant,
              marginTop: 8,
              marginBottom: 16,
              textAlign: "center",
            }}>
              {exactResults.length} adicionados · {similarResults.length} associados · {createdResults.length} criados
            </Text>

            {/* Import date display */}
            {(() => {
              const importDate = results.find(r => r.importDate)?.importDate;
              return importDate && (
                <Text style={{ fontSize: 13, color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 8 }}>
                  Data importada: {importDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </Text>
              );
            })()}

            {/* Results sections */}
            <ScrollView style={{ maxHeight: 400 }}>
              {exactResults.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                    ✓ Adicionados ({exactResults.length})
                  </Text>
                  {exactResults.map(result => renderResultItem(result, 'exact'))}
                </View>
              )}

              {similarResults.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.secondary }]}>
                    ↔ Associados ({similarResults.length})
                  </Text>
                  {similarResults.map(result => renderResultItem(result, 'similar'))}
                </View>
              )}

              {createdResults.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.tertiary || theme.colors.primary }]}>
                    ★ Criados ({createdResults.length})
                  </Text>
                  {createdResults.map(result => renderResultItem(result, 'created'))}
                </View>
              )}

              {skippedResults.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                    — Ignorados ({skippedResults.length})
                  </Text>
                  {skippedResults.map(result => renderResultItem(result, 'skipped'))}
                </View>
              )}
            </ScrollView>

            {/* Close button */}
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={onDismiss}
                style={styles.stackedButton}
              >
                Fechar
              </Button>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}