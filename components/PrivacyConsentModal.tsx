import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const PRIVACY_VERSION = '1';
const PRIVACY_KEY = '@accepted_privacy_version';

const PrivacyConsentModal = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    checkConsent();
  }, []);

  const checkConsent = async () => {
    try {
      const version = await AsyncStorage.getItem(PRIVACY_KEY);
      if (version !== PRIVACY_VERSION) {
        setVisible(true);
      }
    } catch (e) {
      setVisible(true);
    }
  };

  const handleAccept = async () => {
    try {
      await AsyncStorage.setItem(PRIVACY_KEY, PRIVACY_VERSION);
      setVisible(false);
    } catch (e) {
      console.error('Error saving privacy consent', e);
      setVisible(false);
    }
  };

  const openLink = () => {
    Linking.openURL('https://docs.google.com/document/d/1_aW0aGiIHbtmh9gputLKX9iNDcz3xNHC7lHT7InMCg4/edit?usp=drivesdk');
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={48} color="#3498DB" />
            </View>
            <Text style={styles.title}>{t('PRIVACY_CONSENT_TITLE') || 'Tu privacidad importa'}</Text>
            
            <Text style={styles.text}>
              {t('PRIVACY_CONSENT_TEXT') || 'Para continuar usando LogiQ, revisa y acepta nuestra Política de Privacidad y Términos de Servicio.'}
            </Text>

            <TouchableOpacity style={styles.linkButton} onPress={openLink}>
              <Ionicons name="document-text-outline" size={20} color="#3498DB" />
              <Text style={styles.linkText}>
                {t('PRIVACY_POLICY_AND_TERMS') || 'Política de Privacidad y Términos'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
              <Text style={styles.acceptButtonText}>{t('BTN_ACCEPT_AND_CONTINUE') || 'Aceptar y Continuar'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  content: {
    padding: 30,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF5FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C3E50',
    marginBottom: 15,
    textAlign: 'center',
  },
  text: {
    fontSize: 15,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F9FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 25,
    width: '100%',
    justifyContent: 'center',
  },
  linkText: {
    color: '#3498DB',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#3498DB',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PrivacyConsentModal;
