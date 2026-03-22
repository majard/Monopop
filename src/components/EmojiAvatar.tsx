import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

interface EmojiAvatarProps {
  emoji: string;
  size?: 'small' | 'medium' | 'large';
}

const SIZES = {
  small:  { container: 24, fontSize: 14 },
  medium: { container: 32, fontSize: 20 },
  large:  { container: 48, fontSize: 28 },
};

export const EmojiAvatar = React.memo(({ emoji, size = 'medium' }: EmojiAvatarProps) => {
  const { container, fontSize } = SIZES[size];
  return (
    <View style={{ width: container, height: container, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize }}>{emoji}</Text>
    </View>
  );
});
