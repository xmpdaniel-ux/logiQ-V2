import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Dimensions, Alert, Linking
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePremium } from '../contexts/PremiumContext';
import { useTranslation } from 'react-i18next';
import * as IAP from 'react-native-iap'; // Direct IAP import for types and methods

// Product IDs for Google Play
const PRODUCT_IDS = {
  MONTHLY: 'logiq-monthly-v2',
  QUARTERLY: 'logiq-quarterly-v2',
  ANNUAL: 'logiq-annual-v2'
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
  const { t } = useTranslation(); // Replaced translations object with useTranslation hook
  const { requestPurchase } = usePremium();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'quarterly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'success' | 'error'>('idle');
  const [subscriptions, setSubscriptions] = useState<any[]>([]); // To store available subscription offers

  const LEGAL_URL = "https://docs.google.com/document/d/1_aW0aGiIHbtmh9gputLKX9iNDcz3xNHC7lHT7InMCg4/edit?usp=sharing";

  const handleOpenLegal = async () => {
    try {
      await Linking.openURL(LEGAL_URL);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir el enlace legal.');
    }
  };

  const { width } = Dimensions.get('window');
  const insets = useSafeAreaInsets();

  // Reset state and fetch subscriptions when modal opens
  useEffect(() => {
    if (visible) {
      setPurchaseState('idle');
      setSelectedPlan('annual');

      const fetchSubs = async () => {
        try {
          const skus = Object.values(PRODUCT_IDS);
          const subs = await IAP.getSubscriptions({ skus });
          setSubscriptions(subs);
        } catch (err) {
          console.warn('Error fetching subscriptions:', err);
        }
      };

      if (Platform.OS === 'android') {
        fetchSubs();
      }
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

      let offerToken = undefined;
      if (Platform.OS === 'android') {
        const sub = subscriptions.find(s => s.productId === productId);
        if (sub?.subscriptionOfferDetails) {
          // Buscamos la oferta que tenga periodo de prueba (price 0) o la primera disponible
          const offer = sub.subscriptionOfferDetails.find((o: any) =>
            o.pricingPhases.pricingPhaseList.some((p: any) => p.priceAmountMicros === '0')
          ) || sub.subscriptionOfferDetails[0];

          offerToken = offer?.offerToken;
          console.log(`Using offerToken for Android: ${offerToken}`);
        }
      }

      await requestPurchase(productId, offerToken);
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
        t('PAYWALL_COMING_SOON_TITLE'),
        t('PAYWALL_COMING_SOON_MESSAGE')
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
            <Text style={styles.successTitle}>{t('PAYWALL_SUCCESS_TITLE')}</Text>
            <Text style={styles.successMessage}>{t('PAYWALL_SUCCESS_MESSAGE')}</Text>
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
            <Text style={styles.errorTitle}>{t('PAYWALL_ERROR_TITLE')}</Text>
            <Text style={styles.errorMessage}>{t('PAYWALL_ERROR_MESSAGE')}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setPurchaseState('idle')}
            >
              <Text style={styles.retryButtonText}>{t('PAYWALL_TRY_AGAIN')}</Text>
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
                <Text style={styles.alertText}>{t('PAYWALL_OUT_OF_CREDITS')}</Text>
              </View>
            )}

            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="crown" size={48} color="#F1C40F" />
            </View>

            <Text style={styles.title}>{t('PAYWALL_TITLE')}</Text>
            <Text style={styles.subtitle}>{t('PAYWALL_SUBTITLE')}</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            {[t('PAYWALL_FEAT_1'), t('PAYWALL_FEAT_2'), t('PAYWALL_FEAT_3'), t('PAYWALL_FEAT_4')].map((feature, index) => (
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
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>{t('PAYWALL_TRIAL_BADGE')}</Text>
              </View>
              <Text style={styles.planName}>{t('PAYWALL_ANNUAL')}</Text>
              <Text style={styles.planPrice}>$41.99</Text>
              <Text style={styles.planPeriod}>{t('PER_YEAR')}</Text>
              <Text style={styles.planSave}>{t('PAYWALL_SAVE_PERCENT')}</Text>
            </TouchableOpacity>

            {/* Quarterly Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'quarterly' && styles.planCardSelected
              ]}
              onPress={() => setSelectedPlan('quarterly')}
            >
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>{t('BEST_VALUE')}</Text>
              </View>
              <Text style={styles.planName}>{t('PAYWALL_QUARTERLY')}</Text>
              <Text style={styles.planPrice}>$14.99</Text>
              <Text style={styles.planPeriod}>{t('PER_QUARTER')}</Text>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.planCardSelected
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <Text style={styles.planName}>{t('PAYWALL_MONTHLY')}</Text>
              <Text style={styles.planPrice}>$6.99</Text>
              <Text style={styles.planPeriod}>{t('PER_MONTH')}</Text>
            </TouchableOpacity>
          </View>

          {/* Purchase Button */}
          <TouchableOpacity
            style={styles.purchaseButton}
            onPress={() => handlePurchase(
              selectedPlan === 'annual' ? PRODUCT_IDS.ANNUAL :
                selectedPlan === 'quarterly' ? PRODUCT_IDS.QUARTERLY :
                  PRODUCT_IDS.MONTHLY
            )}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.purchaseButtonText}>
                  {selectedPlan === 'annual' ? t('PAYWALL_BTN_TRIAL') : t('PAYWALL_BTN_SUBSCRIBE')}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Cancel Info */}
          <Text style={styles.cancelText}>{t('PAYWALL_CANCEL')}</Text>

          {/* Restore Purchases */}
          <TouchableOpacity onPress={handleRestorePurchases}>
            <Text style={styles.restoreText}>{t('PAYWALL_RESTORE')}</Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.termsText}>
            {t('PAYWALL_TERMS_START')}
            <Text style={styles.termsLink} onPress={handleOpenLegal}>{t('PAYWALL_TERMS_LINK')}</Text>
            {t('PAYWALL_TERMS_AND')}
            <Text style={styles.termsLink} onPress={handleOpenLegal}>{t('PAYWALL_PRIVACY_LINK')}</Text>
          </Text>

          {/* Maybe Later */}
          <TouchableOpacity onPress={onClose} style={styles.laterButton}>
            <Text style={styles.laterText}>{t('PAYWALL_CLOSE')}</Text>
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
    zIndex: 1,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  trialBadge: {
    position: 'absolute',
    top: -12,
    backgroundColor: '#F1C40F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  trialBadgeText: {
    color: '#1a1a2e',
    fontSize: 9,
    fontWeight: '900',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#3498DB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 1,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 8,
    marginTop: 8,
  },
  planPrice: {
    fontSize: 22,
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
