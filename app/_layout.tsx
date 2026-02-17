import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PremiumProvider } from '../contexts/PremiumContext';
import { useTranslation } from 'react-i18next';
import { requestNotificationPermissions, scheduleStrategicReminder } from '../utils/NotificationService';
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="history"
          options={{
            headerShown: true,
            title: 'History',
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            headerShown: true,
            title: 'Premium',
            presentation: 'modal'
          }}
        />
      </Stack>
    </PremiumProvider>
  );
}