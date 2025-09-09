// index.tsx - Main Application Entry Point for AhavatFit

// --- IMPORTS ---
// FIX: Update Firebase imports to v8 namespaced API to resolve module export errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { firebaseConfig } from './firebase';
import * as api from './api';

import * as state from './state';
import { $, $$, applyTheme, closeModal, hideLoadingOverlay, initializeTheme, showLoadingOverlay, showToast, showShareSuccessModal } from './ui';

import { renderAuthPage, setupAuthEventListeners } from './auth';
import { checkAndShowOnboarding } from './onboarding';

import { renderHomePage } from './home';
import { renderWorkoutsPage, renderWorkoutList, renderVideoPlayer } from './workouts';
import { renderFoodPage, renderRecipeList, showRecipeModal } from './food';
import { renderSerenityPage } from './serenity';
import { renderCommunityPage } from './community';
import { renderCyclePage } from './cycle';
import { renderNutritionPage } from './nutrition';
import { renderProgramsPage, showProgramDetailModal } from './programs';
import { renderProfilePage } from './profile';
import { renderAdminPage } from './admin';
import { renderAICoachPage, setupAICoaches, addMessage, addGoalMessage, askAI, askGoalAI } from './ai';
import { checkAndUnlockAchievement } from './profile';
import { saveCycleLogEntry } from './cycle';

// --- SERVICE WORKER REGISTRATION ---
// FIX: Reverted to a simpler, direct 'load' event listener for Service Worker registration.
// The persistent "invalid state" error suggests a subtle issue in the execution environment
// that the more complex `readyState` check was not resolving. This fundamental approach is
// the most reliable way to ensure the document is in a valid state.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // Explicitly construct the Service Worker URL from the current location's origin
            // to prevent cross-origin errors in specific hosting environments.
            const swUrl = new URL('/sw.js', window.location.origin);
            const registration = await navigator.serviceWorker.register(swUrl.href);
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        } catch (err) {
            console.error('ServiceWorker registration failed: ', err);
        }
    });
}


// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // FIX: Use v8 namespaced API for Firebase initialization. Added a check to prevent re-initialization.
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    initializeTheme();
    setupAICoaches();
    setupGlobalEventListeners();

    // FIX: Use v8 namespaced API for auth service and state change listener.
    firebase.auth().onAuthStateChanged(async (user) => {
        const authContainer = $('#auth-container');
        const appContainer = $('#app-container');
        
        if (user) {
            if (authContainer) authContainer.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
            await initializeAppForUser(user);
        } else {
            if (authContainer) authContainer.style.display = 'block';
            if (appContainer) appContainer.style.display = 'none';
            renderAuthPage(authContainer as HTMLElement);
            setupAuthEventListeners();
        }
    });
});


// --- STATE MANAGEMENT ---

function setState(newState: Partial<state.AppState>) {
    Object.assign(state.appState, newState);
}


// --- USER-SPECIFIC INITIALIZATION ---

/**
 * Fetches core data needed for the app to function and populates the global state.
 * This runs once after login to prevent race conditions on the home page.
 */
async function loadInitialAppData() {
    try {
        // Fetch all essential data in parallel
        const [workouts, recipes, programs] = await Promise.all([
            api.fetchWorkouts(),
            api.fetchRecipes(),
            api.fetchPrograms()
        ]);

        // Populate the global state
        setState({ workouts, recipes, programs });
        console.log('Initial app data loaded successfully.');

    } catch (error) {
        console.error("Failed to load initial app data:", error);
        // This is a critical failure. Inform the user.
        showToast("Не удалось загрузить основные данные приложения. Попробуйте перезагрузить.");
        // We throw the error to stop the app initialization process if data is missing.
        throw error;
    }
}


// FIX: Use v8 User type from the firebase namespace.
// FIX: Use `firebase.User` type for the user object, as `firebase.auth.User` is not a valid type in the Firebase v8 compat API. The `User` type is available directly on the `firebase` namespace.
async function initializeAppForUser(user: firebase.User) {
    console.log('User logged in:', user.email);
    showLoadingOverlay(); // Show overlay for initial data loading

    try {
        // 1. Pre-load all essential application data.
        await loadInitialAppData();
        
        // 2. Hide the main data loading overlay before potentially showing the onboarding modal.
        hideLoadingOverlay();

        // 3. Now, check for onboarding. If needed, a modal will appear over the app, not an overlay.
        await checkAndShowOnboarding();
        
        // 4. Achievement for completing onboarding.
        checkAndUnlockAchievement('ONBOARDING_COMPLETE');

        // 5. Navigate to the home page. This function manages its own loading indicator.
        await navigateTo('home');
    } catch (error) {
         console.error("App initialization failed:", error);
         // Ensure the overlay is hidden in case of an error during data loading.
         hideLoadingOverlay();
         showToast("Не удалось инициализировать приложение. Попробуйте перезагрузить страницу.");
    }
}


