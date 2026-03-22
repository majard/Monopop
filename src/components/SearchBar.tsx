import React from "react";
import { View } from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useTheme } from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  placeholder?: string;
}

export default function SearchBar({ searchQuery, setSearchQuery, placeholder = "Buscar produtos..." }: SearchBarProps) {
    const theme = useTheme();
    const styles = createHomeScreenStyles(theme);
    return (
        <View style={styles.searchContainer}>
            <PaperTextInput
                placeholder={placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                mode="outlined"
                style={styles.searchInput}
                right={
                    searchQuery.trim() ? (
                        <PaperTextInput.Icon
                            icon="close"
                            size={24}
                            onPress={() => setSearchQuery("")}
                            color={theme.colors.error}
                        />
                    ) : undefined
                }
            />
        </View>
    );
}