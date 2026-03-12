import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking, SafeAreaView, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const PRIVACY_VERSION = '1';
const PRIVACY_KEY = '@accepted_privacy_version';

const PrivacyConsentModal = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    checkConsent();
  }, []);

  const checkConsent = async () => {
    try {
      const version = await AsyncStorage.getItem(PRIVACY_KEY);
      if (version !== PRIVACY_VERSION) {
        // Reset accepted state when modal becomes visible due to version mismatch
        setAccepted(false);
        setVisible(true);
      }
    } catch (e) {
      setVisible(true);
    }
  };

  const handleAccept = async () => {
    if (!accepted) return;
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
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark" size={32} color="#3498DB" />
              </View>
              <Text style={styles.title}>{t('PRIVACY_CONSENT_TITLE') || 'Tu privacidad importa'}</Text>
            </View>
            
            <View style={styles.scrollContainer}>
              <ScrollView showsVerticalScrollIndicator={true} style={styles.scrollView}>
                <Text style={styles.text}>
                  {t('PRIVACY_POLICY_CONTENT') || t('PRIVACY_CONSENT_TEXT')}
                </Text>
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAccepted(!accepted)}>
              <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
                {accepted && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </View>
              <Text style={styles.checkboxLabel}>
                {t('BTN_ACCEPT_TERMS') || 'Acepto los Términos y la Política de Privacidad'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.acceptButton, !accepted && styles.acceptButtonDisabled]} 
              onPress={handleAccept}
              disabled={!accepted}
            >
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  content: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EBF5FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2C3E50',
    flex: 1,
  },
  scrollContainer: {
    height: 350,
    backgroundColor: '#F8F9F9',
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EAECEE',
  },
  scrollView: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    color: '#34495E',
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#3498DB',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '600',
    flex: 1,
  },
  acceptButton: {
    backgroundColor: '#3498DB',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#BDC3C7',
    opacity: 0.7,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PrivacyConsentModal;
