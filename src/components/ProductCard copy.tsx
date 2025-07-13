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

import { Product } from '../database/database';
import { RootStackParamList } from '../types/navigation';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { getEmojiForProduct } from '../utils/stringUtils';
import { useProduct } from '../hooks/useProduct';

type ProductCardNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'EditProduct'
>;

interface ProductCardProps {
  item: Product;
  drag: () => void;
  isActive: boolean;
}

export const ProductCard = ({
  item,
  drag,
  isActive,
}: ProductCardProps) => {
  const navigation = useNavigation<ProductCardNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const {
    quantity,
    updateInventoryItemQuantity,
    confirmRemoveProduct,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  } = useProduct({ productId: item.id, initialQuantity: item.quantity });


  return (
    <Card style={[styles.card, { opacity: isActive ? 0.5 : 1 }]}>
      <Pressable
        onPress={() => navigation.navigate('EditProduct', { product: item })}
        onLongPress={drag}
        testID={`product-card-${item.id}`}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.dragHandle}>
              <Text variant="titleMedium">
                {item.name + ' ' + getEmojiForProduct(item.name)}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <IconButton
                icon="pencil"
                size={20}
                onPress={() =>
                  navigation.navigate('EditProduct', { product: item })
                }
                iconColor={theme.colors.primary}
              />
              <IconButton
                icon="delete"
                size={20}
                onPress={confirmRemoveProduct}
                iconColor={theme.colors.error}
                testID={`delete-button-${item.id}`}
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
                  testID={`quantity-text-input-${item.id}`}
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
                  testID={`increment-button-${item.id}`}
                />
              </View>
            </View>
          </View>
        </Card.Content>
      </Pressable>
    </Card>
  );
};