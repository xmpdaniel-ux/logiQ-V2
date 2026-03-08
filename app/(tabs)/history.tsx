import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { usePremium } from '../../contexts/PremiumContext';

const { width } = Dimensions.get('window');
const HISTORY_KEY = '@fdu_history';
const DEVICE_ID_KEY = '@device_id';

// URL de Producción
const API_BASE_URL = 'https://logiq-production.up.railway.app/api';

interface Decision {
  id: string;
  category: string;
  context: string;
  ai_report: string;
  result: {
    score: number;
    status: string;
  };
  chat_history: Array<{ user?: string; ai?: string; timestamp?: string }>;
  created_at: string;
  _allIds?: string[];
}

interface ChatMessage {
  user?: string;
  ai?: string;
  timestamp?: string;
}

const deduplicate = (history: Decision[]): Decision[] => {
  const sorted = [...history].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const groups: Decision[] = [];

  if (sorted.length === 0) return [];

  let current: Decision = { ...sorted[0], _allIds: [sorted[0].id] };

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].created_at).getTime();
    const currTime = new Date(sorted[i].created_at).getTime();
    const timeDiff = currTime - prevTime < 5 * 60 * 1000 && sorted[i].category === sorted[i - 1].category;

    if (timeDiff) {
      current._allIds!.push(sorted[i].id);
      current.ai_report = sorted[i].ai_report || current.ai_report;
      current.chat_history = [...current.chat_history, ...sorted[i].chat_history];
      if (current.chat_history.length > 0 && current.chat_history.every(m => m.timestamp)) {
        current.chat_history.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
      }
      current.context = current.context || sorted[i].context;
      current.result = sorted[i].result || current.result;
      current.created_at = sorted[i].created_at;
      current.id = sorted[i].id;
    } else {
      groups.push(current);
      current = { ...sorted[i], _allIds: [sorted[i].id] };
    }
  }

  groups.push(current);

  // Sort descending for display (latest first)
  groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return groups;
};

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPremium } = usePremium();
  const [history, setHistory] = useState<Decision[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatMessage[]>([]);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReportItem, setSelectedReportItem] = useState<Decision | null>(null);

  const copyToClipboard = async (text: string, score?: number) => {
    const fullText = score ? `FDU Score: ${score.toFixed(1)}\n\n${text}` : text;
    await Clipboard.setStringAsync(fullText);
    Alert.alert(t('COPIED_TITLE') || 'Copiado', t('COPIED_MESSAGE') || 'Reporte copiado al portapapeles.');
  };

  const getDeviceId = async (): Promise<string> => {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      return deviceId.trim();
    } catch (e) {
      console.error('❌ Error getting device_id:', e);
      return 'fallback_device_id';
    }
  };

  const loadHistory = async () => {
    setRefreshing(true);
    try {
      const deviceId = await getDeviceId();

      // Intentar cargar desde servidor
      try {
        const url = `${API_BASE_URL}/decisions/${deviceId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.decisions)) {
            const deduped = deduplicate(data.decisions);
            setHistory(deduped);
            await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(data.decisions)); // Save raw for fallback
            return;
          }
        }
      } catch (networkError) {
        console.error('❌ Error de red al cargar historial:', networkError);
      }

      // Fallback a cache local
      const cachedData = await AsyncStorage.getItem(HISTORY_KEY);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const deduped = deduplicate(parsed);
        setHistory(deduped);
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.error('❌ Error crítico cargando historial:', e);
      setHistory([]);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const handleClearAll = async () => {
    // Definimos los textos usando tus traducciones
    const title = t('HISTORY_CLEAR_ALL_TITLE') || 'Borrar todo';
    const message = t('CONFIRM_DELETE_MESSAGE') || '¿Estás seguro? Esta acción eliminará todos tus datos permanentemente.';

    // Función que hace el trabajo sucio (tu lógica original)
    const performPurge = async () => {
      setIsDeleting(true);
      try {
        const deviceId = await getDeviceId();
        const url = `${API_BASE_URL}/user/purge/${deviceId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setHistory([]);
            await AsyncStorage.removeItem(HISTORY_KEY);
            // Alerta de éxito compatible con Web y Móvil
            if (typeof window !== 'undefined' && window.alert) {
              window.alert((t('SUCCESS_TITLE') || '✅ Éxito') + '\n' + (t('SUCCESS_DELETE_MESSAGE') || `Eliminados: ${data.deleted_decisions || 0} decisiones`));
            } else {
              Alert.alert(t('SUCCESS_TITLE') || '✅ Éxito', t('SUCCESS_DELETE_MESSAGE') || `Eliminados: ${data.deleted_decisions || 0} decisiones`);
            }
          } else {
            if (typeof window !== 'undefined' && window.alert) {
              window.alert('Error\nEl servidor no confirmó el borrado.');
            } else {
              Alert.alert('Error', 'El servidor no confirmó el borrado.');
            }
          }
        } else {
          const errorText = await response.text();
          if (typeof window !== 'undefined' && window.alert) {
            window.alert(`Error de Conexión\nNo se pudo borrar. Status: ${response.status}\n\nDetalle: ${errorText.substring(0, 200)}`);
          } else {
            Alert.alert('Error de Conexión', `No se pudo borrar. Status: ${response.status}\n\nDetalle: ${errorText.substring(0, 200)}`);
          }
        }
      } catch (error: any) {
        console.error('❌ Error:', error);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(`Error\nNo se pudo conectar con el servidor.\n\nDetalle: ${error.message}`);
        } else {
          Alert.alert('Error', `No se pudo conectar con el servidor.\n\nDetalle: ${error.message}`);
        }
      } finally {
        setIsDeleting(false);
      }
    };

    // DETECTOR DE PLATAFORMA: Si es Web, usa confirm() / Si es Móvil, usa Alert.alert()
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`${title}\n${message}`)) {
        await performPurge();
      }
    } else {
      Alert.alert(title, message, [
        { text: t('BTN_CANCEL') || 'Cancelar', style: 'cancel' },
        { text: t('HISTORY_CLEAR_ALL_CONFIRM_BUTTON') || 'Eliminar todo', style: 'destructive', onPress: performPurge },
      ]);
    }
  };

  const handleDeleteItem = async (item: Decision) => {
    const title = t('HISTORY_DELETE_ONE_TITLE') || 'Eliminar';
    const message = t('DELETE_ITEM_MESSAGE') || '¿Eliminar esta decisión?';

    const itemId = item.id;
    const idsToDelete = item._allIds || [itemId];

    const performDelete = async () => {
      try {
        // Optimistic UI update
        const updatedHistory = history.filter((i) => i.id !== itemId);
        setHistory(updatedHistory);
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory)); // Save current state (deduped)

        // Delete each ID from server
        for (const id of idsToDelete) {
          const url = `${API_BASE_URL}/decisions/delete/${id.trim()}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) {
            console.error(`⚠️ Servidor no confirmó eliminación para ID: ${id}`);
          }
        }
      } catch (error) {
        console.error('❌ Error al eliminar item:', error);
        // Revertir en caso de fallo de red
        await loadHistory();
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('Error\nNo se pudo eliminar. Se restauró el historial.');
        } else {
          Alert.alert('Error', 'No se pudo eliminar. Se restauró el historial.');
        }
      }
    };

    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`${title}\n${message}`)) {
        await performDelete();
      }
    } else {
      Alert.alert(title, message, [
        { text: t('BTN_CANCEL') || 'Cancelar', style: 'cancel' },
        { text: t('BTN_CONFIRM') || 'Eliminar', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  const handleOpenChatModal = (chatHistory: Array<{ user?: string; ai?: string; timestamp?: string }>) => {
    setSelectedChat(chatHistory);
    setModalVisible(true);
  };

  const getStatusColor = (score: number) => {
    if (score <= 40) return '#FF4757';
    if (score <= 70) return '#FFA502';
    return '#2ED573';
  };

  // Move to a memoized component for performance
  const HistoryItem = React.memo(({ item, index }: { item: Decision; index: number }) => {
    const score = item.result?.score ?? 0;
    const color = getStatusColor(score);
    const date = new Date(item.created_at);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const hasChatHistory = item.chat_history && item.chat_history.length > 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: '#3498DB' }]}>
            <Ionicons name="briefcase-outline" size={14} color="#FFF" />
            <Text style={styles.badgeText}>{t(`TAB_${item.category?.toUpperCase()}`)}</Text>
          </View>
          <Text style={styles.dateText}>
            {dateStr} {timeStr}
          </Text>
          <TouchableOpacity
            style={{ padding: 10 }}
            onPress={() => handleDeleteItem(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#A4B0BE" />
          </TouchableOpacity>
        </View>

        <View style={styles.scoreBody}>
          <Text style={styles.fduLabel}>{t('RESULT_SCORE')}</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.bigScore, { color }]}>{score.toFixed(1)}</Text>
            <View style={[styles.statusPill, { backgroundColor: color }]}>
              <Text style={styles.statusPillText}>
                {score <= 40 ? t('RISK_HIGH') : score <= 70 ? t('RISK_MED') : t('RISK_LOW')}
              </Text>
            </View>
          </View>
        </View>

        {hasChatHistory && (
          <TouchableOpacity
            style={styles.chatIndicator}
            onPress={() => handleOpenChatModal(item.chat_history)}
          >
            <Ionicons name="chatbubbles-outline" size={16} color="#3498DB" />
            <Text style={styles.chatIndicatorText}>
              {t('VIEW_CONVERSATION') || 'Ver conversación'} ({item.chat_history.length})
            </Text>
          </TouchableOpacity>
        )}

        {item.ai_report && (
          <TouchableOpacity
            style={styles.reportIndicator}
            onPress={() => {
              console.log("Opening AI Report Modal for item:", item.id);
              setSelectedReportItem(item);
              setReportModalVisible(true);
            }}
          >
            <Ionicons name="ribbon-outline" size={16} color="#F1C40F" />
            <Text style={styles.reportIndicatorText}>
              {t('BTN_AI_REPORT') || 'Ver reporte IA'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  });

  const renderItem = useCallback(({ item, index }: { item: Decision; index: number }) => (
    <HistoryItem item={item} index={index} />
  ), [HistoryItem]);

  const renderChatMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    return (
      <View key={`chat-group-${index}`} style={styles.chatMessageWrapper}>
        {/* 1. User Message (Right) */}
        {item.user && (
          <View style={[styles.chatMessageContainer, styles.userMessageContainer]}>
            <View style={[styles.chatBubble, styles.userBubble, styles.elevatedBubble]}>
              <Text style={[styles.chatMessageText, styles.userMessageText]}>
                {item.user}
              </Text>
              {item.timestamp && (
                <Text style={[styles.chatTimestamp, styles.userTimestamp]}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
            <View style={styles.userAvatarSmall}>
              <Ionicons name="person" size={12} color="#FFF" />
            </View>
          </View>
        )}

        {/* 2. AI Message (Left) */}
        {item.ai && (
          <View style={[styles.chatMessageContainer, styles.aiMessageContainer]}>
            <View style={styles.aiAvatarSmall}>
              <MaterialCommunityIcons name="robot" size={12} color="#FFF" />
            </View>
            <View style={[styles.chatBubble, styles.aiBubble, styles.elevatedBubble]}>
              <Text style={[styles.chatMessageText, styles.aiMessageText]}>
                {item.ai}
              </Text>
              {item.timestamp && (
                <Text style={[styles.chatTimestamp, styles.aiTimestamp]}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>{t('P_TITULO_HIS') || 'Historial'}</Text>
          {isPremium && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.clearAllBtn, isDeleting && { opacity: 0.5 }]}
          onPress={handleClearAll}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#FF4757" />
          ) : (
            <>
              <Ionicons name="trash" size={16} color="#FF4757" />
              <Text style={styles.clearAllText}>{t('BTN_CLEAR_ALL') || 'Borrar todo'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={loadHistory}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="bulb-outline" size={80} color="#3498DB" />
            </View>
            <Text style={styles.emptyTitle}>{t('HISTORY_EMPTY_PROMPT_TITLE') || 'Tu próxima gran decisión comienza aquí'}</Text>
            <Text style={styles.emptySubtext}>
              {t('HISTORY_EMPTY_PROMPT_SUBTITLE') || 'Audita tu primer proyecto con el motor FDU.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/business')}
            >
              <Text style={styles.emptyButtonText}>{t('BTN_START_FIRST_AUDIT') || 'Comenzar Auditoría'}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Modal de Chat */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="chatbubbles" size={24} color="#3498DB" />
                <Text style={styles.modalTitle}>{t('CHAT_HISTORY_TITLE') || 'Historial de Conversación'}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#A4B0BE" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {selectedChat.length > 0 ? (
                selectedChat.map((msg, index) => (
                  <View key={index}>{renderChatMessage({ item: msg, index })}</View>
                ))
              ) : (
                <View style={styles.emptyChatContainer}>
                  <Ionicons name="chatbubble-outline" size={40} color="#DCDDE1" />
                  <Text style={styles.emptyChatText}>{t('NO_MESSAGES') || 'No hay mensajes'}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButtonText}>{t('BTN_CLOSE') || 'Cerrar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Reporte IA */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="ribbon" size={24} color="#F1C40F" />
                <Text style={styles.modalTitle}>{t('AI_REPORT_TITLE') || 'Reporte IA'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {selectedReportItem && (
                  <TouchableOpacity
                    onPress={() => copyToClipboard(selectedReportItem.ai_report, selectedReportItem.result.score)}
                    style={{ marginRight: 15 }}
                  >
                    <Ionicons name="copy-outline" size={24} color="#3498DB" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color="#A4B0BE" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.chatScrollContent}>
              {selectedReportItem && (
                <View>
                  {/* FDU Score Bubble */}
                  <View style={[styles.chatMessageContainer, styles.aiMessageContainer]}>
                    <View style={styles.aiAvatarSmall}>
                      <MaterialCommunityIcons name="shield-check" size={12} color="#FFF" />
                    </View>
                    <View style={[styles.chatBubble, styles.aiBubble, styles.elevatedBubble, { borderColor: getStatusColor(selectedReportItem.result.score) }]}>
                      <Text style={styles.fduLabel}>{t('RESULT_SCORE')}</Text>
                      <Text style={[styles.bigScore, { color: getStatusColor(selectedReportItem.result.score), fontSize: 32 }]}>
                        {selectedReportItem.result.score.toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  {/* Diagnosis Bubble */}
                  <View style={[styles.chatMessageContainer, styles.aiMessageContainer]}>
                    <View style={styles.aiAvatarSmall}>
                      <MaterialCommunityIcons name="robot" size={12} color="#FFF" />
                    </View>
                    <View style={[styles.chatBubble, styles.aiBubble, styles.elevatedBubble]}>
                      <Text style={[styles.chatMessageText, styles.aiMessageText]}>
                        {selectedReportItem.ai_report}
                      </Text>
                      <Text style={[styles.chatTimestamp, styles.aiTimestamp]}>
                        {new Date(selectedReportItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.closeButtonText}>{t('BTN_CLOSE') || 'Cerrar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F2F6' },
  header: {
    backgroundColor: '#2C3E50',
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  clearAllText: { color: '#FF4757', fontWeight: 'bold', fontSize: 12, marginLeft: 5 },
  listPadding: { padding: 15 },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  dateText: { color: '#A4B0BE', fontSize: 11, fontWeight: '600' },
  scoreBody: { alignItems: 'center', marginBottom: 15 },
  fduLabel: { fontSize: 12, color: '#747D8C', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  bigScore: { fontSize: 48, fontWeight: '900', marginRight: 10 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  chatIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4F8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB'
  },
  chatIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3498DB',
    marginLeft: 6
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconContainer: {
    backgroundColor: '#EBF5FB',
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#2C3E50',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12
  },
  emptySubtext: { color: '#7F8C8D', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  emptyButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '85%',
    paddingTop: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F6',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    marginLeft: 12,
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatScrollContent: {
    padding: 20,
  },
  chatMessageWrapper: {
    marginBottom: 20,
  },
  chatMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  elevatedBubble: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4,
    marginRight: 8,
  },
  aiBubble: {
    backgroundColor: '#F8FAFC',
    borderBottomLeftRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#818CF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatMessageText: {
    fontSize: 14,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: '#1E293B',
  },
  chatTimestamp: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: '600',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'right',
  },
  aiTimestamp: {
    color: '#94A3B8',
  },
  emptyChatContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyChatText: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 12,
    fontWeight: '500',
  },
  modalFooter: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F2F6',
  },
  closeButton: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  proBadge: {
    backgroundColor: '#F1C40F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  proBadgeText: {
    color: '#2C3E50',
    fontSize: 10,
    fontWeight: '900',
  },

  contextSection: {
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2F3542',
    marginBottom: 5,
  },
  contextText: {
    fontSize: 13,
    color: '#57606F',
    lineHeight: 18,
  },
  reportIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4F8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3498DB'
  },
  reportIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3498DB',
    marginLeft: 6
  },
  reportContent: {
    padding: 15,
    backgroundColor: '#F1F2F6',
    borderRadius: 10,
  },
  reportTextContent: {
    fontSize: 14,
    color: '#2C3E50',
    lineHeight: 22,
  },
  reportSnippet: {
    marginTop: 10,
    marginBottom: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F1F2F6',
    borderRadius: 8,
  },
  reportSnippetText: {
    fontSize: 13,
    color: '#57606F',
    lineHeight: 18,
  },
});