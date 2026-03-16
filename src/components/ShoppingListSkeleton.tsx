import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme, Surface } from 'react-native-paper';
import { useSkeletonOpacity } from '../hooks/useSkeletonOpacity';

export default function ShoppingListSkeleton() {
  const theme = useTheme();
  const opacity = useSkeletonOpacity();

  const renderSkeletonRow = (index: number) => (
    <Surface key={index} style={[skeletonStyles.card, { backgroundColor: theme.colors.surface }]}>
      <View style={skeletonStyles.row}>
        <View style={[skeletonStyles.checkbox, { backgroundColor: theme.colors.surfaceVariant }]} />
        <View style={[skeletonStyles.name, { backgroundColor: theme.colors.surfaceVariant }]} />
        <View style={skeletonStyles.rightCol}>
          <View style={[skeletonStyles.priceBar, { backgroundColor: theme.colors.surfaceVariant }]} />
          <View style={[skeletonStyles.stockBar, { backgroundColor: theme.colors.surfaceVariant }]} />
        </View>
        <View style={[skeletonStyles.deleteIcon, { backgroundColor: theme.colors.surfaceVariant }]} />
      </View>
    </Surface>
  );

  const renderSectionHeader = () => (
    <View style={[skeletonStyles.sectionHeader, { backgroundColor: theme.colors.surfaceVariant }]} />
  );

  return (
    <Animated.View style={{ opacity }}>
      <View style={skeletonStyles.sectionHeaderContainer}>
        {renderSectionHeader()}
      </View>
      {Array.from({ length: 3 }, (_, index) => renderSkeletonRow(index))}
      <View style={skeletonStyles.sectionHeaderContainer}>
        {renderSectionHeader()}
      </View>
      {Array.from({ length: 3 }, (_, index) => renderSkeletonRow(index + 3))}
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  sectionHeaderContainer: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeader: {
    height: 14,
    width: '35%',
    borderRadius: 4,
  },
  card: {
    marginBottom: 6,
    borderRadius: 8,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  name: {
    flex: 1,
    height: 15,
    width: '55%',
    borderRadius: 4,
  },
  rightCol: {
    alignItems: 'flex-end',
  },
  priceBar: {
    height: 13,
    width: 70,
    borderRadius: 4,
    marginBottom: 2,
  },
  stockBar: {
    height: 11,
    width: 45,
    borderRadius: 4,
  },
  deleteIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
});