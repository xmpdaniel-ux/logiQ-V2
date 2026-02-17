import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Dimensions, Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePremium } from '../contexts/PremiumContext';

// Multi-language support
const translations = {
  en: {
    title: 'Unlock Unlimited Analysis',
    subtitle: 'Make better decisions with AI-powered insights',
    feature1: 'Unlimited AI Reports',
    feature2: 'Premium Follow-up Chat',
    feature3: 'Full Decision History',
    feature4: 'Priority Support',
    outOfCredits: 'You have used your free analysis',
    getUnlimited: 'Get Unlimited Access',
    priceLabel: 'Only',
    perMonth: '/month',
    bestValue: 'Best Value',
    annual: 'Annual',
    savePercent: 'Save 25%',
    monthly: 'Monthly',
    restore: 'Restore Purchases',
    termsStart: 'By subscribing, you agree to our ',
    terms: 'Terms of Service',
    termsAnd: ' and ',
    privacy: 'Privacy Policy',
    cancel: 'Cancel anytime',
    close: 'Maybe Later',
    processing: 'Processing...',
    successTitle: '🎉 Welcome to Premium!',
    successMessage: 'You now have unlimited access to all features.',
    errorTitle: 'Purchase Failed',
    errorMessage: 'Please try again or contact support.',
    tryAgain: 'Try Again'
  },
  es: {
    title: 'Desbloquea Análisis Ilimitados',
    subtitle: 'Toma mejores decisiones con IA avanzada',
    feature1: 'Reportes de IA Ilimitados',
    feature2: 'Chat Premium de Seguimiento',
    feature3: 'Historial Completo',
    feature4: 'Soporte Prioritario',
    outOfCredits: 'Has usado tu análisis gratuito',
    getUnlimited: 'Obtener Acceso Ilimitado',
    priceLabel: 'Solo',
    perMonth: '/mes',
    bestValue: 'Mejor Valor',
    annual: 'Anual',
    savePercent: 'Ahorra 25%',
    monthly: 'Mensual',
    restore: 'Restaurar Compras',
    termsStart: 'Al suscribirte, aceptas nuestros ',
    terms: 'Términos de Servicio',
    termsAnd: ' y ',
    privacy: 'Política de Privacidad',
    cancel: 'Cancela cuando quieras',
    close: 'Quizás Después',
    processing: 'Procesando...',
    successTitle: '🎉 ¡Bienvenido a Premium!',
    successMessage: 'Ahora tienes acceso ilimitado a todas las funciones.',
    errorTitle: 'Error en la Compra',
    errorMessage: 'Por favor intenta de nuevo o contacta soporte.',
    tryAgain: 'Intentar de Nuevo'
  }
};

// Product IDs for Google Play
const PRODUCT_IDS = {
  MONTHLY: 'logiq_monthly_7',
  ANNUAL: 'logiq_annual_35'
};

interface SubscriptionPaywallProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseSuccess: () => void;
  trigger?: 'out_of_report_credits' | 'out_of_chat_credits' | 'manual';
  language?: 'en' | 'es';
}

