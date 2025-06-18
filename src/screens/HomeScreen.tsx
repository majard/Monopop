import React, { useState, useCallback } from "react";
import { View, Alert, } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Button,
  useTheme,
} from "react-native-paper";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { RootStackParamList } from "../types/navigation";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { generateStockListText } from "../utils/stringUtils";
import ImportModal from "../components/ImportModal";
import useProducts from "../hooks/useProducts";
import { SortOrder } from "../utils/sortUtils";
import SearchBar from "../components/SearchBar";
import { useList } from "../hooks/useList";
import { SortMenu } from "../components/SortMenu";
import { EditableName } from "../components/EditableName";
import { AddItemButton } from "../components/AddItemButton";
import ProductList from "../components/ProductList";

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;
type HomeScreenProps = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen() {
  const route = useRoute<HomeScreenProps["route"]>();
  const listId = route.params?.listId ?? 1;

  const navigation = useNavigation<HomeScreenNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const [sortOrder, setSortOrder] = useState<SortOrder>("custom");
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    products,
    loadProducts,
    saveProductHistory,
  } = useProducts(listId, sortOrder, searchQuery);

  const {
    listName,
    handleListNameSave,
    handleListDelete,
  } = useList(listId);


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
      loadProducts();
    }, [sortOrder, loadProducts])
  );

  const saveAndCopyStockList = async () => {
    try {
      await saveProductHistory();
      const text = generateStockListText(products);
      Clipboard.setStringAsync(text);
      Alert.alert("Sucesso", "Lista de estoque copiada para a área de transferência!");
    } catch (error) {
      console.error("Erro ao salvar histórico e copiar lista:", error);
      Alert.alert("Erro", "Não foi possível copiar a lista de estoque.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* List Name Editing/Display */}
        <EditableName
          name={listName}
          handleSave={handleListNameSave}
          handleDelete={handleListDelete}
        />

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
      
      <ProductList
        listId={listId}
        sortOrder={sortOrder}
        searchQuery={searchQuery}
      />
      <AddItemButton onPress={() => navigation.navigate("AddProduct", { listId })} label="Adicionar Produto" />
      <ImportModal
        isImportModalVisible={isImportModalVisible}
        setIsImportModalVisible={setIsImportModalVisible}
        loadProducts={loadProducts}
        listId={listId}
      />
    </SafeAreaView>
  );
}