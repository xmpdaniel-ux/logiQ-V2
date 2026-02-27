import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BarChartProps {
  utilityScore: number;
  riskScore: number;
  utilityLabel: string;
  riskLabel: string;
  fduScore?: number; // FDU score to determine highlight
}

const BarChart: React.FC<BarChartProps> = ({
  utilityScore = 0,
  riskScore = 0,
  utilityLabel = '',
  riskLabel = '',
  fduScore = 0
}) => {
  // Protección contra valores undefined o NaN
  const safeUtility = typeof utilityScore === 'number' && !isNaN(utilityScore) ? utilityScore : 0;
  const safeRisk = typeof riskScore === 'number' && !isNaN(riskScore) ? riskScore : 0;
  const safeFdu = typeof fduScore === 'number' && !isNaN(fduScore) ? fduScore : 0;

  // Normalize utility to percentage (max expected ~100)
  const maxValue = 100;
  const utilityPercent = Math.min(Math.max((safeUtility / maxValue) * 100, 5), 100);

  // Risk bar: R2 * 10% to ensure always visible and proportional
  const riskPercent = Math.min(Math.max(safeRisk * 10, 10), 100);

  // Highlight utility bar if FDU > 30 (positive decision)
  const isHighFDU = safeFdu > 30;
  const utilityColor = isHighFDU ? '#2ECC71' : '#27AE60';

  return (
    <View style={styles.container}>
      {/* Utility Bar */}
      <View style={styles.barRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{utilityLabel}</Text>
          {isHighFDU && <Text style={styles.highlight}>✓ Recomendado</Text>}
        </View>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.bar,
              {
                width: `${utilityPercent}%`,
                backgroundColor: utilityColor,
              },
              isHighFDU && styles.highlightBar
            ]}
          />
          <Text style={[styles.value, utilityPercent > 70 && styles.valueLight]}>
            {typeof safeUtility === 'number' ? safeUtility.toFixed(1) : '0.0'}
          </Text>
        </View>
      </View>

      {/* Risk Bar */}
      <View style={styles.barRow}>
        <Text style={styles.label}>{riskLabel}</Text>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.bar,
              styles.riskBar,
              { width: `${riskPercent}%` }
            ]}
          />
          <Text style={[styles.value, riskPercent > 70 && styles.valueLight]}>
            {typeof safeRisk === 'number' ? safeRisk.toFixed(1) : '0.0'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    width: '100%',
    paddingHorizontal: 0,
  },
  barRow: {
    marginBottom: 16,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  highlight: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2ECC71',
  },
  barContainer: {
    height: 22,
    backgroundColor: '#E8E8E8',
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
  },
  bar: {
    position: 'absolute',
    left: 0,
    height: '100%',
    borderRadius: 11,
    minWidth: 20,
  },
  highlightBar: {
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  riskBar: {
    backgroundColor: '#E74C3C',
  },
  value: {
    position: 'absolute',
    right: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#2C3E50',
  },
  valueLight: {
    color: '#FFFFFF',
  },
});

export default BarChart;