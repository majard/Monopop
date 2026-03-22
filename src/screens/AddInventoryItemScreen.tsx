import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, FlatList, Pressable } from 'react-native';
import { TextInput as PaperTextInput, Button, useTheme, List, Chip, Surface } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { addInventoryItem, addProduct, getProducts } from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { useHeaderHeight } from '@react-navigation/elements';
import { Product } from '../database/models';

type AddProductScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddProduct'>;
type AddProductScreenProps = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;

export default function AddInventoryItemScreen() {
  const headerHeight = useHeaderHeight();

  const route = useRoute<AddProductScreenProps["route"]>();
  const listId = route.params?.listId ?? 1;
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigation = useNavigation<AddProductScreenNavigationProp>();
  const theme = useTheme();

  // Load existing products on component mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const existingProducts = await getProducts();
      setProducts(existingProducts);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  // Filter products based on input
  const filteredProducts = useMemo(() => {
    if (!productName.trim()) return [];
    
    return products.filter(product =>
      product.name.toLowerCase().includes(productName.toLowerCase())
    ).slice(0, 5); // Limit to 5 suggestions
  }, [products, productName]);

  const handleProductSelect = (product: Product) => {
    console.log("handleProductSelect called with product:", product);
    setSelectedProduct(product);
    setProductName(product.name);
    setShowSuggestions(false);
  };

  const handleProductNameChange = (text: string) => {
    setProductName(text);
    setSelectedProduct(null);
    setShowSuggestions(text.length > 0);
  };

  const handleSubmit = async () => {    
    console.log("handleSubmit called");
    if (!productName.trim()) {
      console.error('Nome do produto é obrigatório');
      return;
    }

    setLoading(true);
    try {
      let productId: number;

      if (selectedProduct) {
        // Use existing product
        productId = selectedProduct.id;
      } else {
        // Create new product
        productId = await addProduct(productName.trim());
      }

      console.log("Adding inventory item with productId:", productId);
      await addInventoryItem(
        listId,
        productId,
        parseInt(quantity, 10), 
        0,
        ""
      );
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderProductSuggestion = ({ item }: { item: Product }) => (
    <Pressable
      onPressIn={() => handleProductSelect(item)}
      style={styles.suggestionItem}
    >
      <List.Item
        title={item.name}
        left={props => <List.Icon {...props} icon="package-variant" />}
        right={props => <List.Icon {...props} icon="plus" />}
        style={styles.suggestionListItem}
      />
    </Pressable>
  );

  const isCreatingNew = !selectedProduct && productName.trim().length > 0;
  const hasSuggestions = filteredProducts.length > 0 && showSuggestions;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <View 
        style={styles.scrollContent}
      >
        <Surface style={styles.card}>
          <Text style={styles.title}>Adicionar Item ao Inventário</Text>
          
          <View style={styles.inputContainer}>
            <PaperTextInput
              label="Nome do Produto"
              value={productName}
              onChangeText={handleProductNameChange}
              onFocus={() => setShowSuggestions(productName.length > 0)}
              style={styles.productInput}
              mode="outlined"
              autoFocus
              blurOnSubmit={false}
              returnKeyType="next"
              testID="product-name-input"
              right={
                selectedProduct ? (
                  <PaperTextInput.Icon 
                    icon="check-circle" 
                    color={theme.colors.primary}
                  />
                ) : isCreatingNew ? (
                  <PaperTextInput.Icon 
                    icon="plus-circle" 
                    color={theme.colors.secondary}
                  />
                ) : null
              }
            />

            {/* Product Suggestions */}
            {hasSuggestions && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Produtos Existentes:</Text>
                <FlatList
                  data={filteredProducts}
                  renderItem={renderProductSuggestion}
                  keyExtractor={(item) => item.id.toString()}
                  style={styles.suggestionsList}
                  nestedScrollEnabled
                />
              </View>
            )}

            {/* New Product Indicator */}
            {isCreatingNew && !hasSuggestions && (
              <View style={styles.newProductIndicator}>
                <Chip 
                  icon="plus" 
                  mode="outlined"
                  style={styles.newProductChip}
                >
                  Criar novo produto: "{productName}"
                </Chip>
              </View>
            )}

            {/* Selected Product Indicator */}
            {selectedProduct && (
              <View style={styles.selectedProductIndicator}>
                <Chip 
                  icon="check" 
                  mode="flat"
                  style={styles.selectedProductChip}
                >
                  Produto selecionado: {selectedProduct.name}
                </Chip>
              </View>
            )}
          </View>

          <PaperTextInput
            label="Quantidade"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            style={styles.quantityInput}
            mode="outlined"
            blurOnSubmit={true}
            returnKeyType="done"
            testID="product-quantity-input"
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            style={styles.submitButton}
            disabled={loading || !productName.trim()}
            loading={loading}
            testID="add-product-button"
            icon="plus"
          >
            {selectedProduct ? 'Adicionar ao Inventário' : 'Criar Produto e Adicionar'}
          </Button>
        </Surface>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
  },
  productInput: {
    marginBottom: 8,
  },
  suggestionsContainer: {
    marginTop: 8,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    backgroundColor: '#fff',
    marginBottom: 4,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  suggestionListItem: {
    paddingVertical: 8,
  },
  newProductIndicator: {
    marginTop: 8,
  },
  newProductChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e8',
  },
  selectedProductIndicator: {
    marginTop: 8,
  },
  selectedProductChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
  },
  quantityInput: {
    marginBottom: 24,
  },
  submitButton: {
    paddingVertical: 8,
  },
});