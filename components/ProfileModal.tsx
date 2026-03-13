import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Linking, ScrollView, Platform, Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePremium } from '../contexts/PremiumContext';
import { useTranslation } from 'react-i18next';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { isPremium, isPro, reportCredits, chatCredits, supportId, setShowPaywall } = usePremium();
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');

  const LEGAL_URL = "https://docs.google.com/document/d/1_aW0aGiIHbtmh9gputLKX9iNDcz3xNHC7lHT7InMCg4/edit?usp=drivesdk";
  const SUPPORT_EMAIL = "logiq.app.contact@gmail.com";

  const handleOpenLegal = async () => {
    try {
      await Linking.openURL(LEGAL_URL);
    } catch (error) {
      console.error("Error opening legal URL:", error);
    }
  };

  const totalCredits = reportCredits + chatCredits;
  const isActuallyPro = isPremium || isPro;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('MODAL_PROFILE_TITLE')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={28} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status Section */}
            <View style={styles.statusSection}>
              <View style={[styles.crownContainer, isActuallyPro ? styles.crownPro : styles.crownFree]}>
                <MaterialCommunityIcons 
                  name="diamond-stone" 
                  size={48} 
                  color={isActuallyPro ? "#F1C40F" : "#94A3B8"} 
                />
              </View>
              <Text style={styles.accountType}>
                {isActuallyPro ? t('MODAL_ACCOUNT_PRO') : t('MODAL_ACCOUNT_FREE')}
              </Text>
              
              {!isActuallyPro && (
                <View style={styles.creditsBadge}>
                  <Text style={styles.creditsText}>
                    {totalCredits} {t('CREDITS_LEFT')}
                  </Text>
                </View>
              )}
            </View>
            {/* CTA Section */}
            <View style={styles.ctaSection}>
              {isActuallyPro ? (
                <TouchableOpacity 
                  style={styles.manageButton}
                  onPress={() => Linking.openURL('https://play.google.com/store/account/subscriptions')}
                >
                  <Ionicons name="settings-outline" size={20} color="#334155" />
                  <Text style={styles.manageButtonText}>{t('MANAGE_SUBSCRIPTION') || 'Gestionar Suscripción'}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.upgradeButton}
                  onPress={() => {
                    onClose();
                    setShowPaywall(true, 'manual');
                  }}
                >
                  <MaterialCommunityIcons name="diamond" size={20} color="#FFFFFF" />
                  <Text style={styles.upgradeButtonText}>{t('UPGRADE_TITLE') || 'Desbloquear Plan Pro'}</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.legalButtonSutilCTA}
                onPress={handleOpenLegal}
              >
                <Text style={styles.legalButtonTextSutil}>{t('BTN_TERMS_SERVICE') || 'Términos del Servicio'}</Text>
              </TouchableOpacity>
            </View>

            {/* Support ID / Legal Section */}
            <View style={styles.supportContainer}>
              <Text style={styles.supportIdText}>Support ID: {supportId || 'N/A'}</Text>
              
              <Text style={styles.supportFooterText}>
                {t('MODAL_SUPPORT_FOOTER')}
              </Text>
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  crownContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  crownPro: {
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F1C40F',
  },
  crownFree: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  accountType: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  creditsBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  creditsText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '700',
  },
  ctaSection: {
    marginBottom: 32,
  },
  upgradeButton: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  manageButton: {
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  manageButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '700',
  },
  infoSection: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  idText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#334155',
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  legalSection: {
    marginBottom: 20,
  },
  legalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legalButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 12,
  },
  legalButtonSutilCTA: {
    alignSelf: 'center',
    marginTop: 12,
    padding: 8,
  },
  supportContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    marginBottom: 20,
  },
  supportIdText: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  legalButtonSutil: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  legalButtonTextSutil: {
    color: '#3498DB',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  supportFooterText: {
    fontSize: 10,
    color: '#BDC3C7',
    textAlign: 'center',
    lineHeight: 14,
  },
});

export default ProfileModal;
