// components/SortMenu.tsx
import {useState} from 'react';
import { Button, Menu, Divider, useTheme } from 'react-native-paper';
import { SortOrder } from '../utils/sortUtils';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';

interface SortMenuProps {
  setSortOrder: (order: SortOrder) => void;
}

export const SortMenu = ({ setSortOrder }: SortMenuProps) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  const handleSortChange = (order: SortOrder) => {
    setSortOrder(order);
    closeMenu();
  };

  return (
    <Menu
      visible={menuVisible}
      onDismiss={closeMenu}
      anchor={
        <Button
          icon="sort"
          onPress={openMenu}
          style={styles.button}
          labelStyle={styles.buttonText}
        >
          Ordenar
        </Button>
      }
    >
      <Menu.Item onPress={() => handleSortChange("custom")} title="Ordem Personalizada" />
      <Divider />
      <Menu.Item onPress={() => handleSortChange("alphabetical")} title="Alfabética" />
      <Divider />
      <Menu.Item onPress={() => handleSortChange("quantityDesc")} title="Quantidade (Maior Primeiro)" />
      <Divider />
      <Menu.Item onPress={() => handleSortChange("quantityAsc")} title="Quantidade (Menor Primeiro)" />
    </Menu>
  );
};