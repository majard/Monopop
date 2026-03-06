import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { FAB } from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { useTheme } from "react-native-paper";

interface AddItemProps {
    onPress: () => void;
    label: string;
    style?: StyleProp<ViewStyle>;
}

export const AddItemButton = ({ onPress, label, style}: AddItemProps) => {

    const theme = useTheme();
    const styles = createHomeScreenStyles(theme);

    return (
        <FAB
            style={[styles.fabBottomInset, style]}
            icon="plus"
            onPress={onPress}
            label={label}
        />
    );
};