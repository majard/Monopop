import { View, Pressable } from 'react-native';
import {
  TextInput as PaperTextInput,
  Card,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { InventoryItem } from '../database/models';
import { RootStackParamList } from '../types/navigation';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { getEmojiForProduct } from '../utils/stringUtils';
import { useProduct } from '../hooks/useProduct';

type ProductCardNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'EditInventoryItem'
>;

interface InventoryItemCardProps {
  inventoryItem: InventoryItem;
  drag: () => void;
  isActive: boolean;
}

export const InventoryItemCard = ({
  inventoryItem,
  drag,
  isActive,
}: InventoryItemCardProps) => {
  const navigation = useNavigation<InventoryItemCardNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const {
    quantity,
    updateInventoryItemQuantity,
    confirmRemoveProduct,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  } = useProduct({ productId: inventoryItem.id, initialQuantity: inventoryItem.quantity });


  return (
    <Card style={[styles.card, { opacity: isActive ? 0.5 : 1 }]}>
      <Pressable
        onPress={() => navigation.navigate('EditInventoryItem', { inventoryItem: inventoryItem })}
        onLongPress={drag}
        testID={`product-card-${inventoryItem.id}`}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.dragHandle}>
              <Text variant="titleMedium">
                {inventoryItem.productName + ' ' + getEmojiForProduct(inventoryItem.productName)}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <IconButton
                icon="pencil"
                size={20}
                onPress={() =>
                  navigation.navigate('EditInventoryItem', { inventoryItem: inventoryItem })
                }
                iconColor={theme.colors.primary}
              />
              <IconButton
                icon="delete"
                size={20}
                onPress={confirmRemoveProduct}
                iconColor={theme.colors.error}
                testID={`delete-button-${inventoryItem.id}`}
              />
            </View>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.quantityContainer}>
              <View style={styles.quantityInputContainer}>
                <Text variant="bodyMedium">Quantidade: </Text>
                <PaperTextInput
                  mode="outlined"
                  dense
                  value={quantity.toString()}
                  onChangeText={(value) =>
                    updateInventoryItemQuantity(value === '' ? 0 : parseInt(value, 10))
                  }
                  keyboardType="numeric"
                  style={styles.input}
                  testID={`quantity-text-input-${inventoryItem.id}`}
                />
              </View>
              <View style={styles.quantityButtons}>
                <IconButton
                  icon="minus"
                  size={20}
                  onPress={() => updateInventoryItemQuantity(Math.max(0, quantity - 1))}
                  onLongPress={() => startContinuousAdjustment(false)}
                  onPressOut={stopContinuousAdjustment}
                />
                <IconButton
                  icon="plus"
                  size={20}
                  onPress={() => updateInventoryItemQuantity(quantity + 1)}
                  onLongPress={() => startContinuousAdjustment(true)}
                  onPressOut={stopContinuousAdjustment}
                  testID={`increment-button-${inventoryItem.id}`}
                />
              </View>
            </View>
          </View>
        </Card.Content>
      </Pressable>
    </Card>
  );
};