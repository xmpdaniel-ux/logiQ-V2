import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PremiumProvider } from '../contexts/PremiumContext';
import '../i18n';

export default function RootLayout() {
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