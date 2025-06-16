import { FAB } from "react-native-paper";
import { createHomeScreenStyles } from "../styles/HomeScreenStyles";
import { useTheme } from "react-native-paper";


interface AddItemProps {
    onPress: () => void;
    label: string;
}

export const AddItemButton = ({ onPress, label}: AddItemProps) => {

    const theme = useTheme();
    const styles = createHomeScreenStyles(theme);

    return (
        <FAB
            style={styles.fab}
            icon="plus"
            onPress={onPress}
            label={label}
        />
    );
};