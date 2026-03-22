import React from "react";
import { View } from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useTheme } from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";

/**
 * Renders a styled search input for product queries with a clear button when the input contains non-whitespace text.
 *
 * @param searchQuery - Current text value of the search input.
 * @param setSearchQuery - Callback invoked with the new text value; invoked with an empty string when the clear button is pressed.
 * @returns The rendered search bar React element.
 */
export default function SearchBar({ searchQuery, setSearchQuery }) {

    const theme = useTheme();

    const styles = createHomeScreenStyles(theme);
    return (
        <View style={styles.searchContainer}>
            <PaperTextInput
                placeholder="Buscar produtos..."
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