// admin.ts - Admin Panel Logic for AhavatFit

import * as state from './state';
import { $ } from './ui';

/**
 * Renders the content for the admin page based on the screenshot.
 */
export function renderAdminPage(setState?: (newState: Partial<state.AppState>) => void) {
    const container = $('#admin-page .page-content');
    if (!container) return;

    // Mock data for analytics
    const analytics = {
        totalUsers: 125,
        newUsers: 15,
        activeUsers: 78
    };

    container.innerHTML = `
        <div class="profile-section">
            <h3>Аналитика пользователей</h3>
            <div class="admin-grid">
                <div class="admin-stat-card">
                    <div class="value">${analytics.totalUsers}</div>
                    <div class="label">Всего</div>
                </div>
                <div class="admin-stat-card">
                    <div class="value">${analytics.newUsers}</div>
                    <div class="label">Новых</div>
                </div>
                 <div class="admin-stat-card">
                    <div class="value">${analytics.activeUsers}</div>
                    <div class="label">Активных</div>
                </div>
            </div>
            <p>Регистрации за 6 месяцев</p>
            <div class="chart-container">
                <div class="chart-bar" style="height: 40%;"></div>
                <div class="chart-bar" style="height: 60%;"></div>
                <div class="chart-bar" style="height: 30%;"></div>
                <div class="chart-bar" style="height: 70%;"></div>
                <div class="chart-bar" style="height: 80%;"></div>
                <div class="chart-bar" style="height: 95%;"></div>
            </div>
        </div>

        <div class="profile-section">
            <div class="admin-section-header">
                <h3>Управление тренировками</h3>
                <button class="btn"><i class="fas fa-plus"></i> Добавить</button>
            </div>
            <div id="admin-workouts-list">
                ${state.appState.workouts.map(w => renderAdminListItem(w.title, w.category)).join('')}
            </div>
        </div>

        <div class="profile-section">
            <div class="admin-section-header">
                <h3>Управление категориями</h3>
                 <div style="display:flex; gap: 8px;">
                    <input type="text" class="form-input" placeholder="Новая категория">
                    <button class="btn">+</button>
                 </div>
            </div>
            <div id="admin-categories-list">
                 ${state.WORKOUT_CATEGORIES.map(c => renderAdminListItem(c, null, true)).join('')}
            </div>
        </div>

        <div class="profile-section">
            <div class="admin-section-header">
                <h3>Управление рецептами</h3>
                <button class="btn"><i class="fas fa-plus"></i> Добавить</button>
            </div>
            <div id="admin-recipes-list">
                ${state.appState.recipes.map(r => renderAdminListItem(r.name, r.category)).join('')}
            </div>
        </div>
    `;

    state.globalUIState.adminPageInitialized = true;
}


function renderAdminListItem(title: string, subtitle: string | null, isCategory: boolean = false): string {
    return `
    <div class="admin-list-item">
        <div class="info">
            <div class="title">${title}</div>
            ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        </div>
        <div class="actions">
            ${!isCategory ? `<button aria-label="Редактировать"><i class="far fa-edit"></i></button>` : ''}
            <button aria-label="Удалить"><i class="far fa-trash-can"></i></button>
        </div>
    </div>
    `;
}