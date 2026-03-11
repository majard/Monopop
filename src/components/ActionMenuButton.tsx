import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ActionMenuButtonProps {
  onPress: () => void;
}

export function ActionMenuButton({ onPress }: ActionMenuButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.outline,
        backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent',
      })}
    >
      <MaterialCommunityIcons name="dots-vertical" size={16} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}