// profile.ts - User Profile, Achievements, and Settings Logic

import * as state from './state';
import { $, showAchievementModal } from './ui';
import { logout } from './auth';
import { getCompletedWorkouts, getWeekProgress } from './progress';

// --- ACHIEVEMENTS ---

// FIX: Define and export the checkAndUnlockAchievement function to resolve import errors.
type AchievementKey =
    | 'ONBOARDING_COMPLETE'
    | 'FIRST_WORKOUT'
    | 'WORKOUT_STREAK_3'
    | 'RECIPE_EXPLORER'
    | 'AI_CHAT_START'
    | 'GOAL_SETTER'
    | 'CYCLE_LOG_FIRST';

interface Achievement {
    id: AchievementKey;
    title: string;
    description: string;
}

const ALL_ACHIEVEMENTS: Record<AchievementKey, Achievement> = {
    ONBOARDING_COMPLETE: { id: 'ONBOARDING_COMPLETE', title: 'Добро пожаловать!', description: 'Вы завершили настройку своего профиля.' },
    FIRST_WORKOUT: { id: 'FIRST_WORKOUT', title: 'Первый шаг сделан', description: 'Вы завершили свою первую тренировку.' },
    WORKOUT_STREAK_3: { id: 'WORKOUT_STREAK_3', title: 'Сила привычки', description: 'Вы тренировались 3 дня подряд.' },
    RECIPE_EXPLORER: { id: 'RECIPE_EXPLORER', title: 'Кулинарный исследователь', description: 'Вы просмотрели свой первый рецепт.' },
    AI_CHAT_START: { id: 'AI_CHAT_START', title: 'Разговор по душам', description: 'Вы начали свой первый чат с AI-тренером.' },
    GOAL_SETTER: { id: 'GOAL_SETTER', title: 'Цель поставлена', description: 'Вы установили свою первую фитнес-цель.' },
    CYCLE_LOG_FIRST: { id: 'CYCLE_LOG_FIRST', title: 'В гармонии с собой', description: 'Вы сделали свою первую запись в календаре цикла.' }
};

/**
 * Checks if an achievement has been unlocked. If not, unlocks it and shows a notification.
 * @param key The key of the achievement to check.
 */
export function checkAndUnlockAchievement(key: AchievementKey) {
    const unlockedRaw = localStorage.getItem(state.ACHIEVEMENTS_KEY);
    const unlocked: Set<AchievementKey> = unlockedRaw ? new Set(JSON.parse(unlockedRaw)) : new Set();

    if (!unlocked.has(key)) {
        const achievement = ALL_ACHIEVEMENTS[key];
        if (achievement) {
            unlocked.add(key);
            localStorage.setItem(state.ACHIEVEMENTS_KEY, JSON.stringify(Array.from(unlocked)));
            showAchievementModal(achievement);
        }
    }
}

/**
 * Generates HTML for the weekly progress chart bars.
 * @param dailyCounts An array of workout counts for each day of the week (Mon-Sun).
 * @returns An HTML string of chart bars.
 */
function generateChartBars(dailyCounts: number[]): string {
    const maxCount = Math.max(...dailyCounts, 1); // Use 1 as minimum to avoid division by zero
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return dailyCounts.map((count, index) => {
        const height = (count / maxCount) * 100;
        return `
            <div class="chart-bar-wrapper">
              <div class="chart-bar" style="height: ${height}%;" title="${count} тренировок"></div>
              <div class="chart-label">${days[index]}</div>
            </div>`;
    }).join('');
}

/**
 * Renders the user's profile page, including stats and achievements.
 */
