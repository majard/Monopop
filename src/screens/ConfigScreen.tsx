import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, List, useTheme, Appbar, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';

type ConfigScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Config'>;

interface MenuItemProps {
  title: string;
  icon: string;
  onPress: () => void;
}

const MenuItem = ({ title, icon, onPress }: MenuItemProps) => {
  const theme = useTheme();
  return (
    <List.Item
      title={title}
      left={props => <List.Icon {...props} icon={icon} />}
      right={props => <List.Icon {...props} icon="chevron-right" />}
      onPress={onPress}
    />
  );
};

export default function ConfigScreen() {
  const navigation = useNavigation<ConfigScreenNavigationProp>();
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.navigate('Lists')} />
        <Appbar.Content title="Configurações" />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <MenuItem
            title="Produtos"
            icon="package-variant"
            onPress={() => navigation.navigate('Products')}
          />
          <MenuItem
            title="Lojas"
            icon="store"
            onPress={() => navigation.navigate('Stores')}
          />
          <MenuItem
            title="Categorias"
            icon="folder"
            onPress={() => navigation.navigate('Categories')}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.section}>
          <MenuItem
            title="Compras"
            icon="receipt-text"
            onPress={() => navigation.navigate('Invoices')}
          />
        </View>

        <Divider style={styles.divider} />

        <View style={styles.section}>
          <MenuItem
            title="Backup"
            icon="cloud-upload"
            onPress={() => navigation.navigate('Backup')}
          />
          <MenuItem
            title="Sobre"
            icon="information"
            onPress={() => navigation.navigate('About')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  menuCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  menuContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  menuIcon: {
    width: 24,
    height: 24,
    marginRight: 16,
    backgroundColor: 'transparent',
  },
  menuTitle: {
    fontSize: 16,
    flex: 1,
  },
  divider: {
    marginHorizontal: 16,
  },
});
