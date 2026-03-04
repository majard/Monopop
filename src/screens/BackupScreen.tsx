import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Share, Alert } from 'react-native';
import { Appbar, Card, Text, useTheme, Button, TextInput, Divider, Portal, Dialog, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDb } from '../database/database';

type BackupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Backup'>;

const DB_VERSION = '1.0';

export default function BackupScreen() {
  const navigation = useNavigation<BackupScreenNavigationProp>();
  const theme = useTheme();
  const [importText, setImportText] = useState('');
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [confirmTimer, setConfirmTimer] = useState(3);
  const [resetEnabled, setResetEnabled] = useState(false);
  const [resetTimer, setResetTimer] = useState(3);
  const [loading, setLoading] = useState(false);
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [importDialogVisible, setImportDialogVisible] = useState(false);

  // Countdown timer for import confirmation
  useEffect(() => {
    if (importDialogVisible && confirmTimer > 0) {
      const timer = setTimeout(() => setConfirmTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (confirmTimer === 0) {
      setConfirmEnabled(true);
    }
  }, [importDialogVisible, confirmTimer]);

  // Countdown timer for reset confirmation
  useEffect(() => {
    if (resetDialogVisible && resetTimer > 0) {
      const timer = setTimeout(() => setResetTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (resetTimer === 0) {
      setResetEnabled(true);
    }
  }, [resetDialogVisible, resetTimer]);

  const handleExport = async () => {
    try {
      setLoading(true);
      const db = getDb();

      // Export tables in dependency order
      const categories = await db.getAllAsync('SELECT * FROM categories ORDER BY id');
      const stores = await db.getAllAsync('SELECT * FROM stores ORDER BY id');
      const products = await db.getAllAsync('SELECT * FROM products ORDER BY id');
      const lists = await db.getAllAsync('SELECT * FROM lists ORDER BY id');
      const inventoryItems = await db.getAllAsync('SELECT * FROM inventory_items ORDER BY id');
      const inventoryHistory = await db.getAllAsync('SELECT * FROM inventory_history ORDER BY id');
      const shoppingListItems = await db.getAllAsync('SELECT * FROM shopping_list_items ORDER BY id');
      const invoices = await db.getAllAsync('SELECT * FROM invoices ORDER BY id');
      const invoiceItems = await db.getAllAsync('SELECT * FROM invoice_items ORDER BY id');
      const settings = await db.getAllAsync('SELECT * FROM settings ORDER BY id');

      const exportData = {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        tables: {
          categories,
          stores,
          products,
          lists,
          inventory_items: inventoryItems,
          inventory_history: inventoryHistory,
          shopping_list_items: shoppingListItems,
          invoices,
          invoice_items: invoiceItems,
          settings,
        },
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      await Share.share({
        message: jsonString,
        title: 'Backup Listai',
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Erro', 'Falha ao exportar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);
      setImportDialogVisible(false);

      const importData = JSON.parse(importText);

      if (!importData.version || !importData.tables) {
        Alert.alert('Erro', 'Formato de backup inválido');
        return;
      }

      const db = await getDb();

      await db.withTransactionAsync(async () => {
        // Clear all tables in reverse dependency order
        await db.runAsync('DELETE FROM invoice_items');
        await db.runAsync('DELETE FROM invoices');
        await db.runAsync('DELETE FROM shopping_list_items');
        await db.runAsync('DELETE FROM inventory_history');
        await db.runAsync('DELETE FROM inventory_items');
        await db.runAsync('DELETE FROM products');
        await db.runAsync('DELETE FROM categories');
        await db.runAsync('DELETE FROM stores');
        await db.runAsync('DELETE FROM lists');
        await db.runAsync('DELETE FROM settings');

        // Import in dependency order
        const { tables } = importData;

        for (const category of tables.categories || []) {
          await db.runAsync(
            'INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
            [category.id, category.name, category.createdAt, category.updatedAt]
          );
        }

        for (const store of tables.stores || []) {
          await db.runAsync(
            'INSERT INTO stores (id, name, createdAt) VALUES (?, ?, ?)',
            [store.id, store.name, store.createdAt]
          );
        }

        for (const product of tables.products || []) {
          await db.runAsync(
            'INSERT INTO products (id, name, categoryId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [product.id, product.name, product.categoryId, product.createdAt, product.updatedAt]
          );
        }

        for (const list of tables.lists || []) {
          await db.runAsync(
            'INSERT INTO lists (id, name, "order") VALUES (?, ?, ?)',
            [list.id, list.name, list.order]
          );
        }

        for (const item of tables.inventory_items || []) {
          await db.runAsync(
            'INSERT INTO inventory_items (id, listId, productId, quantity, sortOrder, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [item.id, item.listId, item.productId, item.quantity, item.sortOrder, item.notes, item.createdAt, item.updatedAt]
          );
        }

        for (const history of tables.inventory_history || []) {
          await db.runAsync(
            'INSERT INTO inventory_history (id, inventoryItemId, quantity, date, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [history.id, history.inventoryItemId, history.quantity, history.date, history.notes, history.createdAt]
          );
        }

        for (const sli of tables.shopping_list_items || []) {
          await db.runAsync(
            'INSERT INTO shopping_list_items (id, inventoryItemId, quantity, checked, price, sortOrder, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sli.id, sli.inventoryItemId, sli.quantity, sli.checked, sli.price, sli.sortOrder, sli.notes, sli.createdAt, sli.updatedAt]
          );
        }

        for (const invoice of tables.invoices || []) {
          await db.runAsync(
            'INSERT INTO invoices (id, storeId, listId, total, createdAt) VALUES (?, ?, ?, ?, ?)',
            [invoice.id, invoice.storeId, invoice.listId, invoice.total, invoice.createdAt]
          );
        }

        for (const ii of tables.invoice_items || []) {
          await db.runAsync(
            'INSERT INTO invoice_items (id, invoiceId, productId, quantity, unitPrice, lineTotal, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [ii.id, ii.invoiceId, ii.productId, ii.quantity, ii.unitPrice, ii.lineTotal, ii.createdAt]
          );
        }

        for (const setting of tables.settings || []) {
          await db.runAsync(
            'INSERT INTO settings (id, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [setting.id, setting.key, setting.value, setting.createdAt, setting.updatedAt]
          );
        }
      });

      Alert.alert('Sucesso', 'Dados importados com sucesso!');
      setImportText('');
      setConfirmEnabled(false);
      setConfirmTimer(3);
    } catch (error) {
      console.error('Error importing data:', error);
      Alert.alert('Erro', 'Falha ao importar dados. Verifique o formato do JSON.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      setResetDialogVisible(false);

      const db = getDb();
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM invoice_items');
        await db.runAsync('DELETE FROM invoices');
        await db.runAsync('DELETE FROM shopping_list_items');
        await db.runAsync('DELETE FROM inventory_history');
        await db.runAsync('DELETE FROM inventory_items');
        await db.runAsync('DELETE FROM products');
        await db.runAsync('DELETE FROM categories');
        await db.runAsync('DELETE FROM stores');
        await db.runAsync('DELETE FROM lists');
      });

      Alert.alert('Sucesso', 'Todos os dados foram apagados!');
      setResetEnabled(false);
      setResetTimer(3);
    } catch (error) {
      console.error('Error resetting data:', error);
      Alert.alert('Erro', 'Falha ao resetar dados');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.navigate('Config')} />
        <Appbar.Content title="Backup" />
      </Appbar.Header>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        {/* Export Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Exportar Dados</Text>
            <Text style={styles.description}>
              Exporte todos os seus dados para um arquivo JSON que pode ser compartilhado ou salvo.
            </Text>
            <Button mode="contained" onPress={handleExport} icon="cloud-upload" style={styles.button}>
              Exportar Backup
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Import Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Importar Dados</Text>
            <Text style={styles.warning}>
              ⚠️ ATENÇÃO: Isso substituirá TODOS os dados existentes!
            </Text>
            <TextInput
              label="Cole o JSON de backup aqui"
              value={importText}
              onChangeText={setImportText}
              mode="outlined"
              multiline
              numberOfLines={6}
              style={styles.textInput}
            />
            <Button
              mode="contained"
              onPress={() => {
                setConfirmEnabled(false);
                setConfirmTimer(3);
                setImportDialogVisible(true);
              }}
              icon="cloud-download"
              style={styles.button}
              disabled={!importText.trim()}
            >
              Importar
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* Reset Section */}
        <Card style={[styles.card, { borderColor: theme.colors.error, borderWidth: 1 }]}>
          <Card.Content>
            <Text style={[styles.sectionTitle, { color: theme.colors.error }]}>Resetar Dados</Text>
            <Text style={styles.warning}>
              ⚠️ ATENÇÃO: Isso apagará TODOS os dados permanentemente!
            </Text>
            <Button
              mode="contained"
              onPress={() => {
                setResetEnabled(false);
                setResetTimer(3);
                setResetDialogVisible(true);
              }}
              icon="delete-forever"
              style={[styles.button, { backgroundColor: theme.colors.error }]}
            >
              Resetar Tudo
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Import Confirmation Dialog */}
      <Portal>
        <Dialog visible={importDialogVisible} onDismiss={() => setImportDialogVisible(false)}>
          <Dialog.Title>Confirmar Importação</Dialog.Title>
          <Dialog.Content>
            <Text>TODOS os dados atuais serão substituídos!</Text>
            <Text style={styles.timerText}>
              Aguarde {confirmTimer}s para confirmar...
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setImportDialogVisible(false)}>Cancelar</Button>
            <Button onPress={handleImport} disabled={!confirmEnabled}>
              {confirmEnabled ? 'Confirmar Importação' : `Aguarde ${confirmTimer}s`}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Reset Confirmation Dialog */}
      <Portal>
        <Dialog visible={resetDialogVisible} onDismiss={() => setResetDialogVisible(false)}>
          <Dialog.Title>Confirmar Reset</Dialog.Title>
          <Dialog.Content>
            <Text>TODOS os dados serão APAGADOS permanentemente!</Text>
            <Text style={styles.timerText}>
              Aguarde {resetTimer}s para confirmar...
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetDialogVisible(false)}>Cancelar</Button>
            <Button onPress={handleReset} disabled={!resetEnabled} textColor={theme.colors.error}>
              {resetEnabled ? 'Confirmar Reset' : `Aguarde ${resetTimer}s`}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  warning: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: '600',
    marginBottom: 16,
  },
  textInput: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 16,
  },
  timerText: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
