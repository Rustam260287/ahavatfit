// notifications.ts - Prayer Time Notification Scheduler

import * as state from './state';
import { sendNotification } from './ui';
import { getCycleData, getDayPhase } from './cycle';

let notificationIntervalId: number | null = null;
const PRAYER_NAMES = {
    fajr: 'Фаджр',
    dhuhr: 'Зухр',
    asr: 'Аср',
    maghrib: 'Магриб',
    isha: 'Иша'
};

/**
 * Starts the notification scheduler which checks every minute.
 */
export function startNotificationScheduler() {
    if (notificationIntervalId) {
        clearInterval(notificationIntervalId);
    }
    const settingsRaw = localStorage.getItem(state.PRAYER_SETTINGS_KEY);
    const settings = settingsRaw ? JSON.parse(settingsRaw) : { enabled: false };

    if (!settings.enabled) {
        return;
    }

    // Run once immediately, then schedule
    checkAndSendNotifications();
    notificationIntervalId = window.setInterval(checkAndSendNotifications, 60000); // Check every minute
}

/**
 * Stops the notification scheduler.
 */
export function stopNotificationScheduler() {
    if (notificationIntervalId) {
        clearInterval(notificationIntervalId);
        notificationIntervalId = null;
    }
}

/**
 * Checks if a prayer notification needs to be sent at the current time.
 * This function is the core of the scheduler interval.
 */
async function checkAndSendNotifications() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // 1. Check if user is currently menstruating
    const allLogs = JSON.parse(localStorage.getItem(state.CYCLE_LOG_DATA_KEY) || '{}');
    const cycleData = getCycleData();
    const phaseInfo = getDayPhase(todayStr, cycleData, allLogs);
    if (phaseInfo.phase === 'menstruation') {
        return; // Do not send prayer notifications during menstruation
    }

    // 2. Get prayer settings
    const settingsRaw = localStorage.getItem(state.PRAYER_SETTINGS_KEY);
    if (!settingsRaw) return;
    const settings = JSON.parse(settingsRaw);
    if (!settings.enabled) return;

    // 3. Check if a notification for this prayer time has already been sent today
    const sentTodayRaw = sessionStorage.getItem(`sent_notifications_${todayStr}`);
    const sentToday: string[] = sentTodayRaw ? JSON.parse(sentTodayRaw) : [];

    // 4. Iterate through prayer times and send notification if it's time
    for (const prayer of Object.keys(PRAYER_NAMES) as Array<keyof typeof PRAYER_NAMES>) {
        if (settings[prayer] === currentTime && !sentToday.includes(prayer)) {
            await sendNotification('Время намаза', `Наступило время молитвы ${PRAYER_NAMES[prayer]}.`);
            sentToday.push(prayer);
            sessionStorage.setItem(`sent_notifications_${todayStr}`, JSON.stringify(sentToday));
            break; // Only send one notification per minute check
        }
    }
}


/**
 * Handles logic for when a user marks the start of their period.
 */
export async function handlePeriodStart() {
    stopNotificationScheduler();
    await sendNotification(
        'Духовное напоминание', 
        'Сегодня день для размышлений и дуа. Уделите время чтению Корана или зикру.'
    );
}

/**
 * Handles logic for when a user marks the end of their period.
 */
export async function handlePeriodEnd() {
    await sendNotification(
        'Намаз возобновлен', 
        'Время для намаза вернулось! Начните с Фаджр и обновите свою духовную энергию.'
    );
    startNotificationScheduler(); // Restart the scheduler immediately
}
