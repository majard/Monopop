import React from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { InventoryHistory } from '../database/models';

interface QuantityHistorySectionProps {
  history: InventoryHistory[];
  collapsed: boolean;
  onToggle: () => void;
  chartData: { labels: string[]; datasets: { data: number[] }[] };
  themeColors: {
    onSurfaceVariant: string;
    onSurface: string;
    outline: string;
    outlineVariant: string;
    error: string;
    primary: string;
    surface: string;
  };
}

export default function QuantityHistorySection({
  history,
  collapsed,
  onToggle,
  chartData,
  themeColors,
}: QuantityHistorySectionProps) {
  const formatDate = (d: string) => format(parseISO(d.includes('T') ? d : d + 'T00:00:00'), 'dd/MM', { locale: ptBR });

  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '0, 0, 0';
  };

  const chartConfig = {
    backgroundColor: themeColors.surface,
    backgroundGradientFrom: themeColors.surface,
    backgroundGradientTo: themeColors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(${hexToRgb(themeColors.primary)}, ${opacity})`,
    labelColor: () => themeColors.onSurfaceVariant,
    propsForDots: { r: '4', strokeWidth: '2', stroke: themeColors.primary },
  };
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
          Histórico de Quantidades
        </Text>
        <MaterialCommunityIcons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color={themeColors.onSurfaceVariant}
        />
      </Pressable>
      {!collapsed && history.length > 1 && (
        <>
          <LineChart
            data={chartData}
            width={Dimensions.get('window').width - 32}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: 8, marginBottom: 12 }}
          />
          {history.map((item, index) => {
            const next = history[index + 1];
            const diff = next ? item.quantity - next.quantity : null;
            return (
              <View key={item.id} style={[localStyles.historyRow, { borderBottomColor: themeColors.outlineVariant }]}>
                <Text style={{ color: themeColors.onSurfaceVariant, fontSize: 13 }}>
                  {formatDate(item.date)}
                </Text>
                <Text style={{ color: themeColors.onSurface, fontSize: 13, fontWeight: '500' }}>
                  {item.quantity}
                </Text>
                {diff !== null && (
                  <Text style={{
                    fontSize: 12,
                    color: diff > 0 ? themeColors.error : diff < 0 ? '#4CAF50' : themeColors.outline,
                    fontWeight: '600',
                  }}>
                    {diff > 0 ? `-${diff}` : diff < 0 ? `+${Math.abs(diff)}` : '—'}
                  </Text>
                )}
                {item.notes ? (
                  <Text style={{ color: themeColors.outline, fontSize: 11, fontStyle: 'italic', flex: 1, textAlign: 'right' }}>
                    {item.notes}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </>
      )}
      {!collapsed && history.length <= 1 && (
        <Text style={{ color: themeColors.outline, textAlign: 'center', marginVertical: 16 }}>
          Histórico insuficiente
        </Text>
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
