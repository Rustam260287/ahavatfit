// food.ts - Food, Nutrition, and Recipe Logic for AhavatFit

import * as state from './state';
import { $, $$, renderList, handleAsyncOperation } from './ui';
import { checkAndUnlockAchievement } from './profile';
import { getNutritionAnalysis } from './ai';
import * as api from './api'; // Phase IV: Import the new API layer

/**
 * Renders the main food page, fetching data if necessary.
 * @param setState - Callback to update global app state.
 */
export async function renderFoodPage(setState: (newState: Partial<state.AppState>) => void) {
    const recipeViewContainer = $('#food-recipes-view #recipe-view');
    if (!recipeViewContainer) return;
    recipeViewContainer.innerHTML = `<div class="skeleton-recipes"><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`;

    // Phase IV: Use the API layer to fetch data
    const loadRecipes = async () => {
        if (state.appState.recipes.length === 0) {
            const fetchedRecipes = await api.fetchRecipes();
            setState({ recipes: fetchedRecipes });
        }
    };

    const result = await handleAsyncOperation(loadRecipes, {
        container: recipeViewContainer,
        errorMessage: '<p>Не удалось загрузить рецепты. Попробуйте позже.</p>'
    });

    // If result is null, it means the operation failed and the error is already handled.
    if (result === null) return;

    // --- If successful, render the content ---
    const categories = [...new Set(state.appState.recipes.map(r => r.category))];
    const filtersContainer = $('#food-recipes-view #recipe-filters');
    if (filtersContainer) {
        filtersContainer.innerHTML = `<button class="chip active" data-category="all">Все</button>` + categories.map(cat => `<button class="chip" data-category="${cat}">${cat}</button>`).join('');
    }
    renderRecipeList(state.appState.recipes, recipeViewContainer);
    state.globalUIState.foodPageInitialized = true;
}

/**
 * Renders a list of recipes into a container using an efficient diffing strategy.
 * @param recipeList - The array of recipes to render.
 * @param container - The HTML element to render into.
 */
export function renderRecipeList(recipeList: state.Recipe[], container: HTMLElement) {
    const renderFn = (r: state.Recipe) => `
        <div class="recipe-card" data-id="${r.id}">
            <h3>${r.name}</h3><p>${r.category}</p>
        </div>`;
    const emptyHtml = '<p>Рецепты в этой категории не найдены.</p>';
    
    renderList(container, recipeList, r => r.id, renderFn, emptyHtml);
}

/**
 * Shows the recipe detail modal with information for a specific recipe.
 * @param recipe - The recipe object to display.
 */
export function showRecipeModal(recipe: state.Recipe) {
    const modal = $('#recipe-detail-modal');
    const content = $('#recipe-detail-content');
    if(!modal || !content) return;
    content.innerHTML = `
        <h3>${recipe.name}</h3>
        <p class="recipe-category">${recipe.category}</p>
        <p class="recipe-description">${recipe.description}</p>
        <h4>Ингредиенты</h4><ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
        <h4>Инструкции</h4><ol>${recipe.instructions.map(i => `<li>${i}</li>`).join('')}</ol>`;
    modal.style.display = 'flex';

    const viewedRecipesRaw = localStorage.getItem(state.VIEWED_RECIPES_KEY);
    const viewedRecipes = viewedRecipesRaw ? new Set(JSON.parse(viewedRecipesRaw)) : new Set();
    viewedRecipes.add(recipe.id);
    localStorage.setItem(state.VIEWED_RECIPES_KEY, JSON.stringify(Array.from(viewedRecipes)));
    checkAndUnlockAchievement('RECIPE_EXPLORER');
}
