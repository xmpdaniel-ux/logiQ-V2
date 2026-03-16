import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import * as IAP from 'react-native-iap';

// --- STORAGE KEYS (Unificadas con el resto de la App) ---
const DEVICE_ID_KEY = '@device_id';
const REPORT_CREDITS_KEY = '@logiq_report_credits';
const CHAT_CREDITS_KEY = '@logiq_chat_credits';
const PREMIUM_KEY = '@logiq_premium';

// --- BACKEND URL ---
const BACKEND_URL = 'https://logiq-production.up.railway.app';

interface PremiumContextType {
  isPremium: boolean;
  isPro: boolean; 
  isOwner: boolean; // Bypass para el dueño
  reportCredits: number;
  chatCredits: number;
  deviceId: string;
  supportId: string;
  isLoading: boolean;
  showPaywall: boolean;
  language: string;
  paywallTrigger: 'out_of_report_credits' | 'out_of_chat_credits' | 'manual';
  setShowPaywall: (show: boolean, trigger?: 'out_of_report_credits' | 'out_of_chat_credits' | 'manual') => void;
  checkReportCredits: () => Promise<boolean>;
  checkChatCredits: () => Promise<boolean>;
  refreshUserStatus: () => Promise<void>;
  handlePurchaseSuccess: () => void;
  getDeviceId: () => string | null;
  activePurchaseToken: string | null;
  activeProductId: string | null;
  requestPurchase: (sku: string, params?: { offerToken?: string, basePlanId?: string }) => Promise<void>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

// Generate or retrieve device ID
const getOrCreateDeviceId = async (): Promise<string> => {
  try {
    // 1. Intentamos sacar el ID que ya tenemos guardado
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // 2. Si no hay, sacamos el ID REAL del hardware (Android o iOS)
      if (Platform.OS === 'android') {
        deviceId = Application.getAndroidId();
      } else if (Platform.OS === 'ios') {
        deviceId = await Application.getIosIdForVendorAsync();
      } else {
        // Para web seguimos usando uno al azar porque no hay ID de hardware
        deviceId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // 3. Si por alguna razón falla el ID de hardware, creamos uno de respaldo
      if (!deviceId) {
        deviceId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (e) {
    console.error("Error al obtener Device ID:", e);
    return `temp_fallback_${Date.now()}`;
  }
};

export const PremiumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [isPremium, setIsPremium] = useState(false);
  const [reportCredits, setReportCredits] = useState(2);
  const [chatCredits, setChatCredits] = useState(2);
  const [deviceId, setDeviceId] = useState('');
  const [supportId, setSupportId] = useState('');
  const [activePurchaseToken, setActivePurchaseToken] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaywall, setShowPaywallState] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<'out_of_report_credits' | 'out_of_chat_credits' | 'manual'>('manual');

  const purchaseUpdateSubscription = useRef<IAP.PurchaseResult | any>(null);
  const purchaseErrorSubscription = useRef<IAP.PurchaseError | any>(null);

  useEffect(() => {
    // Parallel execution - No await chain
    initializeUser();

    // Non-blocking IAP setup
    setupIAP().then(() => {
      validateProStatus();
    });

    return () => {
      if (purchaseUpdateSubscription.current) {
        purchaseUpdateSubscription.current.remove();
        purchaseUpdateSubscription.current = null;
      }
      if (purchaseErrorSubscription.current) {
        purchaseErrorSubscription.current.remove();
        purchaseErrorSubscription.current = null;
      }
      IAP.endConnection();
    };
  }, []);

  const setupIAP = async () => {
    try {
      await IAP.initConnection();
      if (Platform.OS === 'android') {
        await IAP.flushFailedPurchasesCachedAsPendingAndroid();
      }

      // Evitar duplicidad si ya existen
      if (purchaseUpdateSubscription.current) purchaseUpdateSubscription.current.remove();
      if (purchaseErrorSubscription.current) purchaseErrorSubscription.current.remove();

      purchaseUpdateSubscription.current = IAP.purchaseUpdatedListener(async (purchase) => {
        console.log('purchaseUpdatedListener', purchase);
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          try {
            // 1. Grant local access IMMEDIATELY (Mobile-first UX)
            handlePurchaseSuccess();

            // 2. Background verification (Don't block user)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            // Determinar qué ID enviar
            const VALID_SKUS = ['logiq_premium_monthly', 'logiq-monthly-v2', 'logiq-quarterly-v2', 'logiq-annual-v2'];
            let idToSend = purchase.productId;
            if (purchase.productIds && Array.isArray(purchase.productIds)) {
              const matchedId = purchase.productIds.find((id: string) => VALID_SKUS.includes(id));
              if (matchedId) idToSend = matchedId;
            }

            fetch(`${BACKEND_URL}/api/verify-purchase`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                device_id: deviceId,
                purchase_token: purchase.purchaseToken,
                product_id: idToSend,
                hardware_fingerprint: null
              })
            }).then(resp => {
              clearTimeout(timeoutId);
              if (purchase.purchaseToken) setActivePurchaseToken(purchase.purchaseToken);
              setActiveProductId(idToSend);
              if (!resp.ok) console.warn('Background verification failed, but user has local access');
            }).catch(e => {
              clearTimeout(timeoutId);
              console.warn('Background verification error (timeout or network):', e);
            });

            await IAP.finishTransaction({ purchase, isConsumable: false });
          } catch (ackErr) {
            console.warn('ackErr', ackErr);
          }
        }
      });

