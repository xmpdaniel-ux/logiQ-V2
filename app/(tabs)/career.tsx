import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalculatorForm from '../../components/CalculatorForm';

export default function CareerScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <CalculatorForm category="career" titleKey="P_TITULO_CAR" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF0F1',
  },
});