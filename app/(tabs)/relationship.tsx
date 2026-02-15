import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalculatorForm from '../../components/CalculatorForm';

export default function RelationshipScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <CalculatorForm category="relationship" titleKey="P_TITULO_REL" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF0F1',
  },
});