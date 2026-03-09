import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Animated } from 'react-native';

export default function ShoppingListSkeleton() {
  const theme = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();
    
    return () => pulseAnimation.stop();
  }, [opacityAnim]);

  const renderSkeletonRow = (index: number) => (
    <Animated.View 
      key={index}
      style={[
        localStyles.skeletonRow,
        { opacity: opacityAnim }
      ]}
    >
      <View style={localStyles.skeletonLeft}>
        <View 
          style={[
            localStyles.skeletonProductName,
            { backgroundColor: theme.colors.surfaceVariant }
          ]} 
        />
        <View 
          style={[
            localStyles.skeletonQuantity,
            { backgroundColor: theme.colors.surfaceVariant }
          ]} 
        />
      </View>
      <View style={localStyles.skeletonRight}>
        <View 
          style={[
            localStyles.skeletonCheckbox,
            { backgroundColor: theme.colors.surfaceVariant }
          ]} 
        />
      </View>
    </Animated.View>
  );

  return (
    <View style={localStyles.container}>
      {Array.from({ length: 6 }, (_, index) => renderSkeletonRow(index))}
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonLeft: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  skeletonProductName: {
    height: 20,
    width: '60%',
    borderRadius: 4,
  },
  skeletonQuantity: {
    height: 16,
    width: '30%',
    borderRadius: 4,
  },
  skeletonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeletonCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
});
