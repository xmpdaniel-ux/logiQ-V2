import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configuración de comportamiento de notificaciones
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    return finalStatus === 'granted';
};

export const scheduleStrategicReminder = async (language: string = 'en') => {
    // Limpiar recordatorios previos para evitar spam
    await Notifications.cancelAllScheduledNotificationsAsync();

    const content = {
        en: {
            title: '💡 New project in mind?',
            body: 'Audit it now with the FDU motor and decide with confidence.',
        },
        es: {
            title: '💡 ¿Nuevo proyecto en mente?',
            body: 'Audítalo ahora con el motor FDU y decide con total confianza.',
        },
        pt: {
            title: '💡 Novo projeto em mente?',
            body: 'Audite-o agora com o motor FDU e decida com confiança.',
        },
        fr: {
            title: '💡 Nouveau projet en tête?',
            body: 'Auditez-le maintenant avec le moteur FDU et décidez en confiance.',
        }
    };

    const selectedContent = content[language as keyof typeof content] || content.en;

    // Programar a las 24 horas si no ha vuelto a entrar
    await Notifications.scheduleNotificationAsync({
        content: {
            title: selectedContent.title,
            body: selectedContent.body,
            sound: true,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 24 * 60 * 60, // 24 horas
        },
    });
};