export function renderProfilePage(setState?: (newState: Partial<state.AppState>) => void) {
    const container = $('#profile-page .page-content');
    if (!container) return;

    const profileRaw = localStorage.getItem(state.USER_PROFILE_KEY);
    const profile: state.UserProfile | null = profileRaw ? JSON.parse(profileRaw) : null;
    const name = profile?.name || 'Пользователь';
    
    const completedWorkouts = getCompletedWorkouts();
    const weekProgress = getWeekProgress(completedWorkouts);

    let progressHtml;
    if (weekProgress.totalWorkouts === 0) {
        progressHtml = `
            <div class="profile-section empty-state-card">
                <i class="fas fa-chart-line"></i>
                <h3>Ваш прогресс появится здесь</h3>
                <p>Завершите свою первую тренировку, чтобы увидеть статистику за неделю и красивый график ваших достижений.</p>
            </div>
        `;
    } else {
        progressHtml = `
            <div class="profile-section">
                <h3>Обзор недели</h3>
                <div class="overview-stats">
                    <div class="progress-stat">
                        <span class="value">${weekProgress.totalWorkouts}</span>
                        <span class="label">Тренировок</span>
                    </div>
                    <div class="progress-stat">
                        <span class="value">${weekProgress.totalTimeFormatted}</span>
                        <span class="label">Время</span>
                    </div>
                    <div class="progress-stat">
                        <span class="value">${weekProgress.totalCalories}</span>
                        <span class="label">Ккал</span>
                    </div>
                </div>
            </div>
            
            <div class="profile-section progress-chart">
                <h3>Ваш прогресс</h3>
                <div class="tabs">
                    <button class="tab-btn active" data-period="week">Неделя</button>
                    <button class="tab-btn" data-period="month">Месяц</button>
                </div>
                <div class="chart-container">
                    ${generateChartBars(weekProgress.dailyCounts)}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="profile-header">
            <div class="avatar-placeholder">${name.charAt(0).toUpperCase()}</div>
            <h2>${name}</h2>
            <p>В AhavatFit с мая 2024</p>
        </div>

        ${progressHtml}

        <div class="profile-section">
            <h3>Инструменты и ресурсы</h3>
            <a href="#" class="profile-link quick-link" data-page="programs">
                <span><i class="fa-regular fa-map"></i> Программы тренировок</span>
                <i class="fas fa-chevron-right"></i>
            </a>
            <a href="#" class="profile-link quick-link" data-page="ai-coach">
                <span><i class="fa-regular fa-robot"></i> AI-тренер Амина</span>
                <i class="fas fa-chevron-right"></i>
            </a>
            <a href="#" class="profile-link quick-link" data-page="serenity">
                <span><i class="fa-regular fa-spa"></i> Моменты для души</span>
                <i class="fas fa-chevron-right"></i>
            </a>
             <a href="#" class="profile-link quick-link" data-page="cycle">
                <span><i class="fa-regular fa-droplet"></i> Календарь цикла</span>
                <i class="fas fa-chevron-right"></i>
            </a>
             <a href="#" class="profile-link quick-link" data-page="admin">
                <span><i class="fa-regular fa-user-shield"></i> Панель администратора</span>
                <i class="fas fa-chevron-right"></i>
            </a>
        </div>

        <div class="profile-section">
            <h3>Внешний вид и звук</h3>
            <div class="settings-item">
                <label for="dark-mode-toggle">Тёмная тема</label>
                <label class="switch">
                    <input type="checkbox" id="dark-mode-toggle">
                    <span class="slider round"></span>
                </label>
            </div>
             <div class="settings-item">
                <label for="voice-response-toggle">Голосовые ответы AI</label>
                <label class="switch">
                    <input type="checkbox" id="voice-response-toggle">
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
        
        <a href="#" class="profile-link">
            <span><i class="far fa-question-circle"></i> Помощь и поддержка</span>
            <i class="fas fa-chevron-right"></i>
        </a>
        <a href="#" class="profile-link">
            <span><i class="far fa-star"></i> Отправить отзыв</span>
            <i class="fas fa-chevron-right"></i>
        </a>
        
        <button id="logout-btn" class="btn btn-danger">Выйти</button>
    `;

    // Set toggle states
    const darkModeToggle = $<HTMLInputElement>('#dark-mode-toggle');
    if(darkModeToggle) darkModeToggle.checked = document.body.classList.contains('dark-mode');
    
    const voiceToggle = $<HTMLInputElement>('#voice-response-toggle');
    if(voiceToggle) voiceToggle.checked = localStorage.getItem('voice-response-enabled') === 'true';

    // Add event listeners
    $('#logout-btn')?.addEventListener('click', logout);
    $('#set-goal-btn')?.addEventListener('click', () => {
        const modal = $('#goal-form-modal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        }
    });
    
    state.globalUIState.profilePageInitialized = true;
}

function generatePrayerSetting(prayerName: string, label: string): string {
    return `
        <div class="settings-item">
            <label>${label}</label>
            <div style="display: flex; align-items: center; gap: 10px;">
                <select class="form-select" style="width: auto;">
                    <option>В момент наступления</option>
                    <option>За 5 минут</option>
                    <option>За 10 минут</option>
                </select>
                <label class="switch">
                    <input type="checkbox" id="prayer-toggle-${prayerName}">
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
    `;
}

function generateColorSetting(phase: string, label: string, defaultColor: string): string {
    return `
        <div class="color-input-group">
            <input type="color" id="color-${phase}" class="color-input" value="${defaultColor}">
            <label for="color-${phase}">${label}</label>
        </div>
    `;
}