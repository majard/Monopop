import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, IconButton, Text, useTheme } from 'react-native-paper';
import { EmojiAvatar } from './EmojiAvatar';
import { getEmojiForProduct } from '../utils/stringUtils';

interface ProductSearchRowProps {
  productName: string;
  stockQuantity?: number;
  listQuantity?: number;
  onPlus: () => void;
  onMinus?: () => void;
  isOnList: boolean;
}

export const ProductSearchRow = React.memo(({
  productName,
  stockQuantity,
  listQuantity,
  onPlus,
  onMinus,
  isOnList,
}: ProductSearchRowProps) => {
  const theme = useTheme();

  return (
    <Surface style={styles.surface}>
      <View style={styles.row}>
        {/* Left — always emoji */}
        <View style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
          <EmojiAvatar emoji={getEmojiForProduct(productName)} size="medium" />
        </View>

        {/* Center — name + stock */}
        <View style={styles.center}>
          <Text style={[styles.productName, { color: theme.colors.onSurface }]}>
            {productName}
          </Text>
          {stockQuantity !== undefined ? (
            <Text style={[styles.stockLabel, { color: theme.colors.onSurfaceVariant }]}>
              Estoque: {stockQuantity}
            </Text>
          ) : null}
        </View>

        {/* Right — remove + quantity + plus */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isOnList ? (
            <IconButton
              icon={listQuantity === 1 ? 'close' : 'minus'}
              size={20}
              onPress={onMinus}
              iconColor={theme.colors.error}
              style={{ margin: 0 }}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 8 }}
            />
          ) : null}
          {isOnList && listQuantity !== undefined ? (
            <Text style={{ 
              fontSize: 16, 
              fontWeight: '700', 
              color: theme.colors.primary,
              marginHorizontal: 12,
            }}>
              {listQuantity}
            </Text>
          ) : null}
          <IconButton
            icon="plus"
            size={24}
            onPress={onPlus}
            iconColor={isOnList ? theme.colors.primary : theme.colors.outline}
            style={{ margin: 0 }}
            hitSlop={{ top: 16, bottom: 16, left: 8, right: 16 }}
          />
        </View>
      </View>
    </Surface>
  );
});

const styles = StyleSheet.create({
  surface: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  center: {
    flex: 1,
    marginHorizontal: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
  },
  stockLabel: {
    fontSize: 14,
    marginTop: 4,
  },
});
