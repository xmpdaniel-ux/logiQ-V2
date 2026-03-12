import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PremiumProvider } from '../contexts/PremiumContext';
import { useTranslation } from 'react-i18next';
import { requestNotificationPermissions, scheduleStrategicReminder } from '../utils/NotificationService';
import { StatusBar } from 'expo-status-bar';
import PrivacyConsentModal from '../components/PrivacyConsentModal';
import SubscriptionPaywall from '../components/SubscriptionPaywall';
import { usePremium } from '../contexts/PremiumContext';
import '../i18n';

export default function RootLayout() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Inicializar Notificaciones Estratégicas
    const initNotifications = async () => {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleStrategicReminder(i18n.language || 'en');
      }
    };
    initNotifications();
  }, [i18n.language]);

  return (
    <PremiumProvider>
      <InnerLayout />
    </PremiumProvider>
  );
}

function InnerLayout() {
  const { showPaywall, setShowPaywall, handlePurchaseSuccess, paywallTrigger } = usePremium();
  const { t } = useTranslation();

  return (
    <>
      <StatusBar style="light" translucent={true} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="history"
          options={{
            headerShown: true,
            title: t('P_TITULO_HIS') || 'History',
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            headerShown: true,
            title: t('P_TITULO_PAY') || 'Premium',
            presentation: 'modal'
          }}
        />
      </Stack>
      
      <PrivacyConsentModal />

      <SubscriptionPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseSuccess={handlePurchaseSuccess}
        trigger={paywallTrigger}
      />
    </>
  );
}