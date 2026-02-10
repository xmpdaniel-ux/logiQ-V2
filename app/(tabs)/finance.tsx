import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import CalculatorForm from '../../components/CalculatorForm';

export default function FinanceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <CalculatorForm category="finance" titleKey="P_TITULO_FIN" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF0F1',
  },
});