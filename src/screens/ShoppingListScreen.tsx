import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, FlatList, Pressable } from 'react-native';
import { TextInput as PaperTextInput, Button, useTheme, List, Chip, Surface, Checkbox, IconButton } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { addShoppingListItem, getShoppingListItemsByListId, getInventoryItems, updateShoppingListItem, deleteShoppingListItem, buyShoppingListItem } from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { useHeaderHeight } from '@react-navigation/elements';
import { InventoryItem, ShoppingListItem } from '../database/models';
import { useListContext } from '../context/ListContext';

type ShoppingListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ShoppingList'>;

interface ShoppingListItemWithDetails extends Omit<ShoppingListItem, 'checked'> {
  checked: boolean; // Converted from database number to boolean
  productName: string;
  productId: number;
  currentInventoryQuantity: number;
}

export default function ShoppingListScreen() {
  const headerHeight = useHeaderHeight();
  const { listId } = useListContext();
  console.log('ShoppingListScreen listId:', listId);
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItemWithDetails[]>([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const navigation = useNavigation<ShoppingListScreenNavigationProp>();
  const theme = useTheme();

  // Load inventory items and shopping list items on component mount and focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [listId])
  );

  const loadData = async () => {
    try {
      const [inventory, shopping] = await Promise.all([
        getInventoryItems(listId),
        getShoppingListItemsByListId(listId)
      ]);
      
      setInventoryItems(inventory);
      
      // Enhance shopping list items with inventory details
      const enhancedShoppingItems = shopping.map(item => {
        const inventoryItem = inventory.find(inv => inv.id === item.inventoryItemId);
        return {
          ...item,
          // Convert numeric checked value to boolean
          checked: Boolean(item.checked),
          productName: inventoryItem?.productName || 'Unknown Product',
          productId: inventoryItem?.productId || 0,
          currentInventoryQuantity: inventoryItem?.quantity || 0,
        };
      });
      
      setShoppingListItems(enhancedShoppingItems);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  // Filter inventory items based on input
  const filteredInventoryItems = useMemo(() => {
    //if (!productName.trim()) return [];
    
    return inventoryItems.filter(item =>
      item.productName.toLowerCase().includes(productName.toLowerCase())
    ).slice(0, 5); // Limit to 5 suggestions
  }, [inventoryItems, productName]);

  const handleInventoryItemSelect = (item: InventoryItem) => {
    console.log("handleInventoryItemSelect called with item:", item);
    setSelectedInventoryItem(item);
    setProductName(item.productName);
    setShowSuggestions(false);
  };

  const handleProductNameChange = (text: string) => {
    setProductName(text);
    setSelectedInventoryItem(null);
    setShowSuggestions(filteredInventoryItems.length > 0);
  };

  const handleSubmit = async () => {    
    console.log("handleSubmit called");
    if (!productName.trim()) {
      console.error('Nome do produto é obrigatório');
      return;
    }

    setLoading(true);
    try {
      if (selectedInventoryItem) {
        // Add existing inventory item to shopping list
        await addShoppingListItem(
          listId,
          selectedInventoryItem.productName,
          parseInt(quantity, 10)
        );
      } else {
        // Create new product and add to shopping list
        await addShoppingListItem(
          listId,
          productName.trim(),
          parseInt(quantity, 10)
        );
      }
      
      // Reload data
      await loadData();
      
      // Reset form
      setProductName('');
      setQuantity('1');
      setSelectedInventoryItem(null);
    } catch (error) {
      console.error('Erro ao adicionar item à lista de compras:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChecked = async (item: ShoppingListItemWithDetails) => {
    try {
      await updateShoppingListItem(item.id, { checked: !item.checked });
      await loadData();
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
    }
  };

  const handleBuyItem = async (item: ShoppingListItemWithDetails) => {
    try {
      await buyShoppingListItem(item.id);
      await loadData();
    } catch (error) {
      console.error('Erro ao comprar item:', error);
    }
  };

  const handleDeleteItem = async (item: ShoppingListItemWithDetails) => {
    try {
      await deleteShoppingListItem(item.id);
      await loadData();
    } catch (error) {
      console.error('Erro ao deletar item:', error);
    }
  };

  const renderInventorySuggestion = ({ item }: { item: InventoryItem }) => (
    <Pressable
      onPressIn={() => handleInventoryItemSelect(item)}
      style={styles.suggestionItem}
    >
      <List.Item
        title={item.productName}
        description={`Estoque atual: ${item.quantity}`}
        left={props => <List.Icon {...props} icon="package-variant" />}
        right={props => <List.Icon {...props} icon="plus" />}
        style={styles.suggestionListItem}
      />
    </Pressable>
  );

  const renderShoppingListItem = ({ item }: { item: ShoppingListItemWithDetails }) => (
    <Surface style={styles.shoppingItemCard}>
      <View style={styles.shoppingItemContent}>
        <View style={styles.shoppingItemLeft}>
          <Checkbox
            status={item.checked ? 'checked' : 'unchecked'}
            onPress={() => handleToggleChecked(item)}
          />
          <View style={styles.shoppingItemInfo}>
            <Text style={[
              styles.shoppingItemName,
              item.checked && styles.checkedItem
            ]}>
              {item.productName}
            </Text>
            <Text style={styles.shoppingItemQuantity}>
              Quantidade: {item.quantity} | Estoque: {item.currentInventoryQuantity}
            </Text>
          </View>
        </View>
        <View style={styles.shoppingItemActions}>
          <IconButton
            icon="cart-check"
            size={20}
            onPress={() => handleBuyItem(item)}
            disabled={item.checked}
          />
          <IconButton
            icon="delete"
            size={20}
            onPress={() => handleDeleteItem(item)}
          />
        </View>
      </View>
    </Surface>
  );

  const isCreatingNew = !selectedInventoryItem && productName.trim().length > 0;
  console.log("showSuggestions", showSuggestions);
  const checkedItems = shoppingListItems.filter(item => item.checked);
  const uncheckedItems = shoppingListItems.filter(item => !item.checked);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <View style={styles.scrollContent}>
        <Surface style={styles.card}>
          <Text style={styles.title}>Lista de Compras</Text>
          
          <View style={styles.inputContainer}>
            <PaperTextInput
              label="Adicionar Produto"
              value={productName}
              onChangeText={handleProductNameChange}
              style={styles.productInput}
              mode="outlined"
              autoFocus
              blurOnSubmit={false}
              returnKeyType="next"
              testID="product-name-input"
              right={
                selectedInventoryItem ? (
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

            {/* Inventory Suggestions */}
            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Produtos no Estoque:</Text>
                <FlatList
                  data={filteredInventoryItems}
                  renderItem={renderInventorySuggestion}
                  keyExtractor={(item) => item.id.toString()}
                  style={styles.suggestionsList}
                  nestedScrollEnabled
                />
              </View>
            )}

            {/* New Product Indicator */}
            {isCreatingNew && !showSuggestions && (
              <View style={styles.newProductIndicator}>
                <Chip 
                  icon="plus" 
                  mode="outlined"
                  style={styles.newProductChip}
                >
                  Adicionar novo produto: "{productName}"
                </Chip>
              </View>
            )}

            {/* Selected Product Indicator */}
            {selectedInventoryItem && (
              <View style={styles.selectedProductIndicator}>
                <Chip 
                  icon="check" 
                  mode="flat"
                  style={styles.selectedProductChip}
                >
                  Produto selecionado: {selectedInventoryItem.productName}
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
            testID="add-shopping-item-button"
            icon="plus"
          >
            {selectedInventoryItem ? 'Adicionar à Lista' : 'Criar Produto e Adicionar'}
          </Button>
        </Surface>

        {/* Shopping List Items */}
        <ScrollView style={styles.shoppingListContainer}>
          <Text style={styles.sectionTitle}>Lista de Compras</Text>
          
          {shoppingListItems.length === 0 ? (
            <Surface style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Sua lista de compras está vazia.{'\n'}
                Adicione produtos acima para começar!
              </Text>
            </Surface>
          ) : (
            <>
              {/* Unchecked Items */}
              {uncheckedItems.length > 0 && (
                <View style={styles.itemsSection}>
                  <Text style={styles.subsectionTitle}>Pendentes ({uncheckedItems.length})</Text>
                  <FlatList
                    data={uncheckedItems}
                    renderItem={renderShoppingListItem}
                    keyExtractor={(item) => item.id.toString()}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* Checked Items */}
              {checkedItems.length > 0 && (
                <View style={styles.itemsSection}>
                  <Text style={styles.subsectionTitle}>Comprados ({checkedItems.length})</Text>
                  <FlatList
                    data={checkedItems}
                    renderItem={renderShoppingListItem}
                    keyExtractor={(item) => item.id.toString()}
                    scrollEnabled={false}
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>
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
    marginBottom: 16,
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
  shoppingListContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  itemsSection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  shoppingItemCard: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  shoppingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  shoppingItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shoppingItemInfo: {
    flex: 1,
    marginLeft: 8,
  },
  shoppingItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  checkedItem: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  shoppingItemQuantity: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  shoppingItemActions: {
    flexDirection: 'row',
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    lineHeight: 24,
  },
}); 