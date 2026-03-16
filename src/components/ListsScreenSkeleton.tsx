import React from 'react';
import { View, Animated } from 'react-native';
import { useTheme, Divider } from 'react-native-paper';
import { useSkeletonOpacity } from '../hooks/useSkeletonOpacity';

export default function ListsScreenSkeleton() {
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
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 16,
      }}>
        {/* Emoji avatar */}
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: theme.colors.surfaceVariant,
        }} />
        {/* List name */}
        {bar(`${40 + (index * 13) % 35}%`, 16)}
        {/* Chevron */}
        <View style={{ marginLeft: 'auto' }}>
          {bar(20, 20, { borderRadius: 10 })}
        </View>
      </View>
      {index < 4 && <Divider />}
    </View>
  );

  return (
    <Animated.View style={{ opacity }}>
      {Array.from({ length: 5 }, (_, i) => renderRow(i))}
    </Animated.View>
  );
}