// --- NAVIGATION ---

const pageRenderers: { [key: string]: (setState?: (newState: Partial<state.AppState>) => void) => void | Promise<void> } = {
    'home': renderHomePage,
    'workouts': renderWorkoutsPage,
    'food': renderFoodPage,
    'serenity': renderSerenityPage,
    'community': renderCommunityPage,
    'cycle': renderCyclePage,
    'nutrition': renderNutritionPage,
    'programs': renderProgramsPage,
    'profile': renderProfilePage,
    'ai-coach': renderAICoachPage,
    'admin': renderAdminPage,
};

const pageInitializedFlags: { [key: string]: keyof typeof state.globalUIState } = {
    'home': 'homePageInitialized',
    'workouts': 'workoutsInitialized',
    'food': 'foodPageInitialized',
    'serenity': 'serenityPageInitialized',
    'community': 'communityPageInitialized',
    'cycle': 'cyclePageInitialized',
    'nutrition': 'nutritionPageInitialized',
    'programs': 'programsPageInitialized',
    'profile': 'profilePageInitialized',
    'ai-coach': 'aiCoachPageInitialized',
    'admin': 'adminPageInitialized',
};

async function navigateTo(pageId: string) {
    if (!pageId) return;

    // Show a loading overlay for all navigation, especially for pages that need to fetch data.
    showLoadingOverlay();

    $$('.page').forEach(page => page.classList.remove('active'));
    $$('.nav-item').forEach(link => link.classList.remove('active'));

    const targetPage = $(`#${pageId}-page`);
    const targetLink = $(`nav [data-page="${pageId}"]`);

    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo(0, 0);
        state.globalUIState.currentPage = pageId;
    }
    if (targetLink) {
        targetLink.classList.add('active');
    }

    const initializedFlag = pageInitializedFlags[pageId];
    if (initializedFlag && !state.globalUIState[initializedFlag]) {
        const renderFn = pageRenderers[pageId];
        if (renderFn) {
            // Await the rendering function. The loading overlay will be visible during this time.
            await renderFn(setState);
        }
    }
    
    // Hide the overlay once the page is ready. For already initialized pages, this will be very fast.
    hideLoadingOverlay();
}


// --- GLOBAL EVENT LISTENERS ---

