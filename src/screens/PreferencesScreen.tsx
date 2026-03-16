import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import {
  Appbar,
  List,
  RadioButton,
  Text,
  useTheme,
  Divider,
  Portal,
  Dialog,
  Button
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
import { ItemPickerDialog } from '../components/ItemPickerDialog';

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
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // Store preferences
  const [defaultStoreMode, setDefaultStoreMode] = useState<'ask' | 'last' | 'fixed'>('ask');
  const [defaultStoreId, setDefaultStoreId] = useState<number | null>(null);
  const [stores, setStores] = useState<ListItem[]>([]);


  const [listPickerVisible, setListPickerVisible] = useState(false);
  const [storePickerVisible, setStorePickerVisible] = useState(false);

  // Load settings and data
  useEffect(() => {
    loadData();
  }, []);

  const effectiveMessage = copyMessage === '__blank__' ? '' : copyMessage;


  const loadData = async () => {
    try {
      // Load settings
      const [
        listMode,
        listId,
        storeMode,
        storeId,
        msg
      ] = await Promise.all([
        getSetting('defaultListMode'),
        getSetting('defaultListId'),
        getSetting('defaultStoreMode'),
        getSetting('defaultStoreId'),
        getSetting('copyMessage'),
      ]);

      setDefaultListMode((listMode as 'ask' | 'last' | 'fixed') || 'ask');
      setDefaultListId(listId ? parseInt(listId) : null);
      setDefaultStoreMode((storeMode as 'ask' | 'last' | 'fixed') || 'ask');
      setDefaultStoreId(storeId ? parseInt(storeId) : null);
      setCopyMessage(msg); // null stays null, '__blank__' stays '__blank__'

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
            <>
              <List.Item
                title="Lista selecionada"
                description={getListName(defaultListId)}
                onPress={() => setListPickerVisible(true)}
                right={props => <List.Icon {...props} icon="chevron-right" />}
              />
              <ItemPickerDialog
                visible={listPickerVisible}
                items={lists}
                selectedId={defaultListId}
                onSelect={saveDefaultList}
                onDismiss={() => setListPickerVisible(false)}
                title="Escolher lista"
              />
            </>
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
          />
          {defaultStoreMode === 'fixed' && (
            <>
              <List.Item
                title="Loja selecionada"
                description={getStoreName(defaultStoreId)}
                onPress={() => setStorePickerVisible(true)}
                right={props => <List.Icon {...props} icon="chevron-right" />}
              />
              <ItemPickerDialog
                visible={storePickerVisible}
                items={stores}
                selectedId={defaultStoreId}
                onSelect={saveDefaultStore}
                onDismiss={() => setStorePickerVisible(false)}
                title="Escolher loja"
              />
            </>
          )}
        </View>

        <Divider style={styles.divider} />
        <View style={[styles.section, { marginBottom: 300 }]}>
          <Text style={styles.sectionTitle}>Mensagem ao copiar estoque</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13, marginLeft: 8, marginBottom: 8 }}>
            Use {'{data}'} para inserir a data automaticamente.
          </Text>
          <TextInput
            mode="outlined"
            value={effectiveMessage ?? ''}
            onChangeText={setCopyMessage}
            onBlur={() => setSetting('copyMessage', copyMessage?.trim() === '' ? '__blank__' : copyMessage?.trim() ?? null)} multiline
            numberOfLines={3}
            placeholder={`Boa noite! {data}\n\nAqui está a lista de produção do dia:`}
            style={{ marginHorizontal: 8 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 8, marginTop: 4 }}>
            <Text style={{ flex: 1, color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              {effectiveMessage === null
                ? 'Usando mensagem padrão.'
                : effectiveMessage.trim() === ''
                  ? 'Nenhuma mensagem será adicionada antes da lista.'
                  : `Prévia: ${effectiveMessage.replace(/\{data\}/g, new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }))}`
              }
            </Text>
            {copyMessage !== null && (
              <Button
                compact
                mode="text"
                onPress={() => {
                  setCopyMessage(null);
                  setSetting('copyMessage', null);
                }}
              >
                Restaurar padrão
              </Button>
            )}
          </View>
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
