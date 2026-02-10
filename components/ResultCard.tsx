import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FDUResult } from '../types';
import BarChart from './BarChart';

interface ResultCardProps {
  result: FDUResult;
  category: 'business' | 'career' | 'relationship' | 'finance';
}

const ResultCard: React.FC<ResultCardProps> = ({ result, category }) => {
  const { t } = useTranslation();
  
  // Si result es null o undefined, no renderizar nada
  if (!result) {
    return null;
  }
  
  // Protección contra valores undefined
  const safeScore = typeof result.score === 'number' ? result.score : 0;
  const safeStatus = result.status || 'yellow';
  const safeUtilityScore = typeof result.utilityScore === 'number' ? result.utilityScore : 0;
  const safeRiskScore = typeof result.riskScore === 'number' ? result.riskScore : 0;
  
  // Get empathetic message based on category and status
  const getEmphaticMessage = () => {
    const categoryMap: Record<string, string> = {
      'business': 'NEG',
      'career': 'CAR', 
      'relationship': 'REL',
      'finance': 'FIN'
    };
    const suffix = categoryMap[category] || 'NEG';
    const statusUpper = (safeStatus || 'yellow').toUpperCase();
    return t(`STATUS_${statusUpper}_${suffix}`);
  };
  
  // Get adaptive labels
  const getUtilityLabel = () => {
    if (category === 'relationship') return t('LABEL_UTILITY_REL');
    if (category === 'career') return t('LABEL_UTILITY_CAR');
    if (category === 'finance') return t('LABEL_UTILITY_FIN');
    return t('RESULT_UTILITY');
  };
  
  const getRiskLabel = () => {
    if (category === 'finance') return t('LABEL_RISK_FIN');
    if (category === 'relationship') return t('LABEL_COST_REL');
    return t('RESULT_RISK');
  };

  const getStatusColor = () => {
    switch (safeStatus) {
      case 'green':
        return '#27AE60';
      case 'yellow':
        return '#F39C12';
      case 'red':
        return '#E74C3C';
      default:
        return '#95A5A6';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreLabel}>{t('RESULT_SCORE')}</Text>
        <Text style={[styles.scoreValue, { color: getStatusColor() }]}>
          {safeScore.toFixed(1)}
        </Text>
      </View>

      <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.statusText}>{getEmphaticMessage()}</Text>
      </View>

      <BarChart
        utilityScore={safeUtilityScore}
        riskScore={safeRiskScore}
        utilityLabel={getUtilityLabel()}
        riskLabel={getRiskLabel()}
        fduScore={safeScore}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 10,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 16,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ResultCard;