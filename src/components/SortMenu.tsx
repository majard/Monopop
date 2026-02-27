import {useState, useCallback} from 'react';
import { Button, Menu, Divider, useTheme } from 'react-native-paper';
import { SortOrder } from '../utils/sortUtils';
import { createHomeScreenStyles } from '../styles/HomeScreenStyles';

interface SortMenuProps {
  setSortOrder: (order: SortOrder) => void;
}

export const SortMenu = ({ setSortOrder }: SortMenuProps) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  
  const openMenu = useCallback(() => {
    setOpenCount(c => c + 1);
    setMenuVisible(true);
  }, []);
  
  const closeMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const handleSortChange = useCallback((order: SortOrder) => {
    setSortOrder(order);
    closeMenu();
  }, [setSortOrder]);

  const theme = useTheme();
  const styles = createHomeScreenStyles(theme);

  return (
    <Menu
      key={`menu-${openCount}`}
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