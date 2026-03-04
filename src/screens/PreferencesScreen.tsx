import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Appbar,
  List,
  RadioButton,
  Text,
  useTheme,
  Divider,
  Portal,
  Dialog,
  Button,
  Menu,
  Provider
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getSetting,
  setSetting,
  getLists,
  getStores
} from '../database/database';

type PreferencesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Preferences'>;

interface ListItem {
  id: number;
  name: string;
}

export default function PreferencesScreen() {
  const navigation = useNavigation<PreferencesScreenNavigationProp>();
  const theme = useTheme();

  // List preferences
  const [defaultListMode, setDefaultListMode] = useState<'ask' | 'last' | 'fixed'>('ask');
  const [defaultListId, setDefaultListId] = useState<number | null>(null);
  const [lists, setLists] = useState<ListItem[]>([]);
  const [listMenuVisible, setListMenuVisible] = useState(false);

  // Store preferences
  const [defaultStoreMode, setDefaultStoreMode] = useState<'ask' | 'last' | 'fixed'>('ask');
  const [defaultStoreId, setDefaultStoreId] = useState<number | null>(null);
  const [stores, setStores] = useState<ListItem[]>([]);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);

  const [loading, setLoading] = useState(true);

  // Load settings and data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load settings
      const [
        listMode,
        listId,
        storeMode,
        storeId
      ] = await Promise.all([
        getSetting('defaultListMode'),
        getSetting('defaultListId'),
        getSetting('defaultStoreMode'),
        getSetting('defaultStoreId')
      ]);

      setDefaultListMode((listMode as 'ask' | 'last' | 'fixed') || 'ask');
      setDefaultListId(listId ? parseInt(listId) : null);
      setDefaultStoreMode((storeMode as 'ask' | 'last' | 'fixed') || 'ask');
      setDefaultStoreId(storeId ? parseInt(storeId) : null);

      // Load lists and stores
      const [listsData, storesData] = await Promise.all([
        getLists(),
        getStores()
      ]);

      setLists(listsData);
      setStores(storesData);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveListMode = async (mode: 'ask' | 'last' | 'fixed') => {
    try {
      setDefaultListMode(mode);
      await setSetting('defaultListMode', mode);
    } catch (error) {
      console.error('Error saving list mode:', error);
    }
  };

  const saveDefaultList = async (listId: number | null) => {
    try {
      setDefaultListId(listId);
      await setSetting('defaultListId', listId?.toString() || null);
    } catch (error) {
      console.error('Error saving default list:', error);
    }
  };

  const saveStoreMode = async (mode: 'ask' | 'last' | 'fixed') => {
    try {
      setDefaultStoreMode(mode);
      await setSetting('defaultStoreMode', mode);
    } catch (error) {
      console.error('Error saving store mode:', error);
    }
  };

  const saveDefaultStore = async (storeId: number | null) => {
    try {
      setDefaultStoreId(storeId);
      await setSetting('defaultStoreId', storeId?.toString() || null);
    } catch (error) {
      console.error('Error saving default store:', error);
    }
  };

  const getListName = (id: number | null) => {
    if (!id) return 'Nenhuma';
    const list = lists.find(l => l.id === id);
    return list ? list.name : 'Não encontrada';
  };

  const getStoreName = (id: number | null) => {
    if (!id) return 'Nenhuma';
    const store = stores.find(s => s.id === id);
    return store ? store.name : 'Não encontrada';
  };

  return (
    <Provider>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.navigate('Config')} />
          <Appbar.Content title="Preferências" />
        </Appbar.Header>

        <ScrollView style={styles.scrollView}>
          {/* Lista Padrão Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lista padrão</Text>

            <List.Item
              title="Sempre perguntar"
              description="Mostra sempre a tela de listas"
              onPress={() => saveListMode('ask')}
              left={() => (
                <RadioButton
                  value="ask"
                  status={defaultListMode === 'ask' ? 'checked' : 'unchecked'}
                  onPress={() => saveListMode('ask')}
                />
              )}
            />

            <List.Item
              title="Usar última utilizada"
              description="Abre automaticamente a última lista usada"
              onPress={() => saveListMode('last')}
              left={() => (
                <RadioButton
                  value="last"
                  status={defaultListMode === 'last' ? 'checked' : 'unchecked'}
                  onPress={() => saveListMode('last')}
                />
              )}
            />

            <List.Item
              title="Escolher lista"
              description="Usa sempre uma lista fixa"
              onPress={() => saveListMode('fixed')}
              left={() => (
                <RadioButton
                  value="fixed"
                  status={defaultListMode === 'fixed' ? 'checked' : 'unchecked'}
                  onPress={() => saveListMode('fixed')}
                />
              )}
            />

            {defaultListMode === 'fixed' && (
              <Menu
                visible={listMenuVisible}
                onDismiss={() => setListMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setListMenuVisible(true)}
                    style={styles.dropdownButton}
                  >
                    {getListName(defaultListId)}
                  </Button>
                }
              >
                {lists.map((list) => (
                  <Menu.Item
                    key={list.id}
                    onPress={() => {
                      saveDefaultList(list.id);
                      setListMenuVisible(false);
                    }}
                    title={list.name}
                  />
                ))}
              </Menu>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Loja Padrão Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loja padrão</Text>

            <List.Item
              title="Sempre perguntar"
              description="Pergunta sempre a loja na conclusão"
              onPress={() => saveStoreMode('ask')}
              left={() => (
                <RadioButton
                  value="ask"
                  status={defaultStoreMode === 'ask' ? 'checked' : 'unchecked'}
                  onPress={() => saveStoreMode('ask')}
                />
              )}
            />

            <List.Item
              title="Usar última utilizada"
              description="Usa automaticamente a última loja"
              onPress={() => saveStoreMode('last')}
              left={() => (
                <RadioButton
                  value="last"
                  status={defaultStoreMode === 'last' ? 'checked' : 'unchecked'}
                  onPress={() => saveStoreMode('last')}
                />
              )}
            />

            <List.Item
              title="Escolher loja"
              description="Usa sempre uma loja fixa"
              onPress={() => saveStoreMode('fixed')}
              left={() => (
                <RadioButton
                  value="fixed"
                  status={defaultStoreMode === 'fixed' ? 'checked' : 'unchecked'}
                  onPress={() => saveStoreMode('fixed')}
                />
              )}
              right={() => defaultStoreMode === 'fixed' && (
                <Menu
                  visible={storeMenuVisible}
                  onDismiss={() => setStoreMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => setStoreMenuVisible(true)}
                      style={styles.dropdownButton}
                    >
                      {getStoreName(defaultStoreId)}
                    </Button>
                  }
                >
                  {stores.map((store) => (
                    <Menu.Item
                      key={store.id}
                      onPress={() => {
                        saveDefaultStore(store.id);
                        setStoreMenuVisible(false);
                      }}
                      title={store.name}
                    />
                  ))}
                </Menu>
              )}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 8,
  },
  divider: {
    marginVertical: 16,
  },
  dropdownButton: {
    marginRight: 16,
  },
});