const SubscriptionPaywall: React.FC<SubscriptionPaywallProps> = ({
  visible,
  onClose,
  onPurchaseSuccess,
  trigger = 'manual',
  language = 'es'
}) => {
  const { requestPurchase } = usePremium();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'success' | 'error'>('idle');

  const t = translations[language];
  const { width } = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPurchaseState('idle');
      setSelectedPlan('annual');
    }
  }, [visible]);

  /**
   * Handle Purchase - Ready for Google Play Billing
   * In production, this will integrate with react-native-purchases or expo-iap
   */
  const handlePurchase = async (productId: string) => {
    setLoading(true);

    try {
      console.log(`Requesting purchase for: ${productId}`);
      await requestPurchase(productId as any);
      // Notar: El éxito se maneja vía purchaseUpdatedListener en PremiumContext
      // que llamará a handlePurchaseSuccess() del contexto.
      // Aquí cerramos si es exitoso (el listener disparará el refresh).
    } catch (error) {
      console.error('Purchase error:', error);
      setPurchaseState('error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setLoading(true);
    try {
      // In production: await Purchases.restorePurchases();
      console.log('Restoring purchases...');
      // For MVP: Show message
      Alert.alert(
        language === 'es' ? 'Próximamente' : 'Coming Soon',
        language === 'es'
          ? 'Esta función estará disponible cuando la app se publique'
          : 'This feature will be available when the app is published'
      );
    } catch (error) {
      console.error('Restore error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Success State
  if (purchaseState === 'success') {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.successContainer}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>{t.successTitle}</Text>
            <Text style={styles.successMessage}>{t.successMessage}</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Error State
  if (purchaseState === 'error') {
    return (
      <Modal visible={visible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={60} color="#E74C3C" />
            <Text style={styles.errorTitle}>{t.errorTitle}</Text>
            <Text style={styles.errorMessage}>{t.errorMessage}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setPurchaseState('idle')}
            >
              <Text style={styles.retryButtonText}>{t.tryAgain}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#7F8C8D" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            {(trigger === 'out_of_report_credits' || trigger === 'out_of_chat_credits') && (
              <View style={styles.alertBadge}>
                <Ionicons name="alert-circle" size={16} color="#FFFFFF" />
                <Text style={styles.alertText}>{t.outOfCredits}</Text>
              </View>
            )}

            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="crown" size={48} color="#F1C40F" />
            </View>

            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.subtitle}>{t.subtitle}</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            {[t.feature1, t.feature2, t.feature3, t.feature4].map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={24} color="#2ECC71" />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Pricing Options */}
          <View style={styles.pricingContainer}>
            {/* Annual Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'annual' && styles.planCardSelected
              ]}
              onPress={() => setSelectedPlan('annual')}
            >
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>{t.bestValue}</Text>
              </View>
              <Text style={styles.planName}>{t.annual}</Text>
              <Text style={styles.planPrice}>$3.75</Text>
              <Text style={styles.planPeriod}>{t.perMonth}</Text>
              <Text style={styles.planSave}>{t.savePercent}</Text>
              <Text style={styles.planBilled}>$44.99/año</Text>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.planCardSelected
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <Text style={styles.planName}>{t.monthly}</Text>
              <Text style={styles.planPrice}>$4.99</Text>
              <Text style={styles.planPeriod}>{t.perMonth}</Text>
            </TouchableOpacity>
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={styles.purchaseButton}
            onPress={() => handlePurchase(
              selectedPlan === 'annual' ? PRODUCT_IDS.ANNUAL : PRODUCT_IDS.MONTHLY
            )}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.purchaseButtonText}>{t.getUnlimited}</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Cancel Info */}
          <Text style={styles.cancelText}>{t.cancel}</Text>

          {/* Restore Purchases */}
          <TouchableOpacity onPress={handleRestorePurchases}>
            <Text style={styles.restoreText}>{t.restore}</Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            {t.termsStart}
            <Text style={styles.termsLink}>{t.terms}</Text>
            {t.termsAnd}
            <Text style={styles.termsLink}>{t.privacy}</Text>
          </Text>

          {/* Maybe Later */}
          <TouchableOpacity onPress={onClose} style={styles.laterButton}>
            <Text style={styles.laterText}>{t.close}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '95%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  alertText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  featuresContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#2C3E50',
    flex: 1,
  },
  pricingContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#3498DB',
    backgroundColor: '#EBF5FB',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#2ECC71',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 8,
    marginTop: 8,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  planPeriod: {
    fontSize: 13,
    color: '#7F8C8D',
  },
  planSave: {
    fontSize: 12,
    color: '#2ECC71',
    fontWeight: '600',
    marginTop: 4,
  },
  planBilled: {
    fontSize: 11,
    color: '#95A5A6',
    marginTop: 2,
  },
  purchaseButton: {
    backgroundColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  cancelText: {
    textAlign: 'center',
    color: '#95A5A6',
    fontSize: 13,
    marginBottom: 16,
  },
  restoreText: {
    textAlign: 'center',
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  termsText: {
    textAlign: 'center',
    color: '#95A5A6',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 16,
  },
  termsLink: {
    color: '#3498DB',
    textDecorationLine: 'underline',
  },
  laterButton: {
    alignItems: 'center',
    padding: 8,
  },
  laterText: {
    color: '#7F8C8D',
    fontSize: 14,
  },
  // Success & Error States
  successContainer: {
    backgroundColor: '#FFFFFF',
    margin: 32,
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFFFFF',
    margin: 32,
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SubscriptionPaywall;
