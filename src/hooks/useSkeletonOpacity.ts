import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export const useSkeletonOpacity = () => {
  const opacityAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);
  return opacityAnim;
};