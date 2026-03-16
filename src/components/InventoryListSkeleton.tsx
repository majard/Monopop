import React from 'react';
import { View, Animated } from 'react-native';
import { Surface, useTheme, Divider } from 'react-native-paper';
import { useSkeletonOpacity } from '../hooks/useSkeletonOpacity';

export default function InventoryListSkeleton() {
  const theme = useTheme();
  const opacity = useSkeletonOpacity();

  const bar = (width: number | string, height: number, style?: object) => (
    <View style={[{
      width, height, borderRadius: 4,
      backgroundColor: theme.colors.surfaceVariant
    }, style]} />
  );

  const renderRow = (index: number) => (
    <View key={index}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
      }}>
        {/* Emoji avatar placeholder */}
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: theme.colors.surfaceVariant,
        }} />

        {/* Name + category */}
        <View style={{ flex: 1, gap: 6 }}>
          {bar('60%', 14)}
          {bar('35%', 11)}
        </View>

        {/* Quantity badge */}
        <View style={{
          width: 48, height: 28, borderRadius: 14,
          backgroundColor: theme.colors.surfaceVariant,
        }} />

        {/* Stepper placeholder */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: theme.colors.surfaceVariant,
          }} />
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: theme.colors.surfaceVariant,
          }} />
        </View>
      </View>
      {index < 7 && <Divider />}
    </View>
  );

  return (
    <Animated.View style={{ opacity }}>
      {/* Category header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        {bar('25%', 12)}
      </View>
      {Array.from({ length: 4 }, (_, i) => renderRow(i))}

      {/* Second category header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        {bar('30%', 12)}
      </View>
      {Array.from({ length: 4 }, (_, i) => renderRow(i + 4))}
    </Animated.View>
  );
}