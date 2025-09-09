// programs.ts - Guided Workout Programs Logic (Phase VII)

import * as state from './state';
import * as api from './api';
import { $, $$, handleAsyncOperation, showToast } from './ui';

/**
 * Renders the main programs page.
 */
export async function renderProgramsPage(setState?: (newState: Partial<state.AppState>) => void) {
    const container = $('#programs-page .page-content');
    if (!container) return;

    container.innerHTML = `
        <div class="card">
            <h3>Выберите свой путь</h3>
            <p>Программы — это структурированные планы тренировок на несколько недель, созданные для достижения конкретных целей. Выберите программу, и мы будем вести вас день за днём.</p>
        </div>
        <div id="programs-list">
            <div class="card skeleton" style="height: 120px;"></div>
            <div class="card skeleton" style="height: 120px;"></div>
        </div>
    `;

    // Load programs if not already in state
    if (state.appState.programs.length === 0) {
        const loadedPrograms = await handleAsyncOperation(api.fetchPrograms, {
            container: $('#programs-list')
        });
        if (loadedPrograms) {
            state.appState.programs = loadedPrograms;
        } else {
            return; // Error handled by wrapper
        }
    }
    
    renderProgramList();
    state.globalUIState.programsPageInitialized = true;
}

/**
 * Renders the list of available programs.
 */
function renderProgramList() {
    const listContainer = $('#programs-list');
    if (!listContainer) return;

    const activeProgramRaw = localStorage.getItem(state.ACTIVE_PROGRAM_KEY);
    const activeProgram: state.ActiveProgramState | null = activeProgramRaw ? JSON.parse(activeProgramRaw) : null;
    
    if (state.appState.programs.length === 0) {
        listContainer.innerHTML = `<p>Программы тренировок скоро появятся здесь.</p>`;
        return;
    }

    listContainer.innerHTML = state.appState.programs.map(program => {
        const isActive = activeProgram?.programId === program.id;
        let cardClass = "card program-card";
        if (isActive) {
            cardClass += " active-program";
        }
        // In a real app, we'd also track completion status
        // cardClass += isCompleted ? " completed-program" : "";

        return `
            <div class="${cardClass}" data-id="${program.id}">
                <h3>${program.title}</h3>
                <div class="duration">${program.duration} недели · ${program.schedule[0].days.length} тренировки в неделю</div>
                <p>${program.description}</p>
                ${isActive ? '<span class="active-program-badge">Активная программа</span>' : ''}
            </div>
        `;
    }).join('');
}

/**
 * Shows the detail modal for a selected program.
 * @param programId The ID of the program to show.
 */
export function showProgramDetailModal(programId: string) {
    const program = state.appState.programs.find(p => p.id === programId);
    if (!program) {
        showToast("Программа не найдена");
        return;
    }

    const modal = $('#program-detail-modal');
    const content = $('#program-detail-content');
    if (!modal || !content) return;

    const scheduleHtml = program.schedule.map(week => `
        <div class="week-schedule">
            <h4>Неделя ${week.week}</h4>
            <ul>
                ${week.days.map(day => `<li><span class="day">День ${day.day}:</span> ${day.title}</li>`).join('')}
                 <li><span class="day">Остальные дни:</span> Отдых или легкая активность</li>
            </ul>
        </div>
    `).join('');

    content.innerHTML = `
        <h3>${program.title}</h3>
        <p class="duration">Продолжительность: ${program.duration} недели</p>
        <p>${program.description}</p>
        ${scheduleHtml}
        <button class="btn" id="enroll-program-btn" data-id="${program.id}">Начать эту программу</button>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);

    $('#enroll-program-btn')?.addEventListener('click', () => enrollInProgram(programId), { once: true });
}

/**
 * Enrolls the user in a program and saves it to localStorage.
 * @param programId The ID of the program to enroll in.
 */
function enrollInProgram(programId: string) {
    const activeProgram: state.ActiveProgramState = {
        programId: programId,
        startDate: new Date().toISOString().split('T')[0]
    };
    localStorage.setItem(state.ACTIVE_PROGRAM_KEY, JSON.stringify(activeProgram));
    
    showToast("Вы успешно записались на программу!");
    
    // Close modal and re-render relevant pages
    const modal = $('#program-detail-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
    
    renderProgramList(); // Re-render list to show the "active" badge
    // Also re-render home page to update the plan for today
    if (state.globalUIState.currentPage === 'home') {
        import('./home').then(home => home.renderHomePage());
    }
}

/**
 * Calculates the difference in days between two date strings.
 */
function daysBetween(date1Str: string, date2Str: string): number {
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Gets the scheduled workout for today based on the active program.
 * @returns The workout object for today, or null if no program is active or no workout is scheduled.
 */
export async function getWorkoutForToday(): Promise<state.Workout | null> {
    const activeProgramRaw = localStorage.getItem(state.ACTIVE_PROGRAM_KEY);
    if (!activeProgramRaw) return null;

    const activeProgram: state.ActiveProgramState = JSON.parse(activeProgramRaw);
    const program = state.appState.programs.find(p => p.id === activeProgram.programId);
    if (!program) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const daysSinceStart = daysBetween(activeProgram.startDate, todayStr);
    if (daysSinceStart < 0) return null; // Program hasn't started yet

    const currentWeekNumber = Math.floor(daysSinceStart / 7) + 1;
    const currentDayOfWeek = (daysSinceStart % 7) + 1; // 1-indexed day of the week in the program

    if (currentWeekNumber > program.duration) {
        // Program finished, maybe clear it? For now, just return null.
        return null;
    }

    const currentWeekSchedule = program.schedule.find(w => w.week === currentWeekNumber);
    const todaysSchedule = currentWeekSchedule?.days.find(d => d.day === currentDayOfWeek);

    if (!todaysSchedule) return null; // Rest day

    // We need to fetch the full workout details
    if (state.appState.workouts.length === 0) {
        state.appState.workouts = await api.fetchWorkouts();
    }
    
    return state.appState.workouts.find(w => w.id === todaysSchedule.workoutId) || null;
}