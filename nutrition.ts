// nutrition.ts - Nutrition Logging Logic for AhavatFit (Phase V)

import * as state from './state';
import { $, showToast } from './ui';
import { getNutritionAnalysis } from './ai';

let mealLog: state.MealEntry[] = [];
let isSubmitting = false;

/**
 * Renders the main nutrition page.
 */
export function renderNutritionPage(setState?: (newState: Partial<state.AppState>) => void) {
    const container = $('#nutrition-page .page-content');
    if (!container) return;

    loadMealLog();

    container.innerHTML = `
        <div class="card nutrition-log-form">
            <h3>Что вы съели сегодня?</h3>
            <p>Опишите свой прием пищи, и Амина поможет вам с анализом. Например: "овсяная каша на молоке с ягодами и орехами".</p>
            <div class="form-group">
                <textarea id="meal-input" class="form-input" rows="3" placeholder="Опишите вашу еду..."></textarea>
            </div>
            <button id="log-meal-btn" class="btn">
                <i class="fas fa-plus"></i> Добавить запись
            </button>
        </div>
        <div id="meal-log-history">
            ${mealLog.length > 0 ? '<h3>История записей</h3>' : ''}
            <!-- Meal log entries will be rendered here -->
        </div>
    `;

    renderMealLog();
    setupEventListeners();

    state.globalUIState.nutritionPageInitialized = true;
}

/**
 * Loads the meal log from local storage.
 */
function loadMealLog() {
    const savedLog = localStorage.getItem(state.NUTRITION_LOG_KEY);
    mealLog = savedLog ? JSON.parse(savedLog) : [];
}

/**
 * Saves the meal log to local storage.
 */
function saveMealLog() {
    localStorage.setItem(state.NUTRITION_LOG_KEY, JSON.stringify(mealLog));
}

/**
 * Renders the list of meal log entries.
 */
function renderMealLog() {
    const historyContainer = $('#meal-log-history');
    if (!historyContainer) return;

    if (mealLog.length === 0) {
        historyContainer.innerHTML = `
            <div class="card empty-state-card">
                <i class="fas fa-utensils"></i>
                <h3>Ваш дневник питания пуст</h3>
                <p>Добавьте свою первую запись, чтобы начать отслеживать питание и получать полезные советы от Амины.</p>
            </div>
        `;
        return;
    }

    // Group entries by date
    const groupedByDate: { [key: string]: state.MealEntry[] } = mealLog.reduce((acc, entry) => {
        const date = new Date(entry.date).toLocaleDateString('ru-RU', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(entry);
        return acc;
    }, {} as { [key: string]: state.MealEntry[] });

    let html = '<h3>История записей</h3>';
    for (const date in groupedByDate) {
        html += `<h4>${date}</h4>`;
        html += groupedByDate[date].map(entry => renderMealCard(entry)).join('');
    }

    historyContainer.innerHTML = html;
}

/**
 * Generates HTML for a single meal log card.
 */
function renderMealCard(entry: state.MealEntry): string {
    const entryDate = new Date(entry.date);
    const time = entryDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const { feedback, calories, protein, carbs, fat } = entry.aiAnalysis;
    return `
        <div class="card meal-log-card">
            <div class="log-header">
                <h4>Прием пищи</h4>
                <span class="time">${time}</span>
            </div>
            <p class="user-text">"${entry.userText}"</p>
            <div class="ai-analysis">
                <div class="ai-analysis-feedback">
                    <p><strong><i class="fas fa-robot"></i> Амина:</strong> ${feedback}</p>
                </div>
                <div class="ai-analysis-macros">
                    <div class="macro-stat">
                        <div class="value">${calories}</div>
                        <div class="label">Ккал</div>
                    </div>
                     <div class="macro-stat">
                        <div class="value">${protein}g</div>
                        <div class="label">Белки</div>
                    </div>
                     <div class="macro-stat">
                        <div class="value">${carbs}g</div>
                        <div class="label">Углеводы</div>
                    </div>
                     <div class="macro-stat">
                        <div class="value">${fat}g</div>
                        <div class="label">Жиры</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Handles the submission of a new meal entry.
 */
async function handleLogMeal() {
    if (isSubmitting) return;

    const mealInput = $<HTMLTextAreaElement>('#meal-input');
    const logButton = $<HTMLButtonElement>('#log-meal-btn');
    if (!mealInput || !logButton) return;

    const userText = mealInput.value.trim();
    if (!userText) {
        showToast('Пожалуйста, опишите, что вы съели.');
        return;
    }

    isSubmitting = true;
    logButton.disabled = true;
    logButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Анализ...`;

    try {
        const aiAnalysis = await getNutritionAnalysis(userText);

        const newEntry: state.MealEntry = {
            date: new Date().toISOString(),
            userText,
            aiAnalysis
        };
        
        // Add to the beginning of the array
        mealLog.unshift(newEntry);
        saveMealLog();
        renderMealLog();
        
        mealInput.value = '';
        showToast('Запись успешно добавлена!');

    } catch (error) {
        console.error("Failed to get nutrition analysis:", error);
        showToast('Не удалось проанализировать запись. Попробуйте позже.');
    } finally {
        isSubmitting = false;
        logButton.disabled = false;
        logButton.innerHTML = `<i class="fas fa-plus"></i> Добавить запись`;
    }
}


/**
 * Sets up event listeners for the nutrition page.
 */
function setupEventListeners() {
    $('#log-meal-btn')?.addEventListener('click', handleLogMeal);
}