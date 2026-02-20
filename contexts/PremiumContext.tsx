import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  isPro: boolean; // Alias solicitado por el usuario
  reportCredits: number;
  chatCredits: number;
  deviceId: string;
  isLoading: boolean;
  showPaywall: boolean;
  language: string;
  paywallTrigger: 'out_of_report_credits' | 'out_of_chat_credits' | 'manual';
  setShowPaywall: (show: boolean, trigger?: 'out_of_report_credits' | 'out_of_chat_credits' | 'manual') => void;
  checkReportCredits: () => Promise<boolean>;
  checkChatCredits: () => Promise<boolean>;
  refreshUserStatus: () => Promise<void>;
  handlePurchaseSuccess: () => void;
  getDeviceId: () => string;
  requestPurchase: (sku: 'logiq-monthly-v2' | 'logiq-quarterly-v2' | 'logiq-annual-v2') => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [showPaywall, setShowPaywallState] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<'out_of_report_credits' | 'out_of_chat_credits' | 'manual'>('manual');

  useEffect(() => {
    initializeUser();
    setupIAP().then(() => {
      validateProStatus(); // Re-validar después de conectar
    });

    return () => {
      IAP.endConnection();
    };
  }, []);

  const setupIAP = async () => {
    try {
      await IAP.initConnection();
      if (Platform.OS === 'android') {
        await IAP.flushFailedPurchasesCachedAsPendingAndroid();
      }

      const purchaseUpdateSubscription = IAP.purchaseUpdatedListener(async (purchase) => {
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          try {
            // Validamos y finalizamos la compra
            await IAP.finishTransaction({ purchase, isConsumable: false });
            handlePurchaseSuccess();
          } catch (ackErr) {
            console.warn('ackErr', ackErr);
          }
        }
      });

      const purchaseErrorSubscription = IAP.purchaseErrorListener((error) => {
        console.warn('purchaseErrorListener', error);
      });

    } catch (err) {
      console.warn('IAP Initialization Error', err);
    }
  };


  const validateProStatus = async () => {
    try {
      const purchases = await IAP.getAvailablePurchases();
      const hasActivePurchase = purchases.some(p =>
        p.productId === 'logiq-monthly-v2' ||
        p.productId === 'logiq-quarterly-v2' ||
        p.productId === 'logiq-annual-v2'
      );

      if (hasActivePurchase) {
        setIsPremium(true);
        setChatCredits(999);
        setReportCredits(999);
        await AsyncStorage.setItem(PREMIUM_KEY, 'true');
      }
      return hasActivePurchase;
    } catch (err) {
      console.warn('Error validating Pro status:', err);
      return false;
    }
  };

  const requestPurchase = async (sku: 'logiq-monthly-v2' | 'logiq-quarterly-v2' | 'logiq-annual-v2') => {
    try {
      await IAP.requestSubscription({ sku });
    } catch (err: any) {
      Alert.alert('Error', err.message);
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
          setReportCredits(data.report_credits ?? 2);
          setChatCredits(data.chat_credits ?? 2);
          setIsPremium(data.is_premium ?? false);

          await AsyncStorage.setItem(REPORT_CREDITS_KEY, String(data.report_credits ?? 2));
          await AsyncStorage.setItem(CHAT_CREDITS_KEY, String(data.chat_credits ?? 2));
          await AsyncStorage.setItem(PREMIUM_KEY, String(data.is_premium ?? false));
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
      const cachedReportCredits = await AsyncStorage.getItem(REPORT_CREDITS_KEY);
      const cachedChatCredits = await AsyncStorage.getItem(CHAT_CREDITS_KEY);
      const cachedPremium = await AsyncStorage.getItem(PREMIUM_KEY);

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
        setIsPremium(data.is_premium ?? false);

        await AsyncStorage.setItem(REPORT_CREDITS_KEY, String(data.report_credits ?? 0));
        await AsyncStorage.setItem(CHAT_CREDITS_KEY, String(data.chat_credits ?? 0));
        await AsyncStorage.setItem(PREMIUM_KEY, String(data.is_premium ?? false));
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
  };

  const checkReportCredits = async (): Promise<boolean> => {
    if (isPremium) return true;
    if (reportCredits > 0) return true;
    setShowPaywall(true, 'out_of_report_credits');
    return false;
  };

  const checkChatCredits = async (): Promise<boolean> => {
    if (isPremium) return true;
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
        isPremium,
        isPro: isPremium,
        reportCredits,
        chatCredits,
        deviceId,
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