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
  const isQtyOne = isOnList && listQuantity === 1;

  return (
    <Surface style={styles.surface}>
      <View style={styles.row}>
        {/* Left — minus/delete or emoji */}
        <View style={styles.left}>
          {isOnList ? (
            <IconButton
              icon={isQtyOne ? 'delete' : 'minus'}
              size={24}
              onPress={onMinus}
              iconColor={theme.colors.error}
            />
          ) : (
            <EmojiAvatar emoji={getEmojiForProduct(productName)} size="small" />
          )}
        </View>

        {/* Center — name + stock */}
        <View style={styles.center}>
          <View style={styles.nameRow}>
            <Text style={[styles.productName, { color: theme.colors.onSurface }]}>
              {productName}
            </Text>
            {isOnList && listQuantity !== undefined ? (
              <Text style={[styles.listQuantity, { color: theme.colors.primary }]}>
                {listQuantity}
              </Text>
            ) : null}
          </View>
          {stockQuantity !== undefined ? (
            <Text style={[styles.stockLabel, { color: theme.colors.onSurfaceVariant }]}>
              Estoque: {stockQuantity}
            </Text>
          ) : null}
        </View>

        {/* Right — plus */}
        <IconButton
          icon="plus"
          size={24}
          onPress={onPlus}
          iconColor={isOnList ? theme.colors.primary : theme.colors.outline}
        />
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
  left: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    marginHorizontal: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
  },
  listQuantity: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
  },
  stockLabel: {
    fontSize: 14,
    marginTop: 4,
  },
});
