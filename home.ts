// home.ts - Home Page Logic for AhavatFit

import * as state from './state';
import { $ } from './ui';
import { getCompletedWorkouts, calculateCurrentStreak, getWeekProgress, getGoalProgress } from './progress';
import { generateTodaysPlanAI } from './ai';
import { getCycleData, getDayPhase } from './cycle';
import { getWorkoutForToday } from './programs';

/**
 * Fetches prayer times from an API and renders them. Caches results for the day.
 * @param container The HTML element to render the prayer times into.
 */
async function fetchAndRenderPrayerTimes(container: HTMLElement) {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `prayer_times_${today}`;
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
        renderPrayerTimes(JSON.parse(cachedData), container);
        return;
    }
    
    // Default city: Moscow. In a full app, this might use geolocation.
    const url = `https://api.aladhan.com/v1/timingsByCity?city=Moscow&country=Russia&method=2`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch prayer times');
        const data = await response.json();
        
        if (data && data.data && data.data.timings) {
            const prayerTimes = data.data.timings;
            sessionStorage.setItem(cacheKey, JSON.stringify(prayerTimes));
            renderPrayerTimes(prayerTimes, container);
        } else {
            throw new Error('Invalid data structure from prayer times API');
        }
    } catch (error) {
        console.error("Error fetching prayer times:", error);
        container.innerHTML = `<p style="text-align: center; font-size: 0.9rem; color: #888;">Не удалось загрузить время намазов.</p>`;
    }
}

/**
 * Renders the prayer times and highlights the next upcoming one.
 * @param times A record of prayer names and their times (HH:MM).
 * @param container The HTML element to render into.
 */
function renderPrayerTimes(times: Record<string, string>, container: HTMLElement) {
    const prayersToShow = { Fajr: 'Фаджр', Dhuhr: 'Зухр', Asr: 'Аср', Maghrib: 'Магриб', Isha: 'Иша' };
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    let nextPrayerFound = false;
    
    const prayerEntries = Object.entries(prayersToShow)
        .map(([apiName, displayName]) => ({ apiName, displayName, time: times[apiName] }))
        .filter(p => p.time) // Ensure time is available
        .sort((a, b) => a.time.localeCompare(b.time));

    let html = '';
    for (const prayer of prayerEntries) {
        let isCurrent = false;
        if (!nextPrayerFound && prayer.time > currentTime) {
            isCurrent = true;
            nextPrayerFound = true;
        }
        html += `
            <div class="prayer-time ${isCurrent ? 'current' : ''}">
                <span class="name">${prayer.displayName}</span>
                <span class="time">${prayer.time}</span>
            </div>
        `;
    }

    // If all prayers for today have passed, highlight the first prayer of the day (implying for tomorrow).
    if (!nextPrayerFound && prayerEntries.length > 0) {
        const firstPrayerApiName = prayerEntries[0].apiName;
        html = prayerEntries.map(p => `
            <div class="prayer-time ${p.apiName === firstPrayerApiName ? 'current' : ''}">
                <span class="name">${p.displayName}</span>
                <span class="time">${p.time}</span>
            </div>
        `).join('');
    }

    container.innerHTML = html;
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 5) return "Спокойной ночи";
    if (hour < 12) return "Доброе утро";
    if (hour < 18) return "Доброго дня";
    return "Доброго вечера";
}

function renderProgressRing(percentage: number, label: string): string {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return `
        <div class="progress-ring-stat">
            <svg class="progress-ring" width="100" height="100" viewBox="0 0 100 100">
                <circle class="progress-ring__bg" r="${radius}" cx="50" cy="50" stroke-width="10"/>
                <circle class="progress-ring__circle" r="${radius}" cx="50" cy="50" stroke-width="10"
                    stroke-dasharray="${circumference} ${circumference}"
                    style="stroke-dashoffset: ${offset}"
                />
            </svg>
            <div class="progress-ring__text">
                <span class="value">${percentage}%</span>
            </div>
            <span class="label">${label}</span>
        </div>
    `;
}


/**
 * Renders the content for the home page dashboard. Now non-blocking.
 */
