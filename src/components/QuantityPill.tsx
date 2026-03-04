import React from 'react';
import { View, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface QuantityPillProps {
  quantity: number;
  disabled?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  onStartContinuousDecrement: () => void;
  onStartContinuousIncrement: () => void;
  onStopContinuous: () => void;
  testID?: string;
}

export const QuantityPill = React.memo(({
  quantity,
  disabled = false,
  onDecrement,
  onIncrement,
  onStartContinuousDecrement,
  onStartContinuousIncrement,
  onStopContinuous,
  testID,
}: QuantityPillProps) => {
  const theme = useTheme();

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: theme.colors.outline,
      borderRadius: 999,
      overflow: 'hidden',
      opacity: disabled ? 0.4 : 1,
      minWidth: 80,
      justifyContent: 'space-between',
    }}>
      <Pressable
        style={{ paddingHorizontal: 10, paddingVertical: 8 }}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        onPress={onDecrement}
        onLongPress={onStartContinuousDecrement}
        onPressOut={onStopContinuous}
        disabled={disabled}
      >
        <Text style={{ fontSize: 22, lineHeight: 20, color: theme.colors.onSurface }}>−</Text>
      </Pressable>

      <Text style={{
        fontSize: 16,
        fontWeight: '700',
        minWidth: 24,
        textAlign: 'center',
        color: theme.colors.onSurface,
      }}>
        {quantity}
      </Text>

      <Pressable
        style={{ paddingHorizontal: 10, paddingVertical: 8 }}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        onPress={onIncrement}
        onLongPress={onStartContinuousIncrement}
        onPressOut={onStopContinuous}
        disabled={disabled}
        testID={testID}
      >
        <Text style={{ fontSize: 22, lineHeight: 20, color: theme.colors.onSurface }}>+</Text>
      </Pressable>
    </View>
  );
});
