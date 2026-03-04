import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import {
  TextInput as PaperTextInput,
  Button,
  Text,
  useTheme,
  Card,
  Chip,
  Divider,
} from "react-native-paper";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { LineChart } from "react-native-chart-kit";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  updateInventoryItem,
  getInventoryHistory,
  updateProductName,
  deleteInventoryItem,
  getLists,
  updateInventoryItemList,
  getCategories,
  addCategory,
  updateProductCategory,
} from "../database/database";
import { InventoryHistory } from "../database/models";
import { RootStackParamList } from "../types/navigation";
import ContextualHeader from "../components/ContextualHeader";
import { EditableName } from "../components/EditableName";
import { ItemPickerDialog } from "../components/ItemPickerDialog";
import { SearchablePickerDialog } from "../components/SearchablePickerDialog";
import { getDb } from "../database/database";

type EditInventoryItemNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "EditInventoryItem"
>;
type EditInventoryItemProps = NativeStackScreenProps<
  RootStackParamList,
  "EditInventoryItem"
>;

interface PriceHistory {
  date: string;
  price: number;
  storeName: string;
}

export default function EditInventoryItem() {
  const route = useRoute<EditInventoryItemProps["route"]>();
  const inventoryItem = route.params?.inventoryItem;
  const [quantity, setQuantity] = useState(inventoryItem?.quantity?.toString() || "");
  const [notes, setNotes] = useState(inventoryItem?.notes || "");
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const navigation = useNavigation<EditInventoryItemNavigationProp>();
  const theme = useTheme();
  const [name, setName] = useState(inventoryItem?.productName || "");
  const [lists, setLists] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedListId, setSelectedListId] = useState(inventoryItem?.listId ?? 1);
  const [selectedCategoryId, setSelectedCategoryId] = useState(inventoryItem?.categoryId ?? null);

  useEffect(() => {
    if (inventoryItem) {
      setQuantity(inventoryItem.quantity.toString());
      loadHistory();
      loadPriceHistory();
    }
    getLists().then(setLists);
    getCategories().then(setCategories);
    setSelectedListId(inventoryItem?.listId ?? 1);
    setSelectedCategoryId(inventoryItem?.categoryId ?? null);
  }, []);

  // Refresh data when screen gains focus to show latest changes
  useFocusEffect(
    useCallback(() => {
      if (inventoryItem) {
        setQuantity(inventoryItem.quantity.toString());
        setNotes(inventoryItem.notes || "");
        setName(inventoryItem.productName || "");
        setSelectedListId(inventoryItem.listId ?? 1);
        setSelectedCategoryId(inventoryItem.categoryId ?? null);
        loadHistory();
        loadPriceHistory();
      }
    }, [inventoryItem])
  );

  const loadHistory = async () => {
    if (inventoryItem?.productName) {
      try {
        const data = await getInventoryHistory(inventoryItem.id);
        setHistory(data || []);
      } catch (error) {
        console.error("Erro ao carregar histórico:", error);
      }
    }
  };

  const loadPriceHistory = async () => {
    if (!inventoryItem?.productId) return;

    try {
      const db = getDb();
      const result = await db.getAllAsync(`
        SELECT 
          ii.createdAt as date,
          ii.unitPrice as price,
          s.name as storeName
        FROM invoice_items ii
        JOIN invoices i ON ii.invoiceId = i.id
        LEFT JOIN stores s ON i.storeId = s.id
        WHERE ii.productId = ?
        ORDER BY ii.createdAt DESC
        LIMIT 20
      `, [inventoryItem.productId]);

      setPriceHistory(result as PriceHistory[]);
    } catch (error) {
      console.error("Erro ao carregar histórico de preços:", error);
    }
  };

  const handleUpdate = async () => {
    if (inventoryItem?.id) {
      try {
        await updateInventoryItem(inventoryItem.id, parseInt(quantity), notes);
        navigation.goBack();
      } catch (error) {
        console.error("Erro ao atualizar produto:", error);
      }
    }
  };

  const handleNameUpdate = async (newName: string) => {
    if (inventoryItem?.id) {
      try {
        setName(newName);
        await updateProductName(inventoryItem.productId, newName);
      } catch (error) {
        console.error("Erro ao atualizar nome do produto:", error);
      }
    }
  };

  const handleDelete = async () => {
    if (inventoryItem?.id) {
      Alert.alert(
        "Confirmar Exclusão",
        `Tem certeza que deseja excluir ${inventoryItem.productName}?`,
        [
          {
            text: "Cancelar",
            style: "cancel",
          },
          {
            text: "Excluir",
            onPress: async () => {
              try {
                await deleteInventoryItem(inventoryItem.id);
                navigation.goBack();
              } catch (error) {
                console.error("Erro ao deletar produto:", error);
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const formatChartLabel = (dateString: string) => {
    return format(parseISO(dateString + 'T00:00:00'), "dd/MM", { locale: ptBR });
  };

  const formatHistoryDate = (dateString: string) => {
    return format(parseISO(dateString + 'T00:00:00'), "dd/MM HH:mm", { locale: ptBR });
  };

  const formatPriceDate = (dateString: string) => {
    return format(parseISO(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const chartData = {
    labels: [...history]
      .reverse()
      .slice(-7)
      .map((h) => formatChartLabel(h.date)),
    datasets: [
      {
        data: [...history]
          .reverse()
          .slice(-7)
          .map((h) => h.quantity),
      },
    ],
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
    labelColor: () => '#666666',
    style: { borderRadius: 16 },
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#2196F3' }
  };

  const handleChangeList = async (newListId: number) => {
    if (inventoryItem?.id && newListId !== selectedListId) {
      await updateInventoryItemList(inventoryItem.id, newListId);
      setSelectedListId(newListId);
      navigation.setParams({ inventoryItem: { ...inventoryItem, listId: newListId } });
    }
    setListModalVisible(false);
  };

  const handleCategorySelect = async (categoryId: number) => {
    if (inventoryItem?.productId) {
      await updateProductCategory(inventoryItem.productId, categoryId);
      setSelectedCategoryId(categoryId);
    }
    setCategoryModalVisible(false);
  };

  const handleCategoryCreate = async (categoryName: string) => {
    try {
      const newCategoryId = await addCategory(categoryName);
      if (inventoryItem?.productId) {
        await updateProductCategory(inventoryItem.productId, newCategoryId);
        setSelectedCategoryId(newCategoryId);
      }
      // Refresh categories list
      const updatedCategories = await getCategories();
      setCategories(updatedCategories);
    } catch (error) {
      console.error("Erro ao criar categoria:", error);
    }
    setCategoryModalVisible(false);
  };

  const getQuantityDiff = (current: number, previous: number | undefined) => {
    if (previous === undefined) return null;
    const diff = current - previous;
    return diff > 0 ? `+${diff}` : diff.toString();
  };

  const getQuantityDiffColor = (diff: string | null) => {
    if (!diff) return '#666';
    return diff.startsWith('+') ? '#4CAF50' : '#F44336';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ContextualHeader
        listName={name}
        onListNameSave={handleNameUpdate}
        onListDelete={handleDelete}
      />

      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.chipsRow}>
              <Chip
                icon="format-list-bulleted"
                onPress={() => setListModalVisible(true)}
                style={styles.chip}
              >
                {lists.find((l) => l.id === selectedListId)?.name || "Selecionar Lista"}
              </Chip>
              
              <Chip
                icon="tag"
                onPress={() => setCategoryModalVisible(true)}
                style={styles.chip}
              >
                {categories.find((c) => c.id === selectedCategoryId)?.name || "Sem categoria"}
              </Chip>
            </View>

            <PaperTextInput
              label="Quantidade"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              style={styles.input}
              mode="outlined"
              testID="quantity-input"
            />

            <PaperTextInput
              label="Observações"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={styles.input}
              mode="outlined"
              testID="notes-input"
            />

            <Button
              mode="contained"
              onPress={handleUpdate}
              style={styles.saveButton}
              disabled={!quantity}
              testID="update-button"
            >
              Salvar
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.subtitle}>
              Histórico de Quantidades
            </Text>

            {history.length > 1 ? (
              <>
                <LineChart
                  data={chartData}
                  width={Dimensions.get("window").width - 64}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                />
                <Divider style={styles.divider} />
              </>
            ) : history.length === 1 ? (
              <Text style={styles.singlePointText}>Apenas um ponto no histórico</Text>
            ) : (
              <Text style={styles.emptyText}>Nenhum histórico de quantidades disponível</Text>
            )}

            {history.length > 0 && (
              <View style={styles.historyList}>
                {history.map((item, index) => {
                  const previousQuantity = history[index + 1]?.quantity;
                  const diff = getQuantityDiff(item.quantity, previousQuantity);

                  return (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={styles.historyItemLeft}>
                        <Text variant="bodyMedium">
                          {formatHistoryDate(item.date)}
                        </Text>
                        <Text variant="bodyMedium">
                          Quantidade: {item.quantity}
                        </Text>
                      </View>
                      {diff && (
                        <Text style={[styles.quantityDiff, { color: getQuantityDiffColor(diff) }]}>
                          {diff}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.subtitle}>
              Histórico de Preços
            </Text>

            {priceHistory.length > 0 ? (
              <View style={styles.priceHistoryList}>
                {priceHistory.map((item, index) => (
                  <View key={index} style={styles.priceHistoryRow}>
                    <View style={styles.priceHistoryTopRow}>
                      <Text variant="bodyMedium">
                        {formatPriceDate(item.date)}
                      </Text>
                      <Text variant="bodyMedium">
                        R$ {item.price != null ? item.price.toFixed(2) : 'Preço não informado'}
                      </Text>
                    </View>
                    <Text 
                      variant="bodyMedium" 
                      style={styles.storeName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.storeName || "Loja não informada"}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Nenhum histórico de preços disponível</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <ItemPickerDialog
        visible={listModalVisible}
        onDismiss={() => setListModalVisible(false)}
        items={lists}
        selectedId={selectedListId}
        onSelect={handleChangeList}
        title="Escolher Lista"
      />

      <SearchablePickerDialog
        visible={categoryModalVisible}
        onDismiss={() => setCategoryModalVisible(false)}
        items={categories}
        selectedId={selectedCategoryId}
        onSelect={handleCategorySelect}
        onCreateNew={handleCategoryCreate}
        title="Escolher Categoria"
        placeholder="Buscar categoria..."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 16,
  },
  input: {
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
  },
  saveButton: {
    marginTop: 8,
  },
  subtitle: {
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  divider: {
    marginVertical: 16,
  },
  historyList: {
    marginTop: 16,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  historyItemLeft: {
    flex: 1,
  },
  quantityDiff: {
    fontWeight: "600",
    fontSize: 14,
  },
  singlePointText: {
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
    marginVertical: 16,
  },
  emptyText: {
    textAlign: "center",
    color: "#666",
    marginVertical: 32,
  },
  priceHistoryList: {
    marginTop: 16,
  },
  priceHistoryRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  priceHistoryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  storeName: {
    fontStyle: "italic",
    color: "#666",
  },
});