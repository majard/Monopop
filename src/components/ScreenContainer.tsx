import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  withBottomInset?: boolean; // Útil para desativar se a tela tiver abas
}

export const ScreenContainer = ({ children, style, withBottomInset = true }: Props) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
        paddingBottom: withBottomInset ? insets.bottom : 0,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      },
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});