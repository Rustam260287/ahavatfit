// cycle.ts - Menstrual Cycle Tracking Logic for AhavatFit

import * as state from './state';
import { $, $$, showToast } from './ui';
import { getCycleInsightsAI } from './ai';
import { checkAndUnlockAchievement } from './profile';

// --- DATA TYPES & CONSTANTS ---
export interface CycleData {
    cycleLength: number;
    periodLength: number;
}
export interface DayPhaseInfo {
    phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal' | 'unknown';
    dayOfCycle: number | null;
}
type AllCycleLogs = { [dateKey: string]: state.CycleLogEntry };

const SYMPTOMS = {
    cramps: { icon: '🌡️', label: 'Спазмы' },
    bloating: { icon: '🎈', label: 'Вздутие' },
    headache: { icon: '🤕', label: 'Головная боль' },
    fatigue: { icon: '😴', label: 'Усталость' },
    acne: { icon: '🍓', label: 'Акне' },
    craving: { icon: '🍫', label: 'Тяга к еде' }
};
const MOODS = {
    happy: { icon: '😊', label: 'Счастливое' },
    calm: { icon: '😌', label: 'Спокойное' },
    energetic: { icon: '⚡', label: 'Энергичное' },
    sad: { icon: '😢', label: 'Грустное' },
    anxious: { icon: '😟', label: 'Тревожное' },
    irritated: { icon: '😠', label: 'Раздраженное' }
};

let currentYear: number;
let currentMonth: number;

// --- DATA ACCESS & MANIPULATION ---

export function getCycleData(): CycleData {
    const settingsRaw = localStorage.getItem(state.CYCLE_SETTINGS_KEY);
    return settingsRaw ? JSON.parse(settingsRaw) : { cycleLength: 28, periodLength: 5 };
}
function getAllLogs(): AllCycleLogs {
    const logsRaw = localStorage.getItem(state.CYCLE_LOG_DATA_KEY);
    return logsRaw ? JSON.parse(logsRaw) : {};
}
export function saveCycleLogEntry(date: string, entry: Omit<state.CycleLogEntry, 'date'>) {
    const allLogs = getAllLogs();
    const existingEntry = allLogs[date] || {};

    // If all fields are empty, remove the entry for that day
    if (!entry.period && entry.symptoms.length === 0 && !entry.mood && !entry.notes) {
        delete allLogs[date];
    } else {
         allLogs[date] = { ...existingEntry, ...entry };
    }

    localStorage.setItem(state.CYCLE_LOG_DATA_KEY, JSON.stringify(allLogs));
    
    // Check for achievement on first log
    if (Object.keys(allLogs).length === 1) {
        checkAndUnlockAchievement('CYCLE_LOG_FIRST');
    }
}
function getMostRecentStartDate(allLogs: AllCycleLogs): string | null {
    const periodStartDays = Object.keys(allLogs).filter(date => allLogs[date].period === 'start');
    if (periodStartDays.length === 0) return null;
    return periodStartDays.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

// --- PHASE CALCULATION ---

function daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1 + 'T00:00:00');
    const d2 = new Date(date2 + 'T00:00:00');
    return Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
}
export function getDayPhase(targetDateStr: string, cycleData: CycleData, allLogs: AllCycleLogs): DayPhaseInfo {
    const mostRecentStart = getMostRecentStartDate(allLogs);
    if (!mostRecentStart) return { phase: 'unknown', dayOfCycle: null };

    const dayOfCycle = daysBetween(mostRecentStart, targetDateStr) + 1;
    if (dayOfCycle <= 0) return { phase: 'unknown', dayOfCycle: null };

    // Determine phase based on logs first
    const targetDayLog = allLogs[targetDateStr];
    if (targetDayLog?.period) return { phase: 'menstruation', dayOfCycle };
    
    // Fallback to calculation if no period is logged for the target day
    if (dayOfCycle <= cycleData.periodLength) return { phase: 'menstruation', dayOfCycle };
    
    const ovulationStart = Math.round(cycleData.cycleLength / 2) - 2;
    const ovulationEnd = Math.round(cycleData.cycleLength / 2) + 2;
    if (dayOfCycle <= ovulationStart) return { phase: 'follicular', dayOfCycle };
    if (dayOfCycle <= ovulationEnd) return { phase: 'ovulation', dayOfCycle };
    if (dayOfCycle <= cycleData.cycleLength) return { phase: 'luteal', dayOfCycle };
    
    return { phase: 'unknown', dayOfCycle };
}

// --- UI RENDERING ---

export async function renderCyclePage(setState?: (newState: Partial<state.AppState>) => void) {
    const container = $('#cycle-page .page-content');
    if (!container) return;
    state.globalUIState.cyclePageInitialized = true;
    
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();

    const allLogs = getAllLogs();
    const cycleData = getCycleData();
    const todayStr = today.toISOString().split('T')[0];
    const phaseInfo = getDayPhase(todayStr, cycleData, allLogs);

    container.innerHTML = `
        <div id="ai-phase-insights-container">
             <div class="card skeleton" style="height: 180px;"></div>
        </div>
        <div class="card">
            <div id="calendar-container">
                <!-- Calendar will be rendered here -->
            </div>
             <div class="card-footer" style="text-align: center; font-size: 0.8rem; opacity: 0.7; padding-top: 1rem;">
                Нажмите на день, чтобы добавить запись.
            </div>
        </div>
    `;

    renderCalendar(currentYear, currentMonth);
    
    const insightsContainer = $('#ai-phase-insights-container');
    if (insightsContainer) {
        const insights = await getCycleInsightsAI(phaseInfo);
        insightsContainer.innerHTML = `
            <div class="card current-phase-card">
                <h3>${insights.title} (День ${phaseInfo.dayOfCycle || '?'})</h3>
                <p>${insights.description}</p>
                <div class="phase-tip">
                    <i class="fas fa-dumbbell"></i>
                    <p><strong>Тренировка:</strong> ${insights.workoutTip}</p>
                </div>
                 <div class="phase-tip">
                    <i class="fas fa-apple-whole"></i>
                    <p><strong>Питание:</strong> ${insights.nutritionTip}</p>
                </div>
            </div>
        `;
    }
}

