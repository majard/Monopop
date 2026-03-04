import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Appbar, Card, Text, useTheme, Divider, Avatar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';

type AboutScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'About'>;

export default function AboutScreen() {
  const navigation = useNavigation<AboutScreenNavigationProp>();
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.navigate('Config')} />
        <Appbar.Content title="Sobre" />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Avatar.Icon
            size={80}
            icon="cart"
            style={{ backgroundColor: theme.colors.primary }}
          />
          <Text style={styles.appName}>Listai</Text>
          <Text style={styles.version}>Versão 1.5</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Desenvolvedor</Text>
            <Text style={styles.text}>Mah Jardim</Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Sobre o App</Text>
            <Text style={styles.text}>
              Listai é um aplicativo de gerenciamento de estoque e listas de compras.
              Organize seus produtos, acompanhe seu estoque e gerencie suas compras de forma simples e eficiente.
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Recursos</Text>
            <Text style={styles.listItem}>• Múltiplas listas de produtos</Text>
            <Text style={styles.listItem}>• Controle de estoque</Text>
            <Text style={styles.listItem}>• Lista de compras integrada</Text>
            <Text style={styles.listItem}>• Histórico de compras</Text>
            <Text style={styles.listItem}>• Categorias personalizáveis</Text>
            <Text style={styles.listItem}>• Backup e restauração</Text>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        <Text style={styles.copyright}>
          © 2026 Monopop. Todos os direitos reservados.
        </Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
  },
  version: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
  },
  listItem: {
    fontSize: 14,
    lineHeight: 24,
    color: '#333',
  },
  divider: {
    marginVertical: 24,
  },
  copyright: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
});
