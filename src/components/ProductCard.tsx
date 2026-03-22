import React from 'react';
import { View, Pressable } from 'react-native';
import {
  Card,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Product } from '../database/models';
import { RootStackParamList } from '../types/navigation';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { getEmojiForProduct } from '../utils/stringUtils';
import { useProduct } from '../hooks/useProduct';
import { EmojiAvatar } from './EmojiAvatar';

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

  const { confirmRemoveProduct } = useProduct({ productId: item.id });

  return (
    <Card style={[styles.card, { opacity: isActive ? 0.5 : 1 }]}>
      <Pressable
        onPress={() => navigation.navigate('EditProduct', { product: item })}
        onLongPress={drag}
        testID={`product-card-${item.id}`}
      >
        <Card.Content style={{ paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Emoji avatar — fixed width */}
            <EmojiAvatar emoji={getEmojiForProduct(item.name)} />

            {/* Name — takes remaining space */}
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <Text variant="titleMedium" numberOfLines={2}>
                {item.name}
              </Text>
            </View>

            {/* Actions */}
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => navigation.navigate('EditProduct', { product: item })}
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
        </Card.Content>
      </Pressable>
    </Card>
  );
};