function setupGlobalEventListeners() {
    document.body.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Navigation clicks
        const navLink = target.closest<HTMLElement>('.nav-item, .quick-link'); // Corrected to .nav-item
        if (navLink && navLink.dataset.page) {
            e.preventDefault();
            navigateTo(navLink.dataset.page);
        }

        // Modal close clicks
        if (target.matches('.modal-close-btn, .close-btn') || target.matches('.modal.show')) {
            const modal = target.closest<HTMLElement>('.modal.show');
            // Close if clicking on the backdrop (the modal element itself) or a close button
            if (modal && (e.target === modal || target.closest<HTMLElement>('.modal-close-btn, .close-btn'))) {
                 closeModal();
            }
        }
    });
    
    // Event listeners are attached to the body and check for elements on the profile page
    // This avoids errors if the elements don't exist yet.
    document.body.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;

        // Dark Mode Toggle
        if (target.matches('#dark-mode-toggle')) {
            const theme = target.checked ? 'dark' : 'light';
            applyTheme(theme);
            localStorage.setItem('theme', theme);
        }
        
        // Voice Response Toggle
        if (target.matches('#voice-response-toggle')) {
            localStorage.setItem('voice-response-enabled', String(target.checked));
            if (!target.checked && state.globalUIState.speechSynthesis) {
                state.globalUIState.speechSynthesis.cancel(); // Stop any ongoing speech
            }
        }
    });

    // Workout Page: Filter and Playlist clicks
    $('#workouts-page')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const playlistItem = target.closest<HTMLElement>('.playlist-item');
        const filterChip = target.closest<HTMLElement>('#workout-filters .chip');
        
        if (filterChip) {
            $('#workout-filters .chip.active')?.classList.remove('active');
            filterChip.classList.add('active');
            const category = filterChip.dataset.category;
            const filteredWorkouts = category === 'all'
                ? state.appState.workouts
                : state.appState.workouts.filter(w => w.category === category);
            renderWorkoutList(filteredWorkouts, $('#workouts-playlist') as HTMLElement);
        }

        if (playlistItem) {
            $('#workouts-playlist .playlist-item.active')?.classList.remove('active');
            playlistItem.classList.add('active');
            const workoutId = parseInt(playlistItem.dataset.id || '0', 10);
            const workout = state.appState.workouts.find(w => w.id === workoutId);
            if (workout) renderVideoPlayer(workout);
        }
    });
    
    // Food Page: Filter and Recipe clicks
    $('#food-page')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const recipeCard = target.closest<HTMLElement>('.recipe-card');
        const filterChip = target.closest<HTMLElement>('#recipe-filters .chip');
        
        if (filterChip) {
             $('#recipe-filters .chip.active')?.classList.remove('active');
             filterChip.classList.add('active');
             const category = filterChip.dataset.category;
             const filteredRecipes = category === 'all'
                ? state.appState.recipes
                : state.appState.recipes.filter(r => r.category === category);
             renderRecipeList(filteredRecipes, $('#recipe-view') as HTMLElement);
        }
        if (recipeCard) {
            const recipeId = parseInt(recipeCard.dataset.id || '0', 10);
            const recipe = state.appState.recipes.find(r => r.id === recipeId);
            if (recipe) showRecipeModal(recipe);
        }
    });

    // AI Coach Page: Submit, suggestion chips, and mic
    $('#ai-coach-page')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const chip = target.closest<HTMLButtonElement>('.chip');
        const micBtn = target.closest<HTMLButtonElement>('#ai-mic-btn');

        if (chip && chip.dataset.prompt) {
             const promptInput = $<HTMLInputElement>('#ai-prompt-input');
             if (promptInput) {
                promptInput.value = chip.dataset.prompt;
                $('#ai-coach-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
             }
        }

        if (micBtn) {
            if (state.globalUIState.isListening) {
                 state.globalUIState.speechRecognition.stop();
            } else if (!state.globalUIState.isAIProcessing) {
                 state.globalUIState.speechRecognition.start();
            }
        }
    });

    $('#ai-coach-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = $<HTMLInputElement>('#ai-prompt-input');
        if (input && input.value.trim() && !state.globalUIState.isAIProcessing) {
            const prompt = input.value.trim();
            addMessage(prompt, 'user');
            input.value = '';
            askAI(prompt);
            checkAndUnlockAchievement('AI_CHAT_START');
        }
    });
    
     // Goal setting chat in modal
    $('#goal-chat-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = $<HTMLInputElement>('#goal-chat-input');
        if(input && input.value.trim() && !state.globalUIState.isGoalChatProcessing) {
            const prompt = input.value.trim();
            addGoalMessage(prompt, 'user');
            input.value = '';
            askGoalAI(prompt, renderHomePage); // Pass renderer to update widgets on success
        }
    });
    
    // Programs page
    $('#programs-page')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const programCard = target.closest<HTMLElement>('.program-card');
        if (programCard && programCard.dataset.id) {
            showProgramDetailModal(programCard.dataset.id);
        }
    });
    
    // Complete Workout Button
    document.body.addEventListener('click', e => {
        const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.complete-workout-btn');
        if(!button) return;

        const workout = state.globalUIState.currentWorkout;
        if (!workout) return;
        
        button.disabled = true;
        button.innerHTML = `<i class="fas fa-check"></i> Завершено!`;

        const completedWorkoutsRaw = localStorage.getItem(state.COMPLETED_WORKOUTS_KEY);
        const completedWorkouts: any[] = completedWorkoutsRaw ? JSON.parse(completedWorkoutsRaw) : [];
        
        if(completedWorkouts.length === 0) {
            checkAndUnlockAchievement('FIRST_WORKOUT');
        }

        completedWorkouts.push({
            workoutId: workout.id,
            date: new Date().toISOString().split('T')[0],
            duration: workout.duration,
            calories: workout.calories,
        });
        localStorage.setItem(state.COMPLETED_WORKOUTS_KEY, JSON.stringify(completedWorkouts));
        showShareSuccessModal(workout.title);
    });

    // Cycle Log Modal Form Submission
    $('#cycle-log-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = $<HTMLInputElement>('#cycle-log-date')?.value;
        if (!date) return;
        
        const periodAttr = document.querySelector('#period-chips .chip.active')?.getAttribute('data-period');
        const symptoms = Array.from(document.querySelectorAll('#symptom-chips .chip.active')).map(el => el.getAttribute('data-symptom') || '').filter(s => s);
        const mood = document.querySelector('#mood-chips .chip.active')?.getAttribute('data-mood') || '';
        const notes = $<HTMLTextAreaElement>('#cycle-notes')?.value;

        const periodValue = (periodAttr === 'none' || !periodAttr) ? undefined : periodAttr as 'start' | 'flow' | 'end';

        saveCycleLogEntry(date, { period: periodValue, symptoms, mood, notes });
        showToast('Запись сохранена');
        closeModal();
        
        if(state.globalUIState.currentPage === 'cycle') {
            renderCyclePage();
        }
    });

}