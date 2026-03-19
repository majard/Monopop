import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Appbar, Card, Text, useTheme, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const version = Constants.expoConfig?.version ?? 'deu ruim';

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
              Monopop integra estoque e lista de compras em um único fluxo. O estoque
              informa o que você precisa comprar; as compras realizadas atualizam o
              estoque automaticamente. Com o uso, o app aprende os preços de cada
              produto em cada loja — sem nenhum esforço extra da sua parte. Com o
              tempo, você passa a saber onde cada produto sai mais barato, quanto está
              gastando por período e qual é o seu ritmo de consumo.{'\n\n'}
              Funciona 100% offline. Nenhum dado sai do seu dispositivo.
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Recursos</Text>
            {[
              'Múltiplas listas com estoques independentes',
              'Lista de compras com preço sugerido por loja',
              'Comparação de preços por unidade (g, ml, un) entre embalagens diferentes',
              'Aviso quando o preço atual supera sua melhor referência conhecida',
              'Menor preço dos últimos 90 dias por produto',
              'Consumo médio semanal calculado automaticamente',
              'Importação de lista via texto colado',
              'Compartilhamento e importação de listas via WhatsApp, Telegram ou qualquer app',
              'Mover itens entre listas com resolução de conflito',
              'Mensagem personalizada ao copiar o estoque',
              'Histórico de compras com nota por loja',
              'Análise de gastos e tendência vs período anterior',
              'Histórico de quantidade em estoque ao longo do tempo',
              'Categorias colapsáveis por corredor',
              'Reordenação por arrastar',
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
            <Text variant="titleMedium" style={styles.sectionTitle}>Privacidade</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              Nenhum dado é coletado ou transmitido. Tudo fica armazenado
              localmente no seu dispositivo.
            </Text>
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
          style={styles.card}
          onPress={() => Linking.openURL('https://github.com/majard/listai/issues')}
        >
          <Card.Content style={styles.linkContent}>
            <MaterialCommunityIcons
              name="message-outline"
              size={24}
              color={theme.colors.onSurface}
            />
            <Text variant="bodyMedium" style={[styles.linkText, { color: theme.colors.onSurface }]}>
              Enviar feedback
            </Text>
            <MaterialCommunityIcons
              name="open-in-new"
              size={16}
              color={theme.colors.onSurfaceVariant}
            />
          </Card.Content>
        </Card>

        <Card
          style={styles.card}
          onPress={() => Linking.openURL('https://github.com/majard/listai')}
        >
          <Card.Content style={styles.linkContent}>
            <MaterialCommunityIcons
              name="github"
              size={24}
              color={theme.colors.onSurface}
            />
            <Text variant="bodyMedium" style={[styles.linkText, { color: theme.colors.onSurface }]}>
              Ver no GitHub
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
  linkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkText: {
    flex: 1,
  },
  divider: { marginVertical: 24 },
  copyright: {
    textAlign: 'center',
    marginBottom: 8,
  },
});