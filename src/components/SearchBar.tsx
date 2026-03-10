import React from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function SearchBar({ searchQuery, setSearchQuery, placeholder = "Buscar produtos...", autoFocus }: SearchBarProps) {
  const theme = useTheme();

  return (
    <View style={[localStyles.container, { backgroundColor: theme.colors.surfaceVariant }]}>
      <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.onSurfaceVariant} />
      <TextInput
        style={[localStyles.input, { color: theme.colors.onSurface }]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoFocus={autoFocus}
      />
      {searchQuery.trim() ? (
        <Pressable onPress={() => setSearchQuery('')}>
          <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
        </Pressable>
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 15,
    backgroundColor: 'transparent',
  },
});