import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Appbar, Card, Text, useTheme, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const version = Constants.expoConfig?.version ?? '1.5';

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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <MaterialCommunityIcons
            name="cart-outline"
            size={64}
            color={theme.colors.primary}
          />
          <Text variant="headlineMedium" style={styles.appName}>Monopop</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            v{version}
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>O que é</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              Monopop é um gerenciador de estoque e lista de compras offline, pensado para
              uso profissional no dia a dia. Funciona sem internet, com todos os dados
              armazenados localmente no dispositivo.
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Recursos</Text>
            {[
              'Múltiplas listas de produtos',
              'Controle de estoque com histórico de quantidades',
              'Lista de compras com rastreamento de preços',
              'Importação de lista via texto',
              'Histórico de compras com invoices por loja',
              'Análise de gastos e tendências',
              'Categorias personalizáveis',
              'Backup e restauração',
              '100% offline',
            ].map((item) => (
              <View key={item} style={styles.listItem}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={16}
                  color={theme.colors.primary}
                  style={styles.listIcon}
                />
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
                  {item}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Desenvolvedor</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              Mah Jardim
            </Text>
          </Card.Content>
        </Card>

        <Card
          style={[styles.card, styles.githubCard]}
          onPress={() => Linking.openURL('https://github.com/mahjard/monopop')}
        >
          <Card.Content style={styles.githubContent}>
            <MaterialCommunityIcons
              name="github"
              size={24}
              color={theme.colors.onSurface}
            />
            <Text variant="bodyMedium" style={[styles.githubText, { color: theme.colors.onSurface }]}>
              Código-fonte no GitHub
            </Text>
            <MaterialCommunityIcons
              name="open-in-new"
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        <Text
          variant="bodySmall"
          style={[styles.copyright, { color: theme.colors.onSurfaceVariant }]}
        >
          © 2026 Monopop. Todos os direitos reservados.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
    gap: 8,
  },
  appName: {
    fontWeight: 'bold',
    marginTop: 8,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  listIcon: {
    marginTop: 2,
  },
  githubCard: {
    marginBottom: 8,
  },
  githubContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  githubText: {
    flex: 1,
  },
  divider: { marginVertical: 24 },
  copyright: {
    textAlign: 'center',
    marginBottom: 8,
  },
});