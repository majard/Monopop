import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
  onStartContinuousIncrement?: () => void;
  onStartContinuousDecrement?: () => void;
  onStopContinuous?: () => void;
}

export const ProductSearchRow = React.memo(({
  productName,
  stockQuantity,
  listQuantity,
  onPlus,
  onMinus,
  isOnList,
  onStartContinuousIncrement,
  onStartContinuousDecrement,
  onStopContinuous,
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
          {isOnList && listQuantity !== undefined && listQuantity >= 1 ? (
            <Pressable
              onPress={onMinus}
              onLongPress={onStartContinuousDecrement}
              onPressOut={onStopContinuous}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 8 }}
              style={{ padding: 8 }}
            >
              <IconButton
                icon={listQuantity === 1 ? 'close' : 'minus'}
                size={20}
                iconColor={theme.colors.error}
                style={{ margin: 0 }}
                pointerEvents="none"
              />
            </Pressable>
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
          <Pressable
            onPress={onPlus}
            onLongPress={onStartContinuousIncrement}
            onPressOut={onStopContinuous}
            hitSlop={{ top: 16, bottom: 16, left: 8, right: 16 }}
            style={{ padding: 8 }}
          >
            <IconButton
              icon="plus"
              size={24}
              iconColor={isOnList ? theme.colors.primary : theme.colors.outline}
              style={{ margin: 0 }}
              pointerEvents="none"
            />
          </Pressable>
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
