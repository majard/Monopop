import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Appbar, Card, Text, useTheme, Button, Divider, Portal, Dialog, ActivityIndicator, List } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDb, getLists } from '../database/database';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import {
  buildFullBackup,
  buildListExport,
  shareJsonFile,
  detectImportType,
  ListExportData,
} from '../utils/backupUtils';
import { useListImportEngine } from '../hooks/useListImportEngine';
import { ConfirmationModal, ImportSummaryModal } from '../components/ImportConfirmationModal';
import { ItemPickerDialog } from '../components/ItemPickerDialog';

type BackupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Backup'>;
type BackupScreenProps = NativeStackScreenProps<RootStackParamList, 'Backup'>;

export default function BackupScreen() {
  const navigation = useNavigation<BackupScreenNavigationProp>();
  const route = useRoute<BackupScreenProps['route']>();
  const theme = useTheme();

  // ─── Full backup state ────────────────────────────────────────────────────
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [confirmTimer, setConfirmTimer] = useState(3);
  const [resetEnabled, setResetEnabled] = useState(false);
  const [resetTimer, setResetTimer] = useState(3);
  const [loading, setLoading] = useState(false);
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);

  // ─── List export state ────────────────────────────────────────────────────
  const [lists, setLists] = useState<{ id: number; name: string }[]>([]);
  const [listPickerVisible, setListPickerVisible] = useState(false);

  // ─── List import engine ───────────────────────────────────────────────────
  const handleImportSuccess = useCallback(async () => {
    // called after successful list import
  }, []);

  const engine = useListImportEngine(handleImportSuccess);

  // ─── Load lists for export picker ─────────────────────────────────────────
  useEffect(() => {
    getLists().then(setLists);
  }, []);

  // ─── Handle incoming params (from intent filter or ListsScreen) ───────────
  useEffect(() => {
    const pending = route.params?.pendingListImport;
    const pendingBackup = route.params?.pendingBackupImport;

    if (pending) {
      engine.startListImport(pending);
    } else if (pendingBackup) {
      setImportData(pendingBackup);
      setImportFileName('arquivo recebido');
      setConfirmEnabled(false);
      setConfirmTimer(3);
      setImportDialogVisible(true);
    }
  }, [route.params]);

  // ─── Full backup countdown timers ─────────────────────────────────────────
  useEffect(() => {
    if (importDialogVisible && confirmTimer > 0) {
      const timer = setTimeout(() => setConfirmTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (confirmTimer === 0) {
      setConfirmEnabled(true);
    }
  }, [importDialogVisible, confirmTimer]);

  useEffect(() => {
    if (resetDialogVisible && resetTimer > 0) {
      const timer = setTimeout(() => setResetTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (resetTimer === 0) {
      setResetEnabled(true);
    }
  }, [resetDialogVisible, resetTimer]);

  // ─── List export ──────────────────────────────────────────────────────────
  const handleListExport = async (listId: number) => {
    try {
      setLoading(true);
      const { jsonString, fileName } = await buildListExport(listId);
      await shareJsonFile(jsonString, fileName);
    } catch (error) {
      console.error('Error exporting list:', error);
      Alert.alert('Erro', 'Falha ao exportar a lista.');
    } finally {
      setLoading(false);
    }
  };

  // ─── List import (file picker path) ──────────────────────────────────────
  const handleSelectListFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
        const data = JSON.parse(content);
        const type = detectImportType(data);
        if (type !== 'list_export') {
          Alert.alert('Arquivo inválido', 'Este arquivo não é uma lista Monopop exportada. Para importar um backup completo use a seção abaixo.');
          return;
        }
        await engine.startListImport(data as ListExportData);
      }
    } catch (error) {
      console.error('Error selecting list file:', error);
      Alert.alert('Erro', 'Falha ao ler o arquivo.');
    }
  };

  // ─── Full backup handlers (unchanged logic, now using backupUtils) ────────
  const handleSaveToDevice = async () => {
    try {
      setLoading(true);
      const { jsonString, fileName } = await buildFullBackup();
      const { StorageAccessFramework } = await import('expo-file-system/legacy');
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const fileUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri, fileName, 'application/json'
        );
        await FileSystem.writeAsStringAsync(fileUri, jsonString);
        Alert.alert('Sucesso', `Backup salvo como ${fileName}`);
      } else {
        Alert.alert('Permissão Negada', 'Abrindo compartilhamento...', [
          { text: 'OK', onPress: () => handleShare() }
        ]);
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar no dispositivo');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      setLoading(true);
      const { jsonString, fileName } = await buildFullBackup();
      await shareJsonFile(jsonString, fileName);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao compartilhar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBackupFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
        const data = JSON.parse(content);
        const type = detectImportType(data);
        if (type !== 'full_backup') {
          Alert.alert('Arquivo inválido', 'Este arquivo não é um backup completo Monopop. Para importar uma lista use a seção acima.');
          return;
        }
        setImportData(data);
        setImportFileName(result.assets[0].name);
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha ao ler o arquivo selecionado');
    }
  };

  const handleImport = async () => {
    if (!importData) return;
    const db = getDb();
    try {
      setLoading(true);
      setImportDialogVisible(false);
      await db.runAsync('PRAGMA foreign_keys = OFF');
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM invoice_items');
        await db.runAsync('DELETE FROM shopping_list_items');
        await db.runAsync('DELETE FROM invoices');
        await db.runAsync('DELETE FROM inventory_history');
        await db.runAsync('DELETE FROM inventory_items');
        await db.runAsync('DELETE FROM product_store_prices');
        await db.runAsync('DELETE FROM product_base_prices');
        await db.runAsync('DELETE FROM products');
        await db.runAsync('DELETE FROM categories');
        await db.runAsync('DELETE FROM stores');
        await db.runAsync('DELETE FROM lists');
        await db.runAsync('DELETE FROM settings');

        const { tables } = importData;
        for (const category of tables.categories || []) {
          await db.runAsync('INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
            [category.id, category.name, category.createdAt, category.updatedAt]);
        }
        for (const store of tables.stores || []) {
          await db.runAsync('INSERT INTO stores (id, name, createdAt) VALUES (?, ?, ?)',
            [store.id, store.name, store.createdAt]);
        }
        for (const product of tables.products || []) {
          await db.runAsync('INSERT INTO products (id, name, categoryId, unit, standardPackageSize, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [product.id, product.name, product.categoryId, product.unit ?? null, product.standardPackageSize ?? null, product.createdAt, product.updatedAt]);
        }
        for (const list of tables.lists || []) {
          await db.runAsync('INSERT INTO lists (id, name, "order") VALUES (?, ?, ?)',
            [list.id, list.name, list.order]);
        }
        for (const item of tables.inventory_items || []) {
          await db.runAsync('INSERT INTO inventory_items (id, listId, productId, quantity, sortOrder, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [item.id, item.listId, item.productId, item.quantity, item.sortOrder, item.notes, item.createdAt, item.updatedAt]);
        }
        for (const history of tables.inventory_history || []) {
          await db.runAsync('INSERT INTO inventory_history (id, inventoryItemId, quantity, date, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [history.id, history.inventoryItemId, history.quantity, history.date, history.notes, history.createdAt]);
        }
        for (const sli of tables.shopping_list_items || []) {
          await db.runAsync('INSERT INTO shopping_list_items (id, inventoryItemId, quantity, checked, price, packageSize, sortOrder, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sli.id, sli.inventoryItemId, sli.quantity, sli.checked, sli.price, sli.packageSize ?? null, sli.sortOrder, sli.notes, sli.createdAt, sli.updatedAt]);
        }
        for (const invoice of tables.invoices || []) {
          await db.runAsync('INSERT INTO invoices (id, storeId, listId, total, createdAt) VALUES (?, ?, ?, ?, ?)',
            [invoice.id, invoice.storeId, invoice.listId, invoice.total, invoice.createdAt]);
        }
        for (const ii of tables.invoice_items || []) {
          await db.runAsync('INSERT INTO invoice_items (id, invoiceId, productId, quantity, unitPrice, lineTotal, packageSize, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ii.id, ii.invoiceId, ii.productId, ii.quantity, ii.unitPrice, ii.lineTotal, ii.packageSize ?? null, ii.createdAt]);
        }
        for (const psp of tables.product_store_prices || []) {
          await db.runAsync('INSERT INTO product_store_prices (productId, storeId, price, packageSize, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [psp.productId, psp.storeId, psp.price, psp.packageSize ?? null, psp.updatedAt]);
        }
        for (const pbp of tables.product_base_prices || []) {
          await db.runAsync('INSERT INTO product_base_prices (productId, price, packageSize, updatedAt) VALUES (?, ?, ?, ?)',
            [pbp.productId, pbp.price, pbp.packageSize ?? null, pbp.updatedAt]);
        }
        for (const setting of tables.settings || []) {
          await db.runAsync('INSERT INTO settings (id, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [setting.id, setting.key, setting.value, setting.createdAt, setting.updatedAt]);
        }
      });
      Alert.alert('Sucesso', 'Dados importados com sucesso!', [
        { text: 'OK', onPress: () => navigation.navigate('Lists') }
      ]);
      setImportData(null);
      setConfirmEnabled(false);
      setConfirmTimer(3);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao importar dados.');
    } finally {
      await db.runAsync('PRAGMA foreign_keys = ON');
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      setResetDialogVisible(false);
      const db = getDb();
      await db.withTransactionAsync(async () => {
        await db.runAsync('PRAGMA foreign_keys = OFF');
        await db.runAsync('DELETE FROM invoice_items');
        await db.runAsync('DELETE FROM invoices');
        await db.runAsync('DELETE FROM shopping_list_items');
        await db.runAsync('DELETE FROM inventory_history');
        await db.runAsync('DELETE FROM inventory_items');
        await db.runAsync('DELETE FROM product_store_prices');
        await db.runAsync('DELETE FROM product_base_prices');
        await db.runAsync('DELETE FROM products');
        await db.runAsync('DELETE FROM categories');
        await db.runAsync('DELETE FROM stores');
        await db.runAsync('DELETE FROM lists');
        await db.runAsync('DELETE FROM settings');
      });
      Alert.alert('Sucesso', 'Todos os dados foram apagados!');
      setResetEnabled(false);
      setResetTimer(3);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao resetar dados');
    } finally {
      const db = getDb();
      await db.runAsync('PRAGMA foreign_keys = ON');
      setLoading(false);
    }
  };

  // ─── List import summary modal adapter ────────────────────────────────────
  const listImportSummaryResults = engine.summaryResult ? [
    ...engine.summaryResult.productsMatched.map(p => ({
      originalName: p.oldName,
      quantity: 1,
      outcome: 'exact' as const,
      matchedName: p.newName === p.oldName ? undefined : p.newName,
      quantityExtracted: true,
      importDate: null,
    })),
    ...engine.summaryResult.productsCreated.map(name => ({
      originalName: name,
      quantity: 1,
      outcome: 'created' as const,
      quantityExtracted: true,
      importDate: null,
    })),
  ] : [];
  
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

        {/* ── List Export ──────────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Compartilhar Lista</Text>
            <Text style={styles.description}>
              Exporte uma lista para compartilhar com outra pessoa. Os dados existentes dela não serão apagados.
            </Text>
            <Button
              mode="contained"
              onPress={() => setListPickerVisible(true)}
              icon="share-variant"
              style={styles.button}
            >
              Escolher lista para compartilhar
            </Button>
          </Card.Content>
        </Card>

        {/* ── List Import ──────────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Importar Lista</Text>
            <Text style={styles.description}>
              Importe uma lista recebida. Seus dados existentes não serão apagados.
            </Text>
            <Button
              mode="outlined"
              onPress={handleSelectListFile}
              icon="folder-open"
              style={styles.button}
            >
              Selecionar arquivo de lista
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* ── Full Backup Export ───────────────────────────────────────────── */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Exportar Backup Completo</Text>
            <Text style={styles.description}>
              Exporta todos os seus dados. Use para fazer backup ou migrar para outro dispositivo.
            </Text>
            <Button mode="contained" onPress={handleSaveToDevice} icon="download" style={styles.button}>
              Salvar no dispositivo
            </Button>
            <Button mode="outlined" onPress={handleShare} icon="share-variant" style={styles.shareButton}>
              Compartilhar
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* ── Full Backup Import ───────────────────────────────────────────── */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Importar Backup Completo</Text>
            <Text style={[styles.warning]}>
              ⚠️ ATENÇÃO: Isso substituirá TODOS os dados existentes!
            </Text>
            <Button mode="outlined" onPress={handleSelectBackupFile} icon="folder-open" style={styles.selectFileButton}>
              Selecionar arquivo de backup
            </Button>
            {importData && (
              <Text style={styles.selectedFileText}>
                Arquivo selecionado:{'\n'}{importFileName ?? 'arquivo.json'}
              </Text>
            )}
            <Button
              mode="contained"
              onPress={() => {
                setConfirmEnabled(false);
                setConfirmTimer(3);
                setImportDialogVisible(true);
              }}
              icon="cloud-download"
              style={styles.button}
              disabled={!importData}
            >
              Importar
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        {/* ── Reset ───────────────────────────────────────────────────────── */}
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

      {/* List picker for export */}
      <ItemPickerDialog
        visible={listPickerVisible}
        onDismiss={() => setListPickerVisible(false)}
        items={lists}
        selectedId={null}
        onSelect={(id) => {
          setListPickerVisible(false);
          handleListExport(id);
        }}
        title="Escolher lista para exportar"
      />

      {/* List import confirmation modal */}
      {engine.confirmationVisible && engine.currentMatchItem && (
        <ConfirmationModal
          visible={engine.confirmationVisible}
          currentImportItem={{
            importedProduct: {
              originalName: engine.currentMatchItem.pending.name,
              quantity: 1,
            },
            bestMatch: {
              productId: engine.currentMatchItem.bestMatch.productId,
              productName: engine.currentMatchItem.bestMatch.productName,
              inventoryItemId: null,
              score: engine.currentMatchItem.bestMatch.score,
              source: 'global',
            },
            similarCandidates: engine.currentMatchItem.allCandidates.map(c => ({
              productId: c.productId,
              productName: c.productName,
              inventoryItemId: null,
              score: c.score,
              source: 'global' as const,
            })),
            remainingProducts: engine.currentMatchItem.remaining.map(p => ({
              originalName: p.name,
              quantity: 1,
            })),
            importDate: null,
          }}
          progress={engine.progress ? {
            current: engine.progress.current,
            total: engine.progress.total,
            imported: engine.progress.current - 1,
          } : null}
          onAcceptAllSuggestions={engine.handleAcceptAll}
          onAddToExisting={engine.handleUseExisting}
          onCreateNew={engine.handleCreateNew}
          onSkipImport={engine.handleCancel}
          onCancelAllImports={engine.handleCancel}
          onUpdateCurrentItem={(item) => {
            engine.setCurrentMatchItem({
              ...engine.currentMatchItem!,
              bestMatch: {
                productId: item.bestMatch.productId,
                productName: item.bestMatch.productName,
                score: item.bestMatch.score,
              },
              allCandidates: item.similarCandidates.map(c => ({
                productId: c.productId,
                productName: c.productName,
                score: c.score,
              })),
            });
          }}
        />
      )}

      {/* List import summary */}
      <ImportSummaryModal
        visible={engine.summaryVisible}
        results={listImportSummaryResults}
        onDismiss={() => {
          engine.setSummaryVisible(false);
          navigation.navigate('Lists');
        }}
      />

      {/* Full backup import confirmation */}
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

      {/* Reset confirmation */}
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
  container: { flex: 1 },
  scrollView: { flex: 1, padding: 16 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: { marginBottom: 16, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  description: { fontSize: 14, color: '#666', marginBottom: 16 },
  warning: { fontSize: 14, color: '#FF9800', fontWeight: '600', marginBottom: 16 },
  selectFileButton: { marginBottom: 16 },
  selectedFileText: { fontSize: 14, color: '#666', marginBottom: 16, fontStyle: 'italic' },
  shareButton: { marginTop: 8 },
  button: { marginTop: 8 },
  divider: { marginVertical: 16 },
  timerText: { fontSize: 12, color: '#999', marginTop: 12, fontStyle: 'italic' },
});