import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PriceHistoryItem {
  date: string;
  price: number;
  storeName: string;
}

interface PriceHistorySectionProps {
  priceHistory: PriceHistoryItem[];
  collapsed: boolean;
  onToggle: () => void;
  themeColors: {
    onSurfaceVariant: string;
    onSurface: string;
    outline: string;
    outlineVariant: string;
  };
}

export default function PriceHistorySection({
  priceHistory,
  collapsed,
  onToggle,
  themeColors,
}: PriceHistorySectionProps) {
  const formatFullDate = (d: string) => format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  return (
    <>
      <Pressable
        onPress={onToggle}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}
      >
        <Text variant="labelMedium" style={{
          color: themeColors.onSurfaceVariant,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          Histórico de Preços
        </Text>
        <MaterialCommunityIcons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color={themeColors.onSurfaceVariant}
        />
      </Pressable>
      {!collapsed && (
        <View>
          {priceHistory.length > 0 ? priceHistory.map((item, index) => (
            <View key={index} style={[localStyles.historyRow, { borderBottomColor: themeColors.outlineVariant }]}>
              <Text style={{ color: themeColors.onSurfaceVariant, fontSize: 13 }}>
                {formatFullDate(item.date)}
              </Text>
              <Text style={{ color: themeColors.onSurface, fontSize: 13 }}>
                {formatCurrency(item.price)}
              </Text>
              <Text style={{ color: themeColors.outline, fontSize: 12, fontStyle: 'italic' }}>
                {item.storeName || '—'}
              </Text>
            </View>
          )) : (
            <Text style={{ color: themeColors.outline, textAlign: 'center', marginVertical: 16 }}>
              Nenhum histórico de preços
            </Text>
          )}
        </View>
      )}
    </>
  );
}

const localStyles = StyleSheet.create({
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
});
