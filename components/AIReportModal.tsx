import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { usePremium } from '../contexts/PremiumContext';

interface AIReportModalProps {
  visible: boolean;
  loading: boolean;
  report: string | null;
  error: string | null;
  onClose: () => void;
  onSaveWithReport?: () => void;
  onOpenChat?: () => void;
  category?: string;
}

const AIReportModal: React.FC<AIReportModalProps> = ({ 
  visible, 
  loading, 
  report, 
  error, 
  onClose,
  onSaveWithReport,
  onOpenChat,
  category 
}) => {
  const { t } = useTranslation();
  const { isPremium } = usePremium();
  const [loadingMessage, setLoadingMessage] = useState(t('AI_LOADING_1'));
  
  // Check if category is finance (supports multi-language: finance, finanzas, financiero)
  const categoryLower = category?.toLowerCase() || '';
  const isFinanceCategory = categoryLower.includes('finance') || categoryLower.includes('finan');

  // Dynamic loading messages
  useEffect(() => {
    if (!loading) return;

    const messages = [
      t('AI_LOADING_1'),
      t('AI_LOADING_2'),
      t('AI_LOADING_3'),
      t('AI_LOADING_4'),
    ];
    
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingMessage(messages[index]);
    }, 2500);

    return () => clearInterval(interval);
  }, [loading, t]);

  const handleCopyReport = async () => {
    if (!report) return;
    
    try {
      // Usamos traducción dinámica en lugar de constante fija
      const disclaimer = t('FINANCE_LEGAL_DISCLAIMER');
      const textToCopy = isFinanceCategory ? report + '\n\n' + disclaimer : report;
      
      await Clipboard.setStringAsync(textToCopy);
      Alert.alert('✅', t('REPORT_COPIED'));
    } catch (error) {
      Alert.alert('Error', 'No se pudo copiar el informe');
    }
  };

  const handleSaveWithReport = () => {
    if (onSaveWithReport) {
      onSaveWithReport();
      onClose();
    }
  };

  const handleOpenChat = () => {
    if (onOpenChat) {
      onOpenChat(); // Delega validación al backend (créditos + unique_key)
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={24} color="#F1C40F" />
              <Text style={styles.title}>{t('AI_REPORT_TITLE')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#2C3E50" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F1C40F" />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
                <View style={styles.loadingDots}>
                  <View style={[styles.dot, styles.dot1]} />
                  <View style={[styles.dot, styles.dot2]} />
                  <View style={[styles.dot, styles.dot3]} />
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={48} color="#E74C3C" />
                <Text style={styles.errorTitle}>{t('AI_ERROR')}</Text>
                <Text style={styles.errorText}>{t('AI_ERROR_MSG')}</Text>
              </View>
            )}

            {report && !loading && !error && (
              <View style={styles.reportContainer}>
                <Text style={styles.reportText}>{report}</Text>
                
                {/* Legal Disclaimer - Only for Finance category */}
                {isFinanceCategory && (
                  <View style={styles.disclaimerContainer}>
                    <Ionicons name="warning" size={14} color="#95A5A6" />
                    <Text style={styles.disclaimerText}>
                      {t('FINANCE_LEGAL_DISCLAIMER')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          {report && !loading && !error && (
            <View style={styles.actionButtons}>
              {/* Copy Button - Everyone */}
              <TouchableOpacity 
                style={styles.copyButton} 
                onPress={handleCopyReport}
              >
                <Ionicons name="copy-outline" size={20} color="#3498DB" />
                <Text style={styles.copyButtonText}>{t('BTN_COPY_REPORT')}</Text>
              </TouchableOpacity>

              {/* Chat Button - Disponible para todos (créditos validados en backend) */}
              {onOpenChat && (
                <TouchableOpacity 
                  style={styles.chatButton} 
                  onPress={handleOpenChat}
                >
                  <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
                  <Text style={styles.chatButtonText}>{t('BTN_CONTINUE_CHAT')}</Text>
                </TouchableOpacity>
              )}

              {/* Save Button - Solo Premium */}
              {isPremium && onSaveWithReport && (
                <TouchableOpacity 
                  style={styles.saveWithReportButton} 
                  onPress={handleSaveWithReport}
                >
                  <Ionicons name="save" size={20} color="#FFFFFF" />
                  <Text style={styles.saveWithReportButtonText}>{t('BTN_SAVE_REPORT')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Close Button */}
          {!loading && (
            <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
              <Text style={styles.closeButtonText}>{t('BTN_CLOSE')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    maxHeight: 450,
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#F1C40F',
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1C40F',
  },
  dot1: {
    opacity: 0.3,
  },
  dot2: {
    opacity: 0.6,
  },
  dot3: {
    opacity: 1,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  reportContainer: {
    paddingVertical: 8,
  },
  reportText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#2C3E50',
    textAlign: 'justify',
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#95A5A6',
    gap: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#95A5A6',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EBF5FB',
    borderWidth: 2,
    borderColor: '#3498DB',
  },
  copyButtonText: {
    color: '#3498DB',
    fontSize: 15,
    fontWeight: '700',
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#9B59B6',
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  saveWithReportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1C40F',
  },
  saveWithReportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  closeButtonBottom: {
    backgroundColor: '#2C3E50',
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AIReportModal;