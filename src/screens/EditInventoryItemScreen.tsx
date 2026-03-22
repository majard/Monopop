import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  SafeAreaView,
  Alert,
  Modal,
} from "react-native";
import {
  TextInput as PaperTextInput,
  Button,
  Text,
  useTheme,
  Card,
  IconButton,
} from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { LineChart } from "react-native-chart-kit";
import {
  updateInventoryItem,
  getInventoryHistory,
  updateProductName,
  deleteInventoryItem,
  getLists,
  updateInventoryItemList,
} from "../database/database";
import { InventoryHistory } from "../database/models";
import { RootStackParamList } from "../types/navigation";
import { getEmojiForList } from "../utils/stringUtils";
import { EditableName } from "../components/EditableName";

type EditInventoryItemNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "EditInventoryItem"
>;
type EditInventoryItemProps = NativeStackScreenProps<
  RootStackParamList,
  "EditInventoryItem"
>;

export default function EditInventoryItem() {
  const route = useRoute<EditInventoryItemProps["route"]>();
  const inventoryItem = route.params?.inventoryItem;
  const [quantity, setQuantity] = useState(inventoryItem?.quantity?.toString() || "");
  const [notes, setNotes] = useState(inventoryItem?.notes || "");
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const navigation = useNavigation<EditInventoryItemNavigationProp>();
  const theme = useTheme();
  const [name, setName] = useState(inventoryItem?.productName || "");
  const [lists, setLists] = useState<{ id: number; name: string }[]>([]);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [selectedListId, setSelectedListId] = useState(inventoryItem?.listId ?? 1);

  useEffect(() => {
    console.log('\n\ninventoryItem', inventoryItem);
    if (inventoryItem) {
      setQuantity(inventoryItem.quantity.toString());
      loadHistory();
    }
    getLists().then(setLists);
    setSelectedListId(inventoryItem?.listId ?? 1);
  }, []);

  const loadHistory = async () => {
    console.log('\n\n loading history inventoryItem', inventoryItem);
    if (inventoryItem?.productName) { // Ensure product and id exist before calling
      try {
        const data = await getInventoryHistory(inventoryItem.id);
        console.log('\n\ndata', data);
        setHistory(data || []); 
      } catch (error) {
        console.error("Erro ao carregar histórico:", error);
      }
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
        "Tem certeza que deseja excluir este produto?",
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
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const formatHistoryDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const handleChangeList = async (newListId: number) => {
    if (inventoryItem?.id && newListId !== selectedListId) {
      await updateInventoryItemList(inventoryItem.id, newListId);
      setSelectedListId(newListId);
      navigation.setParams({ inventoryItem: { ...inventoryItem, listId: newListId } });
    }
    setListModalVisible(false);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
      <EditableName name={name} handleSave={handleNameUpdate} handleDelete={handleDelete}/>

        <Card style={styles.card}>
          <Card.Content>
            <PaperTextInput
              label="Lista"
              value={lists.find((l) => l.id === selectedListId)?.name || "Selecionar Lista"}
              mode="outlined"
              style={[styles.input, { flex: 1 }]}
              editable={false}
              right={<PaperTextInput.Icon icon="menu-down" onPress={() => setListModalVisible(true)} />}
              pointerEvents="none"
            />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <PaperTextInput
              label="Quantidade"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              style={styles.input}
              mode="outlined"
              testID="quantity-input"
            />
            <Button
              mode="contained"
              onPress={handleUpdate}
              style={styles.button}
              disabled={!quantity}
              testID="update-button"
            >
              Atualizar Quantidade
            </Button>
          </Card.Content>
        </Card>

        
        <Card style={styles.card}>
          <Card.Content>

            <PaperTextInput
              label="Observações"
              value={notes}
              onChangeText={setNotes}
              keyboardType="default"
              style={styles.input}
              mode="outlined"
              testID="notes-input"
            />
            <Button
              mode="contained"
              onPress={handleUpdate}
              style={styles.button}
              disabled={!notes}
              testID="update-button"
            >
              Atualizar Observações
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.subtitle}>
              Histórico de Quantidades
            </Text>
            {history.length > 0 ? (
              <View>
                <LineChart
                  data={chartData}
                  width={Dimensions.get("window").width - 64}
                  height={220}
                  chartConfig={{
                    backgroundColor: theme.colors.primary,
                    backgroundGradientFrom: theme.colors.primary,
                    backgroundGradientTo: theme.colors.primary,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                  }}
                  bezier
                  style={styles.chart}
                />
                <View style={styles.historyList}>
                  {history.map((item, index) => (
                    <View key={item.id} style={styles.historyItem}>
                      <Text variant="bodyMedium">
                        {formatHistoryDate(item.date)}
                      </Text>
                      <Text variant="bodyMedium">
                        Quantidade: {item.quantity}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text>Nenhum histórico disponível</Text>
            )}
          </Card.Content>
        </Card>

        <Modal
          visible={listModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setListModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '60%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Escolher Lista</Text>
                <IconButton icon="close" onPress={() => setListModalVisible(false)} />
              </View>
              <ScrollView>
                {lists.map((list) => (
                  <Card
                    key={list.id}
                    onPress={() => handleChangeList(list.id)}
                    style={{ marginBottom: 8, borderRadius: 8, backgroundColor: list.id === selectedListId ? '#e3f2fd' : '#f5f5f5' }}
                  >
                    <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, marginRight: 12 }}>{getEmojiForList(list.name)}</Text>
                      <Text style={{ fontSize: 16, flex: 1 }}>{list.name}</Text>
                      {list.id === selectedListId && <IconButton icon="check" iconColor="#1976d2" size={20} />}
                    </Card.Content>
                  </Card>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 64,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  nameEditContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  nameInput: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    flex: 1,
  },
  subtitle: {
    marginBottom: 16,
  },
  card: {
    margin: 16,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  historyList: {
    marginTop: 16,
    paddingBottom: 64,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
});