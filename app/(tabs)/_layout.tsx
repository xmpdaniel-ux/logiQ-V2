import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TouchableOpacity, StyleSheet, Platform, View, Text, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { usePremium } from '../../contexts/PremiumContext';

export default function TabLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPremium } = usePremium();

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#2C3E50' }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#3498DB',
          tabBarInactiveTintColor: '#95A5A6',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E0E0E0',
            height: Platform.OS === 'ios' ? 88 : 75,
            paddingBottom: Platform.OS === 'ios' ? 24 : 16,
            paddingTop: 8,
            borderTopWidth: 1,
            elevation: 0,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginBottom: Platform.OS === 'android' ? 4 : 0,
          },
          headerStyle: {
            backgroundColor: '#2C3E50',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerRight: () => (
            <View style={styles.headerButtons}>


              <TouchableOpacity
                style={styles.helpButton}
                onPress={() => {
                  const title = t('HELP_MODAL_TITLE');
                  const message = t('HELP_MODAL_CONTENT');

                  if (Platform.OS === 'web') {
                    alert(`${title}\n\n${message}`);
                  } else {
                    Alert.alert(title, message, [{ text: t('OK') || 'OK' }]);
                  }
                }}
              >
                <Ionicons name="help-circle-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="business"
          options={{
            title: t('TAB_BUSINESS'),
            tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="career"
          options={{
            title: t('TAB_CAREER'),
            tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="relationship"
          options={{
            title: t('TAB_RELATIONSHIP'),
            tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{
            title: t('TAB_FINANCE'),
            tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} />
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t('TAB_HISTORY'),
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />
          }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 15,
    gap: 12,
  },
  premiumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1ABC9C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 5,
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  helpButton: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});