      purchaseErrorSubscription.current = IAP.purchaseErrorListener((error) => {
        console.warn('purchaseErrorListener', error);
      });

    } catch (err) {
      console.warn('IAP Initialization Error', err);
    }
  };

  // El ID del dueño para bypass en caso de errores de API
  const OWNER_SUPPORT_ID = "gen_1768615120672_ugwvgzll0";

  const isActuallyPremium = () => {
    return isPremium || (supportId === OWNER_SUPPORT_ID);
  };


  const validateProStatus = async () => {
    try {
      const VALID_SKUS = ['logiq_premium_monthly', 'logiq-monthly-v2', 'logiq-quarterly-v2', 'logiq-annual-v2'];

      const purchases = await IAP.getAvailablePurchases();

      // We check for any of our known substrings or exact matches in the productIds
      const activePurchase = purchases.find(p => {
        const pId = p.productId || '';
        const pIds = p.productIds || [];
        return VALID_SKUS.includes(pId) || 
               (Array.isArray(pIds) && pIds.some(id => VALID_SKUS.includes(id))) ||
               pId.includes('monthly') || 
               pId.includes('quarterly') || 
               pId.includes('annual');
      });

      if (activePurchase) {
        setIsPremium(true);
        setChatCredits(999);
        setReportCredits(999);
        setActivePurchaseToken(activePurchase.purchaseToken || null);
        await AsyncStorage.setItem(PREMIUM_KEY, 'true');

        // Sync local premium status with Backend continuously to prevent 402 errors
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const currentId = await getOrCreateDeviceId();
          let idToSend = activePurchase.productId;
          if (activePurchase.productIds && Array.isArray(activePurchase.productIds)) {
            const matchedId = activePurchase.productIds.find((id: string) => VALID_SKUS.includes(id));
            if (matchedId) idToSend = matchedId;
          }
          setActiveProductId(idToSend);

          fetch(`${BACKEND_URL}/api/verify-purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              device_id: currentId,
              purchase_token: activePurchase.purchaseToken,
              product_id: idToSend,
              hardware_fingerprint: null
            })
          }).catch(e => console.warn('Silent sync failed', e));
          clearTimeout(timeoutId);
        } catch (e) { }
      } else {
        // Only downgrade if we are sure there are no purchases
        // But check if we have it in storage first as a safety net
        const cachedPremium = await AsyncStorage.getItem(PREMIUM_KEY);
        if (cachedPremium !== 'true') {
          setIsPremium(false);
          await AsyncStorage.removeItem(PREMIUM_KEY);
        }
      }
      return !!activePurchase;
    } catch (err) {
      console.warn('Error validating Pro status:', err);
      return false;
    }
  };

  const requestPurchase = async (sku: string, params: { offerToken?: string, basePlanId?: string } = {}) => {
    try {
      if (Platform.OS === 'android' && params.offerToken) {
        // En Android para la versión 5/6+ es crítico enviar el offerToken
        await IAP.requestSubscription({
          sku,
          subscriptionOffers: [{ sku, offerToken: params.offerToken }]
        });
      } else {
        await IAP.requestSubscription({ sku });
      }
    } catch (err: any) {
      console.warn('Purchase Error:', err);
      // Solo mostramos alerta si no es una cancelación del usuario
      if (err?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Error', err.message);
      }
    }
  };

  const initializeUser = async () => {
    try {
      setIsLoading(true);
      const id = await getOrCreateDeviceId();
      setDeviceId(id);

      try {
        const response = await fetch(`${BACKEND_URL}/api/user/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: id,
            language: i18n.language || 'es'
          })
        });

        if (response.ok) {
          const data = await response.json();
          const suppId = data.support_id || id;
          setSupportId(suppId);
          await AsyncStorage.setItem('@support_id', suppId);
          if (data.is_premium) {
            setIsPremium(true);
            setReportCredits(999);
            setChatCredits(999);
            await AsyncStorage.setItem(PREMIUM_KEY, 'true');
          } else {
            // Check IAP before giving up
            await validateProStatus();
          }

          await AsyncStorage.setItem(REPORT_CREDITS_KEY, String(data.report_credits ?? 2));
          await AsyncStorage.setItem(CHAT_CREDITS_KEY, String(data.chat_credits ?? 2));
        } else {
          await loadCachedStatus();
        }
      } catch (error) {
        console.warn('Backend inalcanzable, usando caché/IAP');
        const isValidIAP = await validateProStatus();
        if (!isValidIAP) {
          await loadCachedStatus();
        }
      }
    } catch (error) {
      const isValidIAP = await validateProStatus();
      if (!isValidIAP) {
        await loadCachedStatus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadCachedStatus = async () => {
    try {
      const cachedSupportId = await AsyncStorage.getItem('@support_id');
      const cachedReportCredits = await AsyncStorage.getItem(REPORT_CREDITS_KEY);
      const cachedChatCredits = await AsyncStorage.getItem(CHAT_CREDITS_KEY);
      const cachedPremium = await AsyncStorage.getItem(PREMIUM_KEY);

      if (cachedSupportId) setSupportId(cachedSupportId);
      if (cachedReportCredits !== null) setReportCredits(parseInt(cachedReportCredits, 10));
      if (cachedChatCredits !== null) setChatCredits(parseInt(cachedChatCredits, 10));
      if (cachedPremium !== null) setIsPremium(cachedPremium === 'true');
    } catch (error) {
      console.error('Error loading cached status:', error);
    }
  };

  const refreshUserStatus = async () => {
    const currentId = deviceId || await getOrCreateDeviceId();
    if (!currentId) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/user/credits/${currentId}`);

      if (response.ok) {
        const data = await response.json();
        setReportCredits(data.report_credits ?? 0);
        setChatCredits(data.chat_credits ?? 0);

        // Only update isPremium to true if backend says so. 
        // NEVER set to false from here if we already have it locally
        if (data.is_premium) {
          setIsPremium(true);
          await AsyncStorage.setItem(PREMIUM_KEY, 'true');
        }

        await AsyncStorage.setItem(REPORT_CREDITS_KEY, String(data.report_credits ?? 0));
        await AsyncStorage.setItem(CHAT_CREDITS_KEY, String(data.chat_credits ?? 0));
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const checkReportCredits = async (): Promise<boolean> => {
    if (isActuallyPremium()) return true;
    if (reportCredits > 0) return true;
    setShowPaywall(true, 'out_of_report_credits');
    return false;
  };

  const checkChatCredits = async (): Promise<boolean> => {
    if (isActuallyPremium()) return true;
    if (chatCredits > 0) return true;
    setShowPaywall(true, 'out_of_chat_credits');
    return false;
  };

  const setShowPaywall = (show: boolean, trigger: 'out_of_report_credits' | 'out_of_chat_credits' | 'manual' = 'manual') => {
    setPaywallTrigger(trigger);
    setShowPaywallState(show);
  };

  const handlePurchaseSuccess = async () => {
    setIsPremium(true);
    setChatCredits(999); // Ilimitados para Pro
    setReportCredits(999);
    await AsyncStorage.setItem(PREMIUM_KEY, 'true');
    setShowPaywallState(false); // Cierre automático del Paywall
    await refreshUserStatus(); // Sincronización forzada con el Backend
  };

  const getDeviceId = () => deviceId;

  return (
    <PremiumContext.Provider
      value={{
        isPremium: isActuallyPremium(),
        isPro: isActuallyPremium(),
        isOwner: supportId === OWNER_SUPPORT_ID,
        reportCredits,
        chatCredits,
        deviceId,
        supportId,
        isLoading,
        showPaywall,
        language: i18n.language || 'en',
        paywallTrigger,
        setShowPaywall,
        checkReportCredits,
        checkChatCredits,
        refreshUserStatus,
        handlePurchaseSuccess,
        getDeviceId,
        activePurchaseToken,
        activeProductId,
        requestPurchase,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
};

export const usePremium = () => {
  const context = useContext(PremiumContext);
  if (!context) {
    throw new Error('usePremium must be used within PremiumProvider');
  }
  return context;
};