function renderCalendar(year: number, month: number) {
    const container = $('#calendar-container');
    if (!container) return;
    container.innerHTML = generateCalendar(year, month, getAllLogs());
    setupCalendarEventListeners();
}

function generateCalendar(year: number, month: number, allLogs: AllCycleLogs): string {
    const today = new Date();
    today.setHours(0,0,0,0);
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const monthName = monthStart.toLocaleString('ru-RU', { month: 'long' });
    const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    let html = `
        <div class="calendar-header">
            <button class="btn btn-outline" id="prev-month-btn">&lt;</button>
            <h3>${capitalizedMonthName} ${year}</h3>
            <button class="btn btn-outline" id="next-month-btn">&gt;</button>
        </div>
        <div class="calendar-grid">
            <div class="calendar-day-name">Пн</div> <div class="calendar-day-name">Вт</div>
            <div class="calendar-day-name">Ср</div> <div class="calendar-day-name">Чт</div>
            <div class="calendar-day-name">Пт</div> <div class="calendar-day-name">Сб</div>
            <div class="calendar-day-name">Вс</div>`;

    const startDay = (monthStart.getDay() + 6) % 7;
    for (let i = 0; i < startDay; i++) html += `<div class="calendar-day other-month"></div>`;

    for (let day = 1; day <= monthEnd.getDate(); day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const log = allLogs[dateStr];
        
        const isToday = date.getTime() === today.getTime();
        let classes = 'calendar-day interactive';
        if (isToday) classes += ' current-day';
        if (log?.period) classes += ' period-day';
        
        const symptomDots = log?.symptoms?.length > 0
            ? `<div class="symptom-dots">${log.symptoms.map(() => `<div class="symptom-dot"></div>`).join('')}</div>`
            : '';

        html += `<div class="${classes}" data-date="${dateStr}">
                    <span class="day-number">${day}</span>
                    ${symptomDots}
                 </div>`;
    }
    const totalDays = startDay + monthEnd.getDate();
    const remainingDays = 7 - (totalDays % 7);
    if (remainingDays < 7) {
        for (let i = 0; i < remainingDays; i++) html += `<div class="calendar-day other-month"></div>`;
    }

    html += `</div>`;
    return html;
}

function renderCycleLogModal(dateStr: string) {
    const modal = $('#cycle-log-modal');
    if (!modal) return;
    
    const allLogs = getAllLogs();
    // FIX: Explicitly type `entry` as a partial CycleLogEntry to allow accessing its properties
    // even when it's an empty object for a day with no log yet. This resolves TypeScript errors.
    const entry: Partial<state.CycleLogEntry> = allLogs[dateStr] || {};
    const date = new Date(dateStr + 'T00:00:00');
    
    ($('#cycle-log-modal-title') as HTMLElement).textContent = `Запись на ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
    ($('#cycle-log-date') as HTMLInputElement).value = dateStr;
    ($('#cycle-notes') as HTMLTextAreaElement).value = entry.notes || '';

    const renderChips = (containerId: string, options: any, activeValues: string[] | string, dataKey: string) => {
        const container = $(`#${containerId}`);
        if(container) {
            container.innerHTML = Object.entries(options).map(([key, value]: [string, any]) => `
                <button type="button" class="chip ${Array.isArray(activeValues) ? (activeValues.includes(key) ? 'active' : '') : (activeValues === key ? 'active' : '')}" data-${dataKey}="${key}">
                    ${value.icon ? `${value.icon} ` : ''}${value.label}
                </button>
            `).join('');
        }
    };
    
    renderChips('period-chips', { 'none': {label: 'Нет'}, 'start': {label: 'Начало'}, 'flow': {label: 'Идут'}, 'end': {label: 'Конец'} }, entry.period || 'none', 'period');
    renderChips('symptom-chips', SYMPTOMS, entry.symptoms || [], 'symptom');
    renderChips('mood-chips', MOODS, entry.mood || '', 'mood');
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}


// --- EVENT LISTENERS ---

function setupCalendarEventListeners() {
    $('#prev-month-btn')?.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar(currentYear, currentMonth);
    });
    $('#next-month-btn')?.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar(currentYear, currentMonth);
    });
    $('#calendar-container')?.addEventListener('click', e => {
        const target = (e.target as HTMLElement).closest<HTMLElement>('.calendar-day');
        if (target?.dataset.date) {
            renderCycleLogModal(target.dataset.date);
        }
    });
    // Add chip selection logic inside the modal
    $('#cycle-log-modal')?.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        if(target.matches('.chip')) {
            const container = target.closest('.chip-filters');
            const isMultiSelect = container?.id === 'symptom-chips';

            if (isMultiSelect) {
                target.classList.toggle('active');
            } else if (container) {
                container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                target.classList.add('active');
            }
        }
    });
}