export function renderHomePage(setState?: (newState: Partial<state.AppState>) => void) {
    const container = $('#home-page .page-content');
    if (!container) return;

    let profile: state.UserProfile | null = null;
    try {
        const profileRaw = localStorage.getItem(state.USER_PROFILE_KEY);
        profile = profileRaw ? JSON.parse(profileRaw) : null;
    } catch (e) {
        console.error("Failed to parse user profile from localStorage", e);
        localStorage.removeItem(state.USER_PROFILE_KEY); // Clear corrupted data
    }
    const name = profile?.name ? `, ${profile.name}` : '';

    const completedWorkouts = getCompletedWorkouts();
    const weekProgress = getWeekProgress(completedWorkouts);
    const progress = {
        trainings: completedWorkouts.length,
        streak: calculateCurrentStreak(completedWorkouts),
        goalPercent: getGoalProgress(weekProgress)
    };
    
    const greeting = getGreeting();
    
    let progressSummaryHtml;
    if (completedWorkouts.length === 0) {
        progressSummaryHtml = `
         <div class="card empty-state-card">
            <i class="fas fa-feather-alt"></i>
            <h3>Начните свой путь</h3>
            <p>Каждое великое путешествие начинается с первого шага. Завершите свою первую тренировку, чтобы увидеть здесь свой прогресс.</p>
        </div>`;
    } else {
         progressSummaryHtml = `
         <div class="card progress-summary-card">
            <div class="progress-stat">
                <span class="value">${progress.trainings}</span>
                <span class="label">тренировок</span>
            </div>
            <div class="progress-stat">
                <span class="value">${progress.streak}</span>
                <span class="label">дней подряд</span>
            </div>
            ${renderProgressRing(progress.goalPercent, "цель")}
        </div>`;
    }

    container.innerHTML = `
        <h2>${greeting}${name}!</h2>
        <p>Начните свой день с заботы о себе.</p>

        <div id="todays-plan-container">
             <div class="card skeleton" style="height: 220px;"></div>
        </div>

        <div class="card prayer-times-card" id="prayer-times-container">
            <div class="spinner" style="width:20px; height:20px; border-width: 3px; margin: 1rem auto;"></div>
        </div>

        ${progressSummaryHtml}

        <div class="card dua-card">
            <h4><i class="fas fa-praying-hands"></i> Дуа для здоровья</h4>
            <p class="arabic">اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ</p>
            <p class="translation">О Аллах, поистине, я прошу у Тебя благополучия в мире этом и в мире ином.</p>
            <p class="source">Сунан Абу Дауда</p>
        </div>
    `;
    
    // Fetch and render dynamic data in the background (fire and forget)
    const prayerContainer = $('#prayer-times-container');
    if (prayerContainer) {
        fetchAndRenderPrayerTimes(prayerContainer);
    }
    renderTodaysPlan();
    
    state.globalUIState.homePageInitialized = true;
}

/**
 * Phase VII: Fetches and renders the proactive AI "Plan for Today", now with more context.
 */
async function renderTodaysPlan() {
    const container = $('#todays-plan-container');
    if(!container) return;

    try {
        // Gather all available context about the user
        const todayStr = new Date().toISOString().split('T')[0];
        const allLogs = JSON.parse(localStorage.getItem(state.CYCLE_LOG_DATA_KEY) || '{}');
        const cycleData = getCycleData();
        const phaseInfo = getDayPhase(todayStr, cycleData, allLogs);
        const goal = JSON.parse(localStorage.getItem(state.USER_GOAL_KEY) || 'null');
        const profile = JSON.parse(localStorage.getItem(state.USER_PROFILE_KEY) || 'null');
        
        // Phase VII additions: Get program and symptom context
        const todaysProgramWorkout = await getWorkoutForToday();
        const todaysLog = allLogs[todayStr];
        const cycleSymptoms = todaysLog ? [...(todaysLog.symptoms || []), ...(todaysLog.mood ? [todaysLog.mood] : [])] : [];

        const plan = await generateTodaysPlanAI({
            profile,
            phase: phaseInfo,
            goal,
            todaysProgramWorkout,
            cycleSymptoms
        });
        
        container.innerHTML = `
            <div class="card todays-plan-card">
                <h3>План на сегодня</h3>
                <div class="plan-item">
                    <div class="icon">${plan.workoutSuggestion.emoji}</div>
                    <div class="content">
                        <h4>${plan.workoutSuggestion.title}</h4>
                        <p>${plan.workoutSuggestion.reason}</p>
                    </div>
                </div>
                 <div class="plan-item">
                    <div class="icon">${plan.nutritionTip.emoji}</div>
                    <div class="content">
                        <h4>${plan.nutritionTip.title}</h4>
                        <p>${plan.nutritionTip.reason}</p>
                    </div>
                </div>
                 <div class="plan-item">
                    <div class="icon">${plan.mindfulMoment.emoji}</div>
                    <div class="content">
                        <h4>${plan.mindfulMoment.title}</h4>
                        <p>${plan.mindfulMoment.reason}</p>
                    </div>
                </div>
            </div>
        `;
    } catch(error) {
        console.error("Failed to render Today's Plan:", error);
        // Fallback to a simpler, static card if AI fails
        container.innerHTML = `
            <div class="card featured-workout-card breathing-element quick-link" data-page="workouts">
                <h3><i class="fas fa-crown"></i> Комплексная тренировка</h3>
                <p>Начните свой путь к здоровью с нашей популярной тренировки на все тело.</p>
            </div>`;
    }
}