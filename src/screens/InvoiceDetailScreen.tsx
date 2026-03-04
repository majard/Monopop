import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Appbar, Card, Text, useTheme, Button, Divider } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getInvoiceDetails } from '../database/database';

type InvoiceDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'InvoiceDetail'>;
type InvoiceDetailScreenRouteProp = RouteProp<RootStackParamList, 'InvoiceDetail'>;

interface InvoiceItem {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
}

interface Invoice {
  id: number;
  storeName: string;
  listName: string;
  total: number;
  createdAt: string;
}

export default function InvoiceDetailScreen() {
  const navigation = useNavigation<InvoiceDetailScreenNavigationProp>();
  const route = useRoute<InvoiceDetailScreenRouteProp>();
  const theme = useTheme();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvoiceDetails = async () => {
    try {
      const { invoice: invoiceData, items: itemsData } = await getInvoiceDetails(route.params.invoiceId);
      setInvoice(invoiceData);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading invoice details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoiceDetails();
  }, [route.params.invoiceId]);

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderItem = ({ item }: { item: InvoiceItem }) => (
    <Card style={styles.itemCard}>
      <Card.Content>
        <View style={styles.itemRow}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.productName}</Text>
            <Text style={styles.itemDetail}>
              {item.quantity}x {item.unitPrice ? formatCurrency(item.unitPrice) : 'Preço não informado'}
            </Text>
          </View>
          <Text style={styles.itemTotal}>{formatCurrency(item.lineTotal)}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.navigate('Invoices')} />
          <Appbar.Content title="Detalhes da Compra" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.navigate('Invoices')} />
          <Appbar.Content title="Detalhes da Compra" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <Text>Compra não encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.navigate('Invoices')} />
        <Appbar.Content title="Detalhes da Compra" />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text style={styles.storeName}>{invoice.storeName}</Text>
            <Text style={styles.listName}>Lista: {invoice.listName}</Text>
            <Text style={styles.date}>{formatDate(invoice.createdAt)}</Text>
            <Divider style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.total)}</Text>
            </View>
          </Card.Content>
        </Card>

        <Text style={styles.itemsTitle}>Itens ({items.length})</Text>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          contentContainerStyle={styles.itemsList}
        />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  storeName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  listName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  itemsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  itemsList: {
    paddingBottom: 32,
  },
  itemCard: {
    marginBottom: 8,
    borderRadius: 8,
    elevation: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
