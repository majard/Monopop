import React from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import {
  Card,
  IconButton,
  Text,
  Checkbox,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { InventoryItem } from '../database/models';
import { RootStackParamList } from '../types/navigation';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';
import { getEmojiForProduct } from '../utils/stringUtils';
import { useInventoryItem } from '../hooks/useInventoryItem';
import { QuantityPill } from './QuantityPill';

type ProductCardNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'EditInventoryItem'
>;

interface InventoryItemCardProps {
  inventoryItem: InventoryItem;
  drag: () => void;
  isActive: boolean;
  onInventoryItemUpdated?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onLongPressStart?: () => void;
}

export const InventoryItemCard = ({
  inventoryItem,
  drag,
  isActive,
  onInventoryItemUpdated,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPressStart,
}: InventoryItemCardProps) => {
  const navigation = useNavigation<ProductCardNavigationProp>();
  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const {
    quantity,
    updateInventoryItemQuantity,
    confirmRemoveInventoryItem,
    startContinuousAdjustment,
    stopContinuousAdjustment,
  } = useInventoryItem({ inventoryItemId: inventoryItem.id, initialQuantity: inventoryItem.quantity, onInventoryItemUpdated });

  const handleEdit = () => {
    if (!isSelectionMode) {
      navigation.navigate('EditInventoryItem', { inventoryItem: inventoryItem });
    }
  };

  const handleCardPress = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(inventoryItem.id);
    } else if (!isSelectionMode) {
      handleEdit();
    }
  };

  const handleLongPress = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(inventoryItem.id);
    } else if (!isSelectionMode) {
      onLongPressStart?.();
      drag();
    }
  };

  const renderSwipeActions = () => (
    <Pressable
      onPress={confirmRemoveInventoryItem}
      style={{
        backgroundColor: theme.colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        marginBottom: 8,
        borderRadius: 12,
        marginLeft: 8,
      }}
    >
      <IconButton icon="delete" size={26} iconColor="white" pointerEvents="none" />
      <Text style={{ color: 'white', fontSize: 11, marginTop: -8 }}>Deletar</Text>
    </Pressable>
  );

  const isLongName = inventoryItem.productName.length > 28;

  const cardContent = (
    <Card.Content style={{ paddingVertical: 8 }}>
      {isLongName ? (
        // Vertical layout for long names
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            {isSelectionMode && (
              <View style={{ marginRight: 8 }}>
                <Checkbox
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => onToggleSelect?.(inventoryItem.id)}
                />
              </View>
            )}
            <View style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>
                {getEmojiForProduct(inventoryItem.productName)}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text variant="titleMedium" numberOfLines={2}>
                {inventoryItem.productName}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <QuantityPill
              quantity={quantity}
              disabled={isSelectionMode}
              onDecrement={() => updateInventoryItemQuantity(Math.max(0, quantity - 1))}
              onIncrement={() => updateInventoryItemQuantity(quantity + 1)}
              onStartContinuousDecrement={() => startContinuousAdjustment(false)}
              onStartContinuousIncrement={() => startContinuousAdjustment(true)}
              onStopContinuous={stopContinuousAdjustment}
              testID={`increment-button-${inventoryItem.id}`}
            />
          </View>
        </View>
      ) : (
        // Horizontal layout for short names
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isSelectionMode && (
            <View style={{ marginRight: 8 }}>
              <Checkbox
                status={isSelected ? 'checked' : 'unchecked'}
                onPress={() => onToggleSelect?.(inventoryItem.id)}
              />
            </View>
          )}
          <View style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 20 }}>
              {getEmojiForProduct(inventoryItem.productName)}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text variant="titleMedium" numberOfLines={2}>
              {inventoryItem.productName}
            </Text>
          </View>
          <QuantityPill
            quantity={quantity}
            disabled={isSelectionMode}
            onDecrement={() => updateInventoryItemQuantity(Math.max(0, quantity - 1))}
            onIncrement={() => updateInventoryItemQuantity(quantity + 1)}
            onStartContinuousDecrement={() => startContinuousAdjustment(false)}
            onStartContinuousIncrement={() => startContinuousAdjustment(true)}
            onStopContinuous={stopContinuousAdjustment}
            testID={`increment-button-${inventoryItem.id}`}
          />
        </View>
      )}
    </Card.Content>
  );

  if (isSelectionMode) {
    return (
      <Card style={[styles.card, { opacity: isActive ? 0.5 : 1, marginBottom: 8 }]}>
        <Pressable
          onPress={handleCardPress}
          onLongPress={handleLongPress}
          testID={`product-card-${inventoryItem.id}`}
        >
          {cardContent}
        </Pressable>
      </Card>
    );
  }

  return (
    <Swipeable renderRightActions={renderSwipeActions}>
      <Card style={[styles.card, { opacity: isActive ? 0.5 : 1, marginBottom: 8 }]}>
        <Pressable
          onPress={handleCardPress}
          onLongPress={handleLongPress}
          testID={`product-card-${inventoryItem.id}`}
        >
          {cardContent}
        </Pressable>
      </Card>
    </Swipeable>
  );
};