import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';
import { useSkeletonOpacity } from '../hooks/useSkeletonOpacity';

export default function HistoryScreenSkeleton() {
  const theme = useTheme();
  const opacity = useSkeletonOpacity();

  const bar = (width: number | string, height: number, style?: object) => (
    <View style={[{ width, height, borderRadius: 4, backgroundColor: theme.colors.surfaceVariant }, style]} />
  );

  const renderEventCard = (index: number) => (
    <Surface key={index} style={[s.card, { backgroundColor: theme.colors.surface }]}>
      <View style={s.cardHeader}>
        <View style={[s.icon, { backgroundColor: theme.colors.surfaceVariant }]} />
        <View style={{ marginLeft: 8, gap: 6 }}>
          {bar(100, 14)}
          {bar(70, 12)}
        </View>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {bar(60, 16)}
          {bar(20, 20, { borderRadius: 10 })}
        </View>
      </View>
      {bar(50, 12, { marginTop: 8 })}
    </Surface>
  );

  return (
    <Animated.View style={{ opacity, padding: 16, gap: 10 }}>
      <Surface style={[s.summaryCard, { backgroundColor: theme.colors.surface }]}>
        {bar('30%', 12, { marginBottom: 14 })}
        <View style={s.summaryRow}>
          {[80, 60, 90].map((w, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}>
              {bar(w, 16)}
              {bar(w * 0.7, 11)}
            </View>
          ))}
        </View>
      </Surface>
      {Array.from({ length: 4 }, (_, i) => renderEventCard(i))}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  summaryCard: { padding: 16, borderRadius: 12, elevation: 2, marginBottom: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { padding: 12, borderRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 28, height: 28, borderRadius: 14 },
});