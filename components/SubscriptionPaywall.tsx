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
const PRODUCT_IDS = {
  MONTHLY: 'logiq_premium_monthly',
  QUARTERLY: 'logiq_premium_quarterly',
  ANNUAL: 'logiq_premium_annual'
};

const APP_VERSION_TAG = '2.0.2.9 (Build 133)';

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [chivatoLog, setChivatoLog] = useState<string | null>(null);
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
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Store connection timed out')), 7000)
        );

        try {
          setStatusMessage(t('msg_connecting_store') || 'Conectando con la tienda...');
          setLoading(true);

          await Promise.race([
            (async () => {
              await IAP.initConnection();
              setStatusMessage(t('msg_loading_plans') || 'Cargando planes...');

              const primarySkus = Object.values(PRODUCT_IDS);
              const variations = [
                ...primarySkus,
                ...primarySkus.map(s => s.replace('premium', 'pro')),
                ...primarySkus.map(s => s.replace('premium_', '')),
                ...primarySkus.map(s => s.replace('_premium', '')),
                'logiq_monthly', 'logiq_quarterly', 'logiq_annual',
                'logiq_premium_monthly', 'logiq_premium_quarterly', 'logiq_premium_annual',
                'logiq_pro_monthly', 'logiq_pro_quarterly', 'logiq_pro_annual',
                'premium_monthly', 'premium_quarterly', 'premium_annual',
                'logiq-premium-monthly', 'logiq-premium-quarterly', 'logiq-premium-annual',
                'logiq_monthly_v2', 'logiq_quarterly_v2', 'logiq_annual_v2'
              ];
              const allSkusToTry = [...new Set(variations)];

              setChivatoLog(`[INIT] Version: ${APP_VERSION_TAG}\nSearching ${allSkusToTry.length} SKUs...`);
              console.log(`Searching ${allSkusToTry.length} SKUs: ${allSkusToTry.join(', ')}`);

              let foundSubs: any[] = [];
              try {
                // Try modern Subscriptions first
                const subs = await IAP.getSubscriptions({ skus: allSkusToTry });
                if (subs.length > 0) {
                  const subNames = subs.map(s => `${(s as any).productId} (Sub)`).join(', ');
                  foundSubs = [...foundSubs, ...subs];
                  setChivatoLog(prev => `${prev}\n[FOUND SUBS] ${subNames}`);
                }
              } catch (e: any) {
                console.log("getSubscriptions error (expected if empty):", e.message);
              }

              // Fallback to Products
              try {
                const prods = await IAP.getProducts({ skus: allSkusToTry });
                if (prods.length > 0) {
                  const prodNames = prods.map(p => `${(p as any).productId} (Prod)`).join(', ');
                  foundSubs = [...foundSubs, ...prods];
                  setChivatoLog(prev => `${prev}\n[FOUND PRODS] ${prodNames}`);
                }
              } catch (e: any) {
                console.log("getProducts error:", e.message);
              }

              if (foundSubs.length === 0) {
                const rawDebugInfo = `SKUs sought: ${allSkusToTry.join(', ')}\n\nPossible cause: Account not authorized as tester or SKUs inactive/different in Play Console.`;
                setChivatoLog(`[STORE ALERT]\nNo se encontró nada en la tienda.\n\n${rawDebugInfo}`);
              } else {
                console.log(`Found ${foundSubs.length} items: ${foundSubs.map(s => (s as any).productId).join(', ')}`);
                // If we found legacy SKUs, we log it for the user to see
                const foundIds = foundSubs.map(s => (s as any).productId);
                if (foundIds.some(id => !primarySkus.includes(id))) {
                  setChivatoLog(`[SKU DISCOVERY]\nEncontrados SKUs no-v2:\n${foundIds.join('\n')}`);
                }
              }

              setSubscriptions(foundSubs);
              setLoading(false);
              setStatusMessage(null);
            })(),
            timeoutPromise
          ]);
        } catch (err: any) {
          console.error('Error fetching subscriptions:', err);
          const nativeCode = err.code || 'NO_CODE';
          const nativeMsg = err.message || 'Unknown Error';

          setChivatoLog(`[STORE ERROR]\nCode: ${nativeCode}\nMsg: ${nativeMsg}`);

          const errMsg = err.message === 'Store connection timed out'
            ? 'Store connection timed out. Please check your internet or try again.'
            : `Error de tienda (${nativeCode}): ${nativeMsg}`;

          setStatusMessage(errMsg);
          setLoading(false);
        }
      };

      fetchSubs();
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
      let offerToken = undefined; // Declare offerToken here

      // Logic to find the discovered SKU that matches the plan type
      let matchingSub = subscriptions.find(s => s.productId === productId);

      if (!matchingSub) {
        console.log(`Direct match failed for ${productId}, searching fuzzy...`);
        const baseName = productId.split('-')[1]; // e.g. 'monthly' from 'logiq-monthly-v2'
        matchingSub = subscriptions.find(s => s.productId.includes(baseName));
      }

      if (!matchingSub) {
        throw new Error(`No se encontró ningún producto en la tienda para el plan: ${productId}`);
      }

      const subAny = matchingSub as any;
      const realProductId = subAny.productId;
      console.log(`Using discovered SKU: ${realProductId}`);

      if (subAny.subscriptionOfferDetails && subAny.subscriptionOfferDetails.length > 0) {
        // Intentar encontrar oferta con trial (solo para el plan anual idealmente)
        let offer = null;
        if (realProductId.includes('annual')) {
          offer = subAny.subscriptionOfferDetails.find((o: any) =>
            o.pricingPhases.pricingPhaseList.some((p: any) => p.priceAmountMicros === '0')
          );
        }

        // Si no hay trial o es otro plan, coger la primera oferta válida
        offer = offer || subAny.subscriptionOfferDetails[0];
        offerToken = offer?.offerToken;
      }

      if (!offerToken) {
        throw new Error(`No offerToken for ${realProductId}. Details: ${JSON.stringify(subAny).substring(0, 100)}`);
      }

      await requestPurchase(realProductId, offerToken);
    } catch (error: any) {
      console.error('Purchase error:', error);
      if (error?.code !== 'E_USER_CANCELLED') {
        setPurchaseState('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    setLoading(true);
    try {
      console.log('Restoring purchases...');
      const availablePurchases = await IAP.getAvailablePurchases();

      const hasActivePurchase = availablePurchases.some(p =>
        p.productId === PRODUCT_IDS.MONTHLY ||
        p.productId === PRODUCT_IDS.QUARTERLY ||
        p.productId === PRODUCT_IDS.ANNUAL
      );

      if (hasActivePurchase) {
        Alert.alert(
          t('SUCCESS_TITLE') || '✅ Success',
          t('RESTORE_SUCCESS_MESSAGE') || 'Tus suscripciones han sido restauradas.'
        );
        // handlePurchaseSuccess se encargará de actualizar el estado global si es necesario
      } else {
        Alert.alert(
          t('RESTORE_EMPTY_TITLE') || 'Aviso',
          t('RESTORE_EMPTY_MESSAGE') || 'No se encontraron suscripciones activas vinculadas a esta cuenta.'
        );
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      Alert.alert('Error', error.message || 'Error al restaurar compras.');
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
              disabled={loading}
            >
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>{t('PAYWALL_TRIAL_BADGE')}</Text>
              </View>
              <Text style={styles.planName}>{t('PAYWALL_ANNUAL')}</Text>
              <View style={styles.priceContainer}>
                {loading ? (
                  <ActivityIndicator size="small" color="#3498DB" />
                ) : (() => {
                  const findSub = (key: 'monthly' | 'quarterly' | 'annual') => {
                    return subscriptions.find(s => {
                      const pid = s.productId.toLowerCase();
                      return pid.includes(key) && (pid.includes('logiq') || pid.includes('premium'));
                    });
                  };

                  const sub = findSub('annual');
                  if (!sub) return <Text style={styles.planPrice}>N/A</Text>;

                  // Robust price extraction
                  const subAny = sub as any;
                  const price = subAny.subscriptionOfferDetails?.[0]?.pricingPhases.pricingPhaseList[0].formattedPrice
                    || subAny.localizedPrice
                    || subAny.price;
                  return <Text style={styles.planPrice}>{price || 'N/A'}</Text>;
                })()}
              </View>
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
              disabled={loading}
            >
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>{t('BEST_VALUE')}</Text>
              </View>
              <Text style={styles.planName}>{t('PAYWALL_QUARTERLY')}</Text>
              <View style={styles.priceContainer}>
                {loading ? (
                  <ActivityIndicator size="small" color="#3498DB" />
                ) : (() => {
                  const findSub = (key: 'monthly' | 'quarterly' | 'annual') => {
                    return subscriptions.find(s => {
                      const pid = s.productId.toLowerCase();
                      return pid.includes(key) && (pid.includes('logiq') || pid.includes('premium'));
                    });
                  };

                  const sub = findSub('quarterly');
                  if (!sub) return <Text style={styles.planPrice}>N/A</Text>;

                  const subAny = sub as any;
                  const price = subAny.subscriptionOfferDetails?.[0]?.pricingPhases.pricingPhaseList[0].formattedPrice
                    || subAny.localizedPrice
                    || subAny.price;
                  return <Text style={styles.planPrice}>{price || 'N/A'}</Text>;
                })()}
              </View>
              <Text style={styles.planPeriod}>{t('PER_QUARTER')}</Text>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              style={[
                styles.planCard,
                selectedPlan === 'monthly' && styles.planCardSelected
              ]}
              onPress={() => setSelectedPlan('monthly')}
              disabled={loading}
            >
              <Text style={styles.planName}>{t('PAYWALL_MONTHLY')}</Text>
              <View style={styles.priceContainer}>
                {loading ? (
                  <ActivityIndicator size="small" color="#3498DB" />
                ) : (() => {
                  const findSub = (key: 'monthly' | 'quarterly' | 'annual') => {
                    return subscriptions.find(s => {
                      const pid = s.productId.toLowerCase();
                      return pid.includes(key) && (pid.includes('logiq') || pid.includes('premium'));
                    });
                  };

                  const sub = findSub('monthly');
                  if (!sub) return <Text style={styles.planPrice}>N/A</Text>;

                  const subAny = sub as any;
                  const price = subAny.subscriptionOfferDetails?.[0]?.pricingPhases.pricingPhaseList[0].formattedPrice
                    || subAny.localizedPrice
                    || subAny.price;
                  return <Text style={styles.planPrice}>{price || 'N/A'}</Text>;
                })()}
              </View>
              <Text style={styles.planPeriod}>{t('PER_MONTH')}</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#6366f1" />
              {statusMessage && (
                <Text style={styles.statusText}>{statusMessage}</Text>
              )}
            </View>
          )}

          {chivatoLog && (
            <View style={styles.chivatoOverlay}>
              <Ionicons name="bug" size={40} color="#FFFFFF" />
              <Text style={styles.chivatoTitle}>DEBUG LOG (AND-IAP)</Text>
              <Text style={styles.chivatoText}>{chivatoLog}</Text>
              <Text style={styles.chivatoVersion}>Build v{APP_VERSION_TAG}</Text>
              <TouchableOpacity
                style={styles.chivatoClose}
                onPress={() => setChivatoLog(null)}
              >
                <Text style={styles.chivatoCloseText}>CERRAR LOG</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && statusMessage && !chivatoLog && (
            <View style={styles.errorBanner}>
              <Text style={styles.statusText}>{statusMessage}</Text>
              <TouchableOpacity onPress={() => setStatusMessage(null)}>
                <Text style={styles.closeErrorText}>[X]</Text>
              </TouchableOpacity>
            </View>
          )}
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
    marginBottom: 24,
    marginTop: 10,
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
  statusText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20
  },
  errorBanner: {
    backgroundColor: '#ef444422',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    marginHorizontal: 20
  },
  closeErrorText: {
    color: '#ef4444',
    fontWeight: 'bold',
    marginLeft: 10
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#1A1A2E',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  pricingContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#3498DB',
    backgroundColor: '#F0F9FF',
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  trialBadgeText: {
    color: '#1A1A2E',
    fontSize: 10,
    fontWeight: '900',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    backgroundColor: '#3498DB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  priceContainer: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  planName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    marginTop: 10,
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  planPeriod: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  planSave: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 6,
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
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 16,
    gap: 10,
    elevation: 2,
    shadowColor: '#3498DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cancelText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 16,
  },
  restoreText: {
    textAlign: 'center',
    color: '#3498DB',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  termsText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  termsLink: {
    color: '#3498DB',
    textDecorationLine: 'underline',
    fontWeight: '600',
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    borderRadius: 12
  },
  chivatoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 2000,
    borderRadius: 12
  },
  chivatoTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10
  },
  chivatoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    marginBottom: 20
  },
  chivatoVersion: {
    color: '#FFFFFF88',
    fontSize: 10,
    marginTop: 10,
    fontWeight: 'bold'
  },
  chivatoClose: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  chivatoCloseText: {
    color: '#ef4444',
    fontWeight: 'bold'
  },
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
