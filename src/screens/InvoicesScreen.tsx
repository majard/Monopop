import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Appbar, Card, Text, useTheme, Searchbar, Button, Dialog, Portal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllInvoices, deleteInvoice } from '../database/database';
import { useFocusEffect } from '@react-navigation/native';

type InvoicesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Invoices'>;

interface Invoice {
  id: number;
  storeName: string;
  listName: string;
  total: number;
  createdAt: string;
}

export default function InvoicesScreen() {
  const navigation = useNavigation<InvoicesScreenNavigationProp>();
  const theme = useTheme();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const loadInvoices = async () => {
    try {
      const data = await getAllInvoices();
      setInvoices(data);
      filterInvoices(data, searchQuery);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const filterInvoices = (data: Invoice[], query: string) => {
    if (!query.trim()) {
      setFilteredInvoices(data);
      return;
    }
    const searchLower = query.toLowerCase();
    const filtered = data.filter(
      invoice =>
        invoice.storeName.toLowerCase().includes(searchLower) ||
        invoice.listName.toLowerCase().includes(searchLower)
    );
    setFilteredInvoices(filtered);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    filterInvoices(invoices, query);
  };

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [])
  );

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const confirmDelete = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDeleteDialogVisible(true);
  };

  const handleDelete = async () => {
    if (!selectedInvoice) return;
    try {
      await deleteInvoice(selectedInvoice.id);
      await loadInvoices();
      setDeleteDialogVisible(false);
      setSelectedInvoice(null);
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const renderInvoice = ({ item }: { item: Invoice }) => (
    <Card style={styles.invoiceCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
      >
        <Card.Content>
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={styles.storeName}>{item.storeName}</Text>
              <Text style={styles.listName}>Lista: {item.listName}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={styles.totalContainer}>
              <Text style={styles.total}>{formatCurrency(item.total)}</Text>
            </View>
          </View>
        </Card.Content>
      </TouchableOpacity>
      <Card.Actions>
        <Button onPress={() => confirmDelete(item)} textColor={theme.colors.error}>
          Excluir
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.navigate('Config')} />
        <Appbar.Content title="Compras" />
      </Appbar.Header>

      <Searchbar
        placeholder="Buscar por loja ou lista..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchBar}
      />

      {filteredInvoices.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Nenhuma compra registrada</Text>
        </View>
      ) : (
        <FlatList
          data={filteredInvoices}
          renderItem={renderInvoice}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Confirmar Exclusão</Dialog.Title>
          <Dialog.Content>
            <Text>
              Atenção: Ao excluir esta compra, o estoque NÃO será revertido. Deseja continuar?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancelar</Button>
            <Button onPress={handleDelete} textColor={theme.colors.error}>
              Excluir
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
  searchBar: {
    margin: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  invoiceCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  totalContainer: {
    alignItems: 'flex-end',
  },
  total: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
