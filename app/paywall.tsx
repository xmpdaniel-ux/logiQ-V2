/* --- LOGIQ PAYWALL ESTRATÉGICO v2.0 --- */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePremium } from '../contexts/PremiumContext';

const { width } = Dimensions.get('window');

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { handlePurchaseSuccess, deviceId } = usePremium();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('fdu_monthly'); // Default al de $5 para entrada rápida

  const plans = [
    { id: 'fdu_monthly', title: t('PRICE_MONTH'), price: '$5.00', period: t('PER_MONTH'), savings: null },
    { id: 'fdu_yearly', title: t('PRICE_YEAR'), price: '$45.00', period: t('PER_YEAR'), savings: t('PRICE_YEAR_SAVE'), popular: true },
    { id: 'fdu_6months', title: t('PRICE_6M'), price: '$25.00', period: t('PER_6M'), savings: t('PRICE_6M_SAVE') },
  ];

  const handlePurchase = async (productId: string) => {
    setLoading(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://tu-backend.railway.app';
      const response = await fetch(`${backendUrl}/api/user/verify-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId || `temp_${Date.now()}`,
          product_id: productId,
          purchase_token: `simulated_${Date.now()}`
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          handlePurchaseSuccess();
          Alert.alert(t('SUCCESS'), t('WELCOME_PREMIUM'), [{ text: 'OK', onPress: () => router.back() }]);
        } else {
          Alert.alert('Error', t('PURCHASE_FAILED'));
        }
      }
    } catch (error) {
      Alert.alert('Error', t('CONNECTION_ERROR'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>

        {/* HEADER ESTRATÉGICO */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color="#95A5A6" />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Ionicons name="shield-checkmark" size={50} color="#F1C40F" />
          </View>
          <Text style={styles.title}>{t('UPGRADE_TITLE_PRO') || 'LogiQ Pro'}</Text>
          <Text style={styles.subtitle}>{t('MSG_PREMIUM_CALL_PRO') || 'Toma decisiones con la seguridad de un experto'}</Text>
        </View>

        {/* COMPARATIVA DE VALOR (GRATIS VS PRO) */}
        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>{t('BENEFITS_INCLUDED') || 'Tu Consultoría Integral'}</Text>

          <View style={styles.benefitRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTextMain}>{t('BENEFIT_CHAT_PRO') || 'Consultoría IA Ilimitada'}</Text>
              <Text style={styles.benefitTextSub}>{t('BENEFIT_CHAT_SUB') || 'Chat estratégico sin límites de mensajes'}</Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="analytics" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTextMain}>{t('BENEFIT_REPORTS_PRO') || 'Reportes de Riesgo Avanzados'}</Text>
              <Text style={styles.benefitTextSub}>{t('BENEFIT_REPORTS_SUB') || 'Análisis profundo de sesgos y costos hundidos'}</Text>
            </View>
          </View>

          <View style={styles.benefitRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="sync" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.benefitTextContainer}>
              <Text style={styles.benefitTextMain}>{t('BENEFIT_SYNC_PRO') || 'Sincronización Total'}</Text>
              <Text style={styles.benefitTextSub}>{t('BENEFIT_SYNC_SUB') || 'Tus decisiones seguras en todos tus dispositivos'}</Text>
            </View>
          </View>
        </View>

        {/* SELECTOR DE PLANES */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardSelected,
                plan.popular && styles.planCardPopular
              ]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>{t('BEST_VALUE')}</Text>
                </View>
              )}
              <View style={styles.planInfo}>
                <View style={[styles.radioButton, selectedPlan === plan.id && styles.radioButtonActive]}>
                  {selectedPlan === plan.id && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                {plan.savings && <Text style={styles.planSavings}>{plan.savings}</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ACCIÓN Y CIERRE */}
        <View style={styles.footer}>
          <View style={styles.socialProof}>
            <Ionicons name="people" size={16} color="#27AE60" />
            <Text style={styles.socialProofText}>{t('USERS_JOINED')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, loading && styles.subscribeButtonDisabled]}
            onPress={() => handlePurchase(selectedPlan)}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.subscribeButtonText}>{t('BTN_START_PRO') || 'Comenzar ahora'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.restoreButton} onPress={() => Alert.alert('Info', 'Restoring...')}>
            <Text style={styles.restoreButtonText}>{t('BTN_RESTORE') || 'Restaurar Compra'}</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>{t('PREMIUM_DISCLAIMER')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F8' },
  container: { flex: 1 },
  contentContainer: { padding: 20 },
  backButton: { position: 'absolute', left: 0, top: 0, padding: 10, zIndex: 10 },
  header: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  logoContainer: {
    backgroundColor: '#FFFFFF', width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center', marginBottom: 15,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
  },
  title: { fontSize: 28, fontWeight: '900', color: '#2C3E50', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#7F8C8D', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },

  benefitsContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, marginBottom: 25, elevation: 2 },
  benefitsTitle: { fontSize: 14, fontWeight: 'bold', color: '#BDC3C7', textTransform: 'uppercase', marginBottom: 20, letterSpacing: 1 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2C3E50', alignItems: 'center', justifyContent: 'center' },
  benefitTextContainer: { marginLeft: 15, flex: 1 },
  benefitTextMain: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50' },
  benefitTextSub: { fontSize: 13, color: '#95A5A6' },

  plansContainer: { marginBottom: 20 },
  planCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: '#E0E0E0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  planCardSelected: { borderColor: '#3498DB', backgroundColor: '#F0F9FF' },
  planCardPopular: { borderColor: '#F1C40F' },
  planInfo: { flexDirection: 'row', alignItems: 'center' },
  radioButton: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#BDC3C7', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioButtonActive: { borderColor: '#3498DB' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3498DB' },
  planTitle: { fontSize: 16, fontWeight: 'bold', color: '#2C3E50' },
  planPeriod: { fontSize: 12, color: '#95A5A6' },
  priceContainer: { alignItems: 'flex-end' },
  planPrice: { fontSize: 20, fontWeight: '900', color: '#2C3E50' },
  planSavings: { fontSize: 11, color: '#27AE60', fontWeight: 'bold', marginTop: 2 },
  popularBadge: { position: 'absolute', top: -12, right: 20, backgroundColor: '#F1C40F', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  popularText: { color: '#2C3E50', fontSize: 10, fontWeight: '900' },

  footer: { alignItems: 'center', marginTop: 10 },
  socialProof: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#E8F8F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  socialProofText: { fontSize: 12, color: '#27AE60', fontWeight: 'bold', marginLeft: 6 },
  subscribeButton: { backgroundColor: '#2C3E50', width: '100%', paddingVertical: 20, borderRadius: 16, alignItems: 'center', elevation: 4 },
  subscribeButtonDisabled: { backgroundColor: '#BDC3C7' },
  subscribeButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  restoreButton: { marginTop: 15, padding: 10 },
  restoreButtonText: { color: '#95A5A6', fontSize: 14, fontWeight: '600' },
  disclaimer: { fontSize: 11, color: '#BDC3C7', textAlign: 'center', marginTop: 20, paddingHorizontal: 30 },
});