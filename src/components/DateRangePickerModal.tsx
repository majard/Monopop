// src/components/DateRangePickerModal.tsx — create new file

import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { Text, Button, Surface, useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, addMonths,
  subMonths, isSameDay, isWithinInterval, isAfter, isBefore,
  startOfWeek, endOfWeek, isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangePickerModalProps {
  visible: boolean;
  value: DateRange;
  onConfirm: (range: DateRange) => void;
  onDismiss: () => void;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function DateRangePickerModal({ visible, value, onConfirm, onDismiss }: DateRangePickerModalProps) {
  const theme = useTheme();
  const [month, setMonth] = useState(new Date());
  const [selecting, setSelecting] = useState<DateRange>(value);
  const [step, setStep] = useState<'start' | 'end'>('start');

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  const handleDayPress = (day: Date) => {
    if (step === 'start') {
      setSelecting({ start: day, end: null });
      setStep('end');
    } else {
      if (selecting.start && isBefore(day, selecting.start)) {
        setSelecting({ start: day, end: selecting.start });
      } else {
        setSelecting({ ...selecting, end: day });
      }
      setStep('start');
    }
  };

  const getDayStyle = (day: Date) => {
    const { start, end } = selecting;
    const isStart = start && isSameDay(day, start);
    const isEnd = end && isSameDay(day, end);
    const inRange = start && end && isWithinInterval(day, { start, end });
    return { isStart, isEnd, inRange, isToday: isSameDay(day, new Date()) };
  };

  const handleConfirm = () => {
    if (selecting.start) onConfirm(selecting);
  };

  const handleClear = () => {
    setSelecting({ start: null, end: null });
    setStep('start');
    onConfirm({ start: null, end: null });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={localStyles.backdrop} onPress={onDismiss}>
        <Pressable>
          <Surface style={[localStyles.sheet, { backgroundColor: theme.colors.surface }]}>

            {/* Header */}
            <View style={localStyles.header}>
              <Text style={[localStyles.headerTitle, { color: theme.colors.onSurface }]}>
                {step === 'start' ? 'Selecione a data inicial' : 'Selecione a data final'}
              </Text>
            </View>

            {/* Selected range display */}
            <View style={[localStyles.rangeRow, { borderColor: theme.colors.outlineVariant }]}>
              <View style={[localStyles.rangeItem, selecting.start && { borderColor: theme.colors.primary }]}>
                <Text style={[localStyles.rangeLabel, { color: theme.colors.onSurfaceVariant }]}>De</Text>
                <Text style={[localStyles.rangeValue, { color: selecting.start ? theme.colors.primary : theme.colors.outline }]}>
                  {selecting.start ? format(selecting.start, 'dd/MM/yyyy') : '—'}
                </Text>
              </View>
              <MaterialCommunityIcons name="arrow-right" size={16} color={theme.colors.outline} />
              <View style={[localStyles.rangeItem, selecting.end && { borderColor: theme.colors.primary }]}>
                <Text style={[localStyles.rangeLabel, { color: theme.colors.onSurfaceVariant }]}>Até</Text>
                <Text style={[localStyles.rangeValue, { color: selecting.end ? theme.colors.primary : theme.colors.outline }]}>
                  {selecting.end ? format(selecting.end, 'dd/MM/yyyy') : '—'}
                </Text>
              </View>
            </View>

            {/* Month navigation */}
            <View style={localStyles.monthNav}>
              <IconButton icon="chevron-left" size={20} onPress={() => setMonth(m => subMonths(m, 1))} />
              <Text style={[localStyles.monthLabel, { color: theme.colors.onSurface }]}>
                {format(month, 'MMMM yyyy', { locale: ptBR })}
              </Text>
              <IconButton icon="chevron-right" size={20} onPress={() => setMonth(m => addMonths(m, 1))} />
            </View>

            {/* Weekday headers */}
            <View style={localStyles.weekdayRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={[localStyles.weekday, { color: theme.colors.onSurfaceVariant }]}>{d}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={localStyles.grid}>
              {days.map((day, i) => {
                const { isStart, isEnd, inRange, isToday } = getDayStyle(day);
                const isCurrentMonth = isSameMonth(day, month);
                const isSelected = isStart || isEnd;

                return (
                  <Pressable
                    key={i}
                    onPress={() => isCurrentMonth && handleDayPress(day)}
                    style={[
                      localStyles.dayCell,
                      inRange && { backgroundColor: theme.colors.primaryContainer },
                      isSelected && { backgroundColor: theme.colors.primary, borderRadius: 20 },
                    ]}
                  >
                    <Text style={[
                      localStyles.dayText,
                      { color: isCurrentMonth ? theme.colors.onSurface : theme.colors.outline },
                      isSelected && { color: theme.colors.onPrimary, fontWeight: 'bold' },
                      isToday && !isSelected && { color: theme.colors.primary, fontWeight: '600' },
                    ]}>
                      {format(day, 'd')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Shortcut chips */}
            <View style={localStyles.shortcuts}>
              {[
                { label: 'Esta semana', fn: () => setSelecting({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) }) },
                { label: 'Este mês', fn: () => setSelecting({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
                { label: 'Últimos 30d', fn: () => setSelecting({ start: subMonths(new Date(), 1), end: new Date() }) },
                { label: 'Últimos 90d', fn: () => setSelecting({ start: subMonths(new Date(), 3), end: new Date() }) },
              ].map(({ label, fn }) => (
                <Pressable
                  key={label}
                  onPress={() => { fn(); setStep('start'); }}
                  style={[localStyles.shortcut, { borderColor: theme.colors.outline }]}
                >
                  <Text style={[localStyles.shortcutText, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Actions */}
            <View style={localStyles.actions}>
              <Button onPress={handleClear} textColor={theme.colors.onSurfaceVariant}>Limpar</Button>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button onPress={onDismiss}>Cancelar</Button>
                <Button
                  mode="contained"
                  onPress={handleConfirm}
                  disabled={!selecting.start}
                >
                  Aplicar
                </Button>
              </View>
            </View>

          </Surface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    borderRadius: 16,
    padding: 16,
    width: 340,
    elevation: 8,
  },
  header: { marginBottom: 12 },
  headerTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    gap: 8,
  },
  rangeItem: {
    flex: 1,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: 'transparent',
    paddingBottom: 4,
  },
  rangeLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  rangeValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthLabel: { fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 13 },
  shortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    marginBottom: 4,
  },
  shortcut: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  shortcutText: { fontSize: 12 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
});