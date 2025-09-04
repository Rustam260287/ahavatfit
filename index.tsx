// FIX: Add type declarations for the Web Speech API to resolve TypeScript errors.
// These definitions provide the necessary types for SpeechRecognition and related events,
// fixing "Cannot find name 'SpeechRecognition'" and constructor-related errors.
interface SpeechRecognitionEvent {
    results: {
        [index: number]: {
            [index: number]: {
                transcript: string;
            };
        };
    };
}

interface SpeechRecognitionErrorEvent {
    error: any;
}

interface SpeechRecognition {
    continuous: boolean;
    lang: string;
    interimResults: boolean;
    onresult: (event: SpeechRecognitionEvent) => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    start(): void;
    // FIX: Added the missing `stop` method to the SpeechRecognition interface.
    stop(): void;
}

interface SpeechRecognitionStatic {
    new(): SpeechRecognition;
}

declare global {
    interface Window {
        webkitSpeechRecognition: SpeechRecognitionStatic;
        firebaseAuth: any; // Make Firebase Auth available globally
        firebase: any; // Make Firebase SDK available globally
        firebaseConfigError?: boolean; // Flag for initialization errors
    }
}

// FIX: Replaced bare module specifiers with full URL imports to ensure compatibility
// with browsers like Safari that may not support import maps. This allows the modules
// to be loaded directly from a CDN without a build step or import map.

import { GoogleGenAI } from "@google/genai";

// --- DYNAMIC MODULE INITIALIZATION ---
// To prevent startup crashes on iOS, modules are imported dynamically after the app starts.
let md: any;

async function initializeMarkdown() {
    if (md) return;
    try {
        const module = await import('https://esm.sh/markdown-it@14.1.0');
        const MarkdownIt = module.default;
        md = new MarkdownIt();
    } catch (error) {
        console.error("Failed to load Markdown renderer:", error);
        // `md` will remain undefined, and the app will fall back to plain text rendering.
    }
}


// --- TYPE DEFINITIONS ---
export interface PrayerTimes {
    Fajr: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
}

export interface Recipe {
    id: number;
    name: string;
    category: string;
    description: string;
    ingredients: string[];
    instructions: string[];
}

export interface Workout {
    id: number;
    title: string;
    category: string;
    description: string;
    duration: number; // in minutes
    calories: number;
    videoUrl: string;
    alternativeVideoUrl?: string; // For regions where YouTube might be blocked
}

export interface Dua {
    arabic: string;
    translation: string;
    source: string;
}

export type GoalType = 'lose_weight' | 'gain_muscle' | 'improve_flexibility' | 'increase_endurance';

export interface UserGoal {
    type: GoalType;
    startValue: number;
    currentValue: number;
    targetValue: number;
}

// Helper state for recipes page
let recipeFiltersInitialized = false;
let currentRecipeFilter: string | null = null;

// Helper state for workout categories & filters
let WORKOUT_CATEGORIES: string[] = ['Кардио', 'Силовая', 'Растяжка', 'Дыхание'];
let currentWorkoutFilter: string | null = null;
let workoutFiltersInitialized = false;
let activeWorkout: Workout | null = null;
let eventListenersInitialized = false;


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- USER DATA (can be updated from auth) ---
const userProfile = {
    name: 'Гость',
    joinDate: new Date().toISOString().split('T')[0],
    isAdmin: false,
    uid: ''
};

// --- USER-SPECIFIC PROGRESS DATA ---
let currentUserWorkoutHistory: { date: string, duration: number, calories: number }[] = [];
let currentUserGoal: UserGoal | null = null;


// --- SPA VIEW MANAGEMENT ---
type View = 'login' | 'signup' | 'app';

// FIX: Added null checks to prevent runtime errors if elements are not found.
// FIX: Queried elements just-in-time to prevent race conditions on load.
function showView(view: View) {
    const authWrapper = document.getElementById('auth-wrapper');
    const appWrapper = document.getElementById('app-wrapper');
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');

    if (authWrapper) authWrapper.style.display = 'none';
    if (appWrapper) appWrapper.style.display = 'none';
    if (loginSection) loginSection.style.display = 'none';
    if (signupSection) signupSection.style.display = 'none';

    if (view === 'login' || view === 'signup') {
        if (authWrapper) authWrapper.style.display = 'flex';
        if (view === 'login') {
            if (loginSection) loginSection.style.display = 'block';
        } else {
            if (signupSection) signupSection.style.display = 'block';
        }
    } else if (view === 'app') {
        if (appWrapper) appWrapper.style.display = 'block';
    }
}

// --- AUTHENTICATION LOGIC ---

function setButtonLoading(button: HTMLButtonElement, isLoading: boolean, defaultHTML: string) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `<span class="spinner"></span> Загрузка...`;
    } else {
        button.disabled = false;
        button.innerHTML = defaultHTML;
    }
}

function showAuthError(message: string, type: 'login' | 'signup') {
    const element = type === 'login' ? document.getElementById('login-error-message') : document.getElementById('signup-error-message');
    if (element) {
        element.textContent = message;
        element.classList.add('visible');
    }
}

function hideAuthError(type: 'login' | 'signup') {
    const element = type === 'login' ? document.getElementById('login-error-message') : document.getElementById('signup-error-message');
    if (element) {
        element.textContent = '';
        element.classList.remove('visible');
    }
}

function handleSuccessfulLogin(user: any) {
    const loadingOverlay = document.getElementById('loading-overlay');
    const newName = user.displayName || user.email?.split('@')[0] || 'Новый пользователь';
    userProfile.name = newName;
    userProfile.isAdmin = false; // Admin logic can be handled server-side in a real app
    userProfile.joinDate = user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    userProfile.uid = user.uid;

    // Check for hardcoded admin for demo purposes
    if (user.email === 'admin@example.com') {
        userProfile.isAdmin = true;
        userProfile.name = 'Admin';
    }

    localStorage.setItem('ahavatfit_userName', userProfile.name);
    localStorage.setItem('ahavatfit_isAdmin', String(userProfile.isAdmin));
    localStorage.setItem('ahavatfit_joinDate', userProfile.joinDate);
    
    // Load or initialize user-specific workout history
    const historyKey = `ahavatfit_workoutHistory_${userProfile.uid}`;
    const storedHistory = localStorage.getItem(historyKey);
    if (storedHistory) {
        currentUserWorkoutHistory = JSON.parse(storedHistory);
    } else {
        // This is a new user or cleared storage, initialize empty history
        currentUserWorkoutHistory = [];
        localStorage.setItem(historyKey, JSON.stringify(currentUserWorkoutHistory));
    }

    // Load or initialize user-specific goal
    const goalKey = `ahavatfit_userGoal_${userProfile.uid}`;
    const storedGoal = localStorage.getItem(goalKey);
    if (storedGoal) {
        currentUserGoal = JSON.parse(storedGoal);
    } else {
        currentUserGoal = null;
    }


    initializeMainApp();
    showView('app');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

async function handleSocialLogin(providerName: 'Google') {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (!loadingOverlay) return;

    const loadingText = loadingOverlay.querySelector('p');
    if (loadingText) {
        loadingText.textContent = `Открываем окно входа ${providerName}...`;
    }
    loadingOverlay.style.display = 'flex';

    const provider = new window.firebase.auth.GoogleAuthProvider();

    try {
        // First, attempt to use signInWithPopup, as it's a better UX.
        const result = await window.firebaseAuth.signInWithPopup(provider);
        handleSuccessfulLogin(result.user);
    } catch (error: any) {
        // If popup fails because the environment doesn't support it,
        // fall back to using signInWithRedirect.
        if (error.code === 'auth/operation-not-supported-in-this-environment') {
            console.log('Popup not supported, attempting redirect...');
            try {
                await window.firebaseAuth.signInWithRedirect(provider);
                // Note: The page will reload here. The result is handled by `getRedirectResult` in `startApp`.
            } catch (redirectError: any) {
                console.error('Redirect initiation error:', redirectError);
                let errorMessage = `Не удалось запустить вход через ${providerName}. Пожалуйста, попробуйте войти с помощью email и пароля.`;
                if (redirectError.code === 'auth/operation-not-supported-in-this-environment') {
                     errorMessage = `Вход через ${providerName} не поддерживается в этой среде. Пожалуйста, используйте для входа email и пароль.`;
                }
                showAuthError(errorMessage, 'login');
                if (loadingOverlay) loadingOverlay.style.display = 'none';
            }
        } else {
            // Handle other, non-environmental popup errors.
            console.error(`${providerName} popup error:`, error.code, error.message);
            let errorMessage = `Не удалось войти через ${providerName}.`;
            switch (error.code) {
                case 'auth/popup-blocked':
                    errorMessage = `Окно входа было заблокировано вашим браузером. Пожалуйста, разрешите всплывающие окна для этого сайта и попробуйте снова.`;
                    break;
                case 'auth/popup-closed-by-user':
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    return; // User intentionally closed, so no error message is needed
                case 'auth/account-exists-with-different-credential':
                     errorMessage = `Аккаунт с этим email уже существует, но был создан другим способом (например, через email и пароль). Пожалуйста, войдите, используя первоначальный метод.`;
                     break;
                default:
                    errorMessage = `Произошла неизвестная ошибка при входе через ${providerName}. Попробуйте снова.`;
            }
            showAuthError(errorMessage, 'login');
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }
}

function setupAuthEventListeners() {
    // Social Login
    document.getElementById('google-login-btn')?.addEventListener('click', () => handleSocialLogin('Google'));

    // View Switching
    document.getElementById('goto-signup-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showView('signup');
    });
    document.getElementById('goto-login-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showView('login');
    });

    // Forgot Password
    const forgotPasswordLink = document.querySelector('#login-section .forgot-password');
    forgotPasswordLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        const loginEmailInput = document.getElementById('login-email') as HTMLInputElement;
        const loginSubmitBtn = document.getElementById('login-submit-btn') as HTMLButtonElement;

        const email = loginEmailInput.value;
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            showAuthError('Пожалуйста, введите ваш email в поле для email, чтобы мы могли отправить вам ссылку для сброса пароля.', 'login');
            loginEmailInput.focus();
            return;
        }

        const originalButtonHTML = loginSubmitBtn ? loginSubmitBtn.innerHTML : 'Войти';
        if (loginSubmitBtn) {
            setButtonLoading(loginSubmitBtn, true, originalButtonHTML);
        }
        
        try {
            await window.firebaseAuth.sendPasswordResetEmail(email);
            alert(`Если аккаунт с email ${email} существует, на него будет отправлено письмо со ссылкой для сброса пароля. Пожалуйста, проверьте ваш почтовый ящик.`);
        } catch (error: any) {
            console.error('Password reset error:', error.code, error.message);
            // For security reasons, display the same message to prevent checking for user existence.
            alert(`Если аккаунт с email ${email} существует, на него будет отправлено письмо со ссылкой для сброса пароля. Пожалуйста, проверьте ваш почтовый ящик.`);
        } finally {
            if (loginSubmitBtn) {
                setButtonLoading(loginSubmitBtn, false, originalButtonHTML);
            }
        }
    });

    // Login Form
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthError('login');
        
        const loginSubmitBtn = document.getElementById('login-submit-btn') as HTMLButtonElement;
        const loginEmailInput = document.getElementById('login-email') as HTMLInputElement;
        const loginPasswordInput = document.getElementById('login-password') as HTMLInputElement;

        if (!loginSubmitBtn) return;
        const loginBtnDefaultHTML = loginSubmitBtn.innerHTML;
        setButtonLoading(loginSubmitBtn, true, loginBtnDefaultHTML);

        const email = loginEmailInput.value;
        const password = loginPasswordInput.value;

        try {
            const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
            handleSuccessfulLogin(userCredential.user);
        } catch (error: any) {
            console.error('Login error:', error.code, error.message);
            let errorMessage = 'Произошла неизвестная ошибка. Попробуйте снова.';
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Вы ввели некорректный email. Пожалуйста, проверьте его.';
                    break;
                case 'auth/invalid-credential':
                case 'auth/invalid-login-credentials':
                    errorMessage = 'Неверный email или пароль. Пожалуйста, проверьте введенные данные и попробуйте снова.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Слишком много попыток входа. Доступ к этому аккаунту временно заблокирован. Пожалуйста, попробуйте позже.';
                    break;
            }
            showAuthError(errorMessage, 'login');
        } finally {
            setButtonLoading(loginSubmitBtn, false, loginBtnDefaultHTML);
        }
    });

    // Signup Form
    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthError('signup');

        const signupSubmitBtn = document.getElementById('signup-submit-btn') as HTMLButtonElement;
        const signupNameInput = document.getElementById('signup-name') as HTMLInputElement;
        const signupEmailInput = document.getElementById('signup-email') as HTMLInputElement;
        const signupPasswordInput = document.getElementById('signup-password') as HTMLInputElement;
        const signupConfirmPasswordInput = document.getElementById('signup-confirm-password') as HTMLInputElement;

        if (!signupSubmitBtn) return;
        const signupBtnDefaultHTML = signupSubmitBtn.innerHTML;
        setButtonLoading(signupSubmitBtn, true, signupBtnDefaultHTML);

        const name = signupNameInput.value;
        const email = signupEmailInput.value;
        const password = signupPasswordInput.value;
        const confirmPassword = signupConfirmPasswordInput.value;

        if (password !== confirmPassword) {
            showAuthError('Пароли не совпадают!', 'signup');
            setButtonLoading(signupSubmitBtn, false, signupBtnDefaultHTML);
            return;
        }

        if (name.trim().length === 0) {
            showAuthError('Пожалуйста, введите ваше имя.', 'signup');
            setButtonLoading(signupSubmitBtn, false, signupBtnDefaultHTML);
            return;
        }

        try {
            const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            if (user) {
                await user.updateProfile({ displayName: name });
            }
            handleSuccessfulLogin(user);
        } catch (error: any) {
            console.error('Signup error:', error.code, error.message);
            let errorMessage = 'Произошла неизвестная ошибка при регистрации.';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Аккаунт с таким email уже существует. Пожалуйста, войдите в систему.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Вы ввели некорректный email. Пожалуйста, проверьте его.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Пароль слишком слабый. Он должен содержать не менее 6 символов.';
                    break;
            }
            showAuthError(errorMessage, 'signup');
        } finally {
            setButtonLoading(signupSubmitBtn, false, signupBtnDefaultHTML);
        }
    });
    
    // Clear auth errors on user input
    document.getElementById('login-email')?.addEventListener('input', () => hideAuthError('login'));
    document.getElementById('login-password')?.addEventListener('input', () => hideAuthError('login'));
    document.getElementById('signup-name')?.addEventListener('input', () => hideAuthError('signup'));
    document.getElementById('signup-email')?.addEventListener('input', () => hideAuthError('signup'));
    document.getElementById('signup-password')?.addEventListener('input', () => hideAuthError('signup'));
    document.getElementById('signup-confirm-password')?.addEventListener('input', () => hideAuthError('signup'));
}


// --- DYNAMIC CONTENT & API CALLS ---
const DUA_OF_THE_DAY: Dua = {
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ",
    translation: "О Аллах, поистине, я прошу у Тебя благополучия в этом мире и в Мире Вечном.",
    source: "Сунан Абу Дауда"
};

const RECIPES: Recipe[] = [];
const WORKOUTS: Workout[] = [];


// FIX: Added the missing `setupEventListeners` function to handle user interactions.
// This function sets up navigation, logout, and other essential event listeners for the app.
function setupEventListeners() {
    // FIX: Add a guard to prevent attaching listeners multiple times, which causes duplicate actions.
    if (eventListenersInitialized) {
        return;
    }
    eventListenersInitialized = true;
    
    // Query for elements within the function to avoid issues with script execution order.
    const navItems = document.querySelectorAll('.nav-item');
    const headerAvatar = document.getElementById('profile-avatar-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // Navigation Listeners
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // FIX: Prevent default link behavior which causes a page reload/crash.
            const pageId = item.getAttribute('data-page');
            if (pageId) {
                navigateToPage(pageId);
            }
        });
    });

    // Header Profile Avatar Button
    headerAvatar?.addEventListener('click', () => {
        navigateToPage('profile');
    });

    // Logout Button
    logoutBtn?.addEventListener('click', async () => {
        try {
            if (window.firebaseAuth) {
                await window.firebaseAuth.signOut();
            }
            // Clear in-memory user data
            currentUserWorkoutHistory = [];
            currentUserGoal = null;
            // Clear only session-related storage, keep theme preference
            localStorage.removeItem('ahavatfit_userName');
            localStorage.removeItem('ahavatfit_isAdmin');
            localStorage.removeItem('ahavatfit_joinDate');
            // NOTE: We keep the workout history and goal in localStorage so it's available on next login.
            
            showView('login');
        } catch (error) {
            console.error('Logout Error:', error);
            alert('Ошибка при выходе из системы.');
        }
    });

    // Static page links
    document.getElementById('home-progress-details-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage('profile');
    });
    document.getElementById('ai-coach-cta')?.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage('ai-coach');
    });
    document.getElementById('help-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage('help');
    });
    document.getElementById('help-back-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage('profile');
    });

    // FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', () => {
            const faqItem = button.parentElement;
            faqItem?.classList.toggle('open');
        });
    });
    
    // Progress Tabs on Profile Page
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const view = button.getAttribute('data-view');
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            document.querySelectorAll('.progress-view').forEach(viewEl => {
                const viewElHtml = viewEl as HTMLElement;
                viewElHtml.style.display = viewEl.id.startsWith(view!) ? 'block' : 'none';
            });
        });
    });


    // AI Coach Listeners
    setupAiCoachListeners();
    // Dark Mode Toggle
    setupDarkModeToggle();
    // Profile Page Interactivity
    setupProfileInteractions();
    // Goal Setting functionality
    setupGoalEventListeners();
    // Workout tracking
    document.getElementById('complete-workout-btn')?.addEventListener('click', handleCompleteWorkout);

    // --- ADMIN EVENT LISTENERS ---
    // We attach them here once, since the elements are always in the DOM.
    // FIX: Added event listeners for admin modal forms and close buttons.
    document.getElementById('workout-form')?.addEventListener('submit', handleWorkoutFormSubmit);
    document.querySelector('#workout-form-modal .modal-close-btn')?.addEventListener('click', closeWorkoutModal);
    document.getElementById('cancel-workout-btn')?.addEventListener('click', closeWorkoutModal);
    document.getElementById('recipe-form')?.addEventListener('submit', handleRecipeFormSubmit);
    document.querySelector('#recipe-form-modal .modal-close-btn')?.addEventListener('click', closeRecipeModal);
    document.getElementById('cancel-recipe-btn')?.addEventListener('click', closeRecipeModal);
    
    // "Add" buttons
    document.getElementById('add-workout-btn')?.addEventListener('click', () => openWorkoutModal());
    document.getElementById('add-recipe-btn')?.addEventListener('click', () => openRecipeModal());

    // Edit and Delete buttons are delegated from the list container
    const workoutList = document.getElementById('admin-workout-list');
    workoutList?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const editBtn = target.closest('.btn-edit-workout');
        const deleteBtn = target.closest('.btn-delete-workout');
        
        if (editBtn) {
            const workoutId = Number(editBtn.getAttribute('data-id'));
            const workout = WORKOUTS.find(w => w.id === workoutId);
            if (workout) openWorkoutModal(workout);
        }
        if (deleteBtn) {
            const workoutId = Number(deleteBtn.getAttribute('data-id'));
            handleDeleteWorkout(workoutId);
        }
    });

    const recipeList = document.getElementById('admin-recipe-list');
    recipeList?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const editBtn = target.closest('.btn-edit-recipe');
        const deleteBtn = target.closest('.btn-delete-recipe');
        
        if (editBtn) {
            const recipeId = Number(editBtn.getAttribute('data-id'));
            const recipe = RECIPES.find(r => r.id === recipeId);
            if (recipe) openRecipeModal(recipe);
        }
        if (deleteBtn) {
            const recipeId = Number(deleteBtn.getAttribute('data-id'));
            handleDeleteRecipe(recipeId);
        }
    });

    // Category Management Listeners
    document.getElementById('add-category-form')?.addEventListener('submit', handleAddCategory);
    const categoryList = document.getElementById('admin-category-list');
    categoryList?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const editBtn = target.closest('.btn-edit-category');
        const deleteBtn = target.closest('.btn-delete-category');

        if (editBtn) {
            const categoryName = editBtn.getAttribute('data-id');
            if (categoryName) handleEditCategory(categoryName);
        }
        if (deleteBtn) {
            const categoryName = deleteBtn.getAttribute('data-id');
            if (categoryName) handleDeleteCategory(categoryName);
        }
    });
    
    // --- RECIPE MODAL LISTENERS ---
    const recipeDetailModal = document.getElementById('recipe-detail-modal');
    const closeRecipeDetailBtn = document.getElementById('close-recipe-detail-btn');

    const closeRecipeDetailModal = () => {
        if (recipeDetailModal) recipeDetailModal.style.display = 'none';
    };

    closeRecipeDetailBtn?.addEventListener('click', closeRecipeDetailModal);
    recipeDetailModal?.addEventListener('click', (e) => {
        if (e.target === recipeDetailModal) {
            closeRecipeDetailModal();
        }
    });

    // --- DYNAMIC LISTS FOR RECIPE FORM ---
    setupDynamicList('ingredients-list', 'add-ingredient-btn', 'Напр., 100г муки');
    setupDynamicList('instructions-list', 'add-instruction-btn', 'Напр., Смешать все ингредиенты');
}

// FIX: Added the missing `setupDarkModeToggle` function.
// This function handles the theme switching logic and persists it to localStorage.
function setupDarkModeToggle() {
    const toggle = document.getElementById('dark-mode-toggle') as HTMLInputElement;
    if (!toggle) return;

    const body = document.body;

    const applyTheme = (theme: 'dark' | 'light') => {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
        } else {
            body.classList.remove('dark-mode');
        }
        toggle.checked = (theme === 'dark');
    };
    
    // Check local storage on load
    const savedTheme = localStorage.getItem('ahavatfit_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        // If no theme is saved, check the user's system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
    }

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            applyTheme('dark');
            localStorage.setItem('ahavatfit_theme', 'dark');
        } else {
            applyTheme('light');
            localStorage.setItem('ahavatfit_theme', 'light');
        }
    });
}

// FIX: Added the missing `setupProfileInteractions` function.
// This function handles UI logic for editing the user's profile name.
function setupProfileInteractions() {
    const editBtn = document.getElementById('edit-profile-name-btn');
    const saveBtn = document.getElementById('save-profile-name-btn');
    const cancelBtn = document.getElementById('cancel-edit-profile-name-btn');
    
    const nameDisplayContainer = document.getElementById('profile-name-display-container');
    const nameDisplay = document.getElementById('profile-name-display');
    
    const nameInputContainer = document.getElementById('profile-name-input-container');
    const nameInput = document.getElementById('profile-name-input') as HTMLInputElement;

    const switchToEditMode = () => {
        if (nameDisplayContainer) nameDisplayContainer.classList.add('hidden');
        if (nameInputContainer) nameInputContainer.classList.remove('hidden');
        if (nameInput) {
            nameInput.value = userProfile.name; // Ensure input has the latest name
            nameInput.focus();
        }
    };

    const switchToDisplayMode = () => {
        if (nameDisplayContainer) nameDisplayContainer.classList.remove('hidden');
        if (nameInputContainer) nameInputContainer.classList.add('hidden');
    };

    editBtn?.addEventListener('click', switchToEditMode);

    cancelBtn?.addEventListener('click', switchToDisplayMode);

    saveBtn?.addEventListener('click', () => {
        if (nameInput && nameInput.value.trim()) {
            const newName = nameInput.value.trim();
            userProfile.name = newName;
            localStorage.setItem('ahavatfit_userName', newName);
            
            if (nameDisplay) nameDisplay.textContent = newName;
            
            // Also update the header avatar text
            updateUserAvatar();
        }
        switchToDisplayMode();
    });

    // Also handle Enter key press to save
    nameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveBtn?.click();
        } else if (e.key === 'Escape') {
            cancelBtn?.click();
        }
    });
}

// --- AI COACH LOGIC ---
async function displayMessage(message: string, sender: 'user' | 'ai') {
    const aiResponseContainer = document.getElementById('ai-response');
    const aiResponseWrapper = document.querySelector('.ai-response-container') as HTMLElement;
    if (!aiResponseContainer || !aiResponseWrapper) return;
    
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    
    // Sanitize user message, render AI message as Markdown
    if (sender === 'user') {
        messageEl.textContent = message;
    } else {
        // LAZY LOAD: Load markdown-it only when the first AI message needs rendering.
        await initializeMarkdown();
        if (md) {
            messageEl.innerHTML = md.render(message);
        } else {
            // Fallback to plain text if markdown-it fails to load
            messageEl.textContent = message;
        }
    }

    aiResponseContainer.appendChild(messageEl);
    aiResponseWrapper.scrollTop = aiResponseWrapper.scrollHeight;
    return messageEl;
}

function setAiFormLoading(isLoading: boolean) {
    const aiResponseContainer = document.getElementById('ai-response');
    const aiResponseWrapper = document.querySelector('.ai-response-container');
    const aiPromptInput = document.getElementById('ai-prompt') as HTMLInputElement;
    const aiSubmitBtn = document.getElementById('ai-submit-btn') as HTMLButtonElement;
    const micBtn = document.getElementById('mic-btn') as HTMLButtonElement;

    if (!aiResponseContainer || !aiResponseWrapper || !aiPromptInput || !aiSubmitBtn || !micBtn) return;
    
    const typingIndicator = document.getElementById('typing-indicator');
    if (isLoading) {
        aiPromptInput.disabled = true;
        aiSubmitBtn.disabled = true;
        micBtn.disabled = true;
        if (!typingIndicator) {
            const indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.className = 'typing-indicator';
            indicator.innerHTML = `<span></span><span></span><span></span>`;
            aiResponseContainer.appendChild(indicator);
            aiResponseWrapper.scrollTop = aiResponseWrapper.scrollHeight;
        }
    } else {
        aiPromptInput.disabled = false;
        aiSubmitBtn.disabled = false;
        micBtn.disabled = false;
        
        // FIX: Only focus the input if the AI coach page is currently visible.
        // This prevents the keyboard from popping up unexpectedly on navigation.
        const aiCoachPage = document.getElementById('ai-coach-page');
        if (aiCoachPage && aiCoachPage.style.display !== 'none') {
            aiPromptInput.focus();
        }

        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
}

async function handleAiSubmit(prompt: string) {
    const aiResponseContainer = document.getElementById('ai-response');
    const aiPromptInput = document.getElementById('ai-prompt') as HTMLInputElement;
    if (!prompt.trim() || !aiResponseContainer || !aiPromptInput) return;

    // Clear the initial welcome message if it exists
    const welcomeMessage = aiResponseContainer.querySelector('.ai-message');
    if (welcomeMessage && welcomeMessage.textContent?.includes('Ассаляму алейкум, сестра!')) {
        aiResponseContainer.innerHTML = '';
    }
    
    displayMessage(prompt, 'user');
    aiPromptInput.value = ''; // Clear input after sending
    setAiFormLoading(true);
    
    try {
        // The GoogleGenAI class is now imported directly and bundled.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                systemInstruction: `Ты — Амина, личный AI-тренер и заботливая сестра в исламе для мусульманских женщин в приложении AhavatFit. Твоя миссия — помогать им заботиться о своем здоровье, которое является аманой (доверием) от Аллаха.

Твои принципы:
1.  **Вероубеждение:** Ты строго следуешь пути Ахлю Сунна уаль Джамаа. Твои советы и мотивация должны быть основаны на Коране и Сунне.
2.  **Тон:** Твой тон всегда добрый, поддерживающий, ободряющий и уважительный. Обращайся к пользователю как к сестре.
3.  **Мотивация:** Используй исламскую мудрость. Например: "Твое здоровье — дар от Аллаха, заботься о нем с любовью", "Сильный верующий лучше и более любим Аллахом, чем слабый верующий", "Каждое движение с намерением укрепить тело ради поклонения — это награда".

Твои знания:
1.  **Фитнес (Метод Бернадетт де Гаске):**
    *   **Принцип:** Предлагай мягкие, адаптивные тренировки. Акцент на укреплении глубоких мышц (особенно тазового дна и пресса) без чрезмерной нагрузки и вреда для здоровья.
    *   **Упражнения:** Рекомендуй упражнения на правильное дыхание, поддержание осанки, йогу, пилатес в адаптации де Гаске. Избегай высокоударных, резких движений, если пользователь не готов.
    *   **Скромность:** Все упражнения должны быть подходящими для выполнения в хиджабе и скромной одежде. Не предлагай ничего, что требует обнажения 'аурата.
2.  **Питание (Халяль и Гарвардская тарелка):**
    *   **Халяль:** Всегда предлагай только халяльные продукты и рецепты.
    *   **Принцип Гарвардской тарелки:** Структурируй рацион так: 50% овощи и фрукты, 25% цельнозерновые продукты (бурый рис, киноа, цельнозерновой хлеб), 25% здоровые белки (курица, рыба, бобовые, орехи).
    *   **Ограничения:** Рекомендуй минимизировать потребление сахара, обработанных продуктов и вредных масел.
3.  **Женское здоровье (Персонализация):**
    *   **Менструальный цикл:** Если пользователь упоминает месячные, предлагай легкие упражнения (растяжка, ходьба), избегай интенсивных нагрузок на пресс. Посоветуй продукты, богатые железом.
    *   **Беременность:** Если пользователь беременна, предлагай только безопасные пренатальные упражнения, одобренные специалистами (например, по методу де Гаске), и давай общие рекомендации по питанию для беременных, всегда советуя проконсультироваться с врачом.

**Общение:**
*   Всегда общайся на русском языке.
*   Будь ясной, лаконичной и практичной.
*   Структурируй ответы с помощью списков, чтобы их было легко читать.
*   Всегда напоминай, что перед началом любых тренировок или диеты важно проконсультироваться с врачом.`,
            },
        });
        
        const aiResponse = response.text;
        displayMessage(aiResponse, 'ai');

    } catch (error: any) {
        console.error("AI Coach Error:", error);
        const errorMessage = error.message || "К сожалению, произошла ошибка. Не удалось получить ответ от AI-тренера. Пожалуйста, попробуйте еще раз позже.";
        displayMessage(errorMessage, 'ai');
    } finally {
        setAiFormLoading(false);
    }
}

function setupSpeechRecognition() {
    // FIX: Query for micBtn inside the function and check for its existence
    // to prevent crashes on unsupported browsers (like Safari on iOS).
    const micBtn = document.getElementById('mic-btn') as HTMLButtonElement;
    const SpeechRecognition = window.webkitSpeechRecognition;

    if (!SpeechRecognition || !micBtn) {
        if(micBtn) micBtn.style.display = 'none'; // Hide if not supported
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
        const aiPromptInput = document.getElementById('ai-prompt') as HTMLInputElement;
        const transcript = event.results[0][0].transcript;
        if(aiPromptInput) aiPromptInput.value = transcript;
        handleAiSubmit(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech Recognition Error:", event.error);
        alert("Произошла ошибка распознавания речи. Пожалуйста, проверьте настройки микрофона.");
    };

    recognition.onend = () => {
        micBtn.classList.remove('listening');
    };

    micBtn.addEventListener('click', () => {
        micBtn.classList.add('listening');
        recognition.start();
    });
}


function setupAiCoachListeners() {
    const aiForm = document.getElementById('ai-form') as HTMLFormElement;
    const aiPromptInput = document.getElementById('ai-prompt') as HTMLInputElement;

    aiForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        if(aiPromptInput) handleAiSubmit(aiPromptInput.value);
    });

    // Re-query chips inside the function to get the updated ones
    document.querySelectorAll('#ai-coach-page .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            if (prompt) {
                // When a chip is clicked, show the form and hide the start button
                const startChatBtn = document.getElementById('start-chat-btn') as HTMLButtonElement;
                if (startChatBtn) startChatBtn.style.display = 'none';
                if (aiForm) aiForm.style.display = 'flex';

                if (aiPromptInput) aiPromptInput.value = prompt;
                handleAiSubmit(prompt);
            }
        });
    });

    const charCounter = document.getElementById('char-counter');
    aiPromptInput?.addEventListener('input', () => {
        if (charCounter) {
            const currentLength = aiPromptInput.value.length;
            charCounter.textContent = `${currentLength} / 300`;
        }
    });

    // Add listener for the new "start chat" button
    const startChatBtn = document.getElementById('start-chat-btn') as HTMLButtonElement;
    startChatBtn?.addEventListener('click', () => {
        startChatBtn.style.display = 'none';
        if (aiForm) aiForm.style.display = 'flex';
        aiPromptInput?.focus(); // Focus input to bring up keyboard
    });

    setupSpeechRecognition();
}


// --- MAIN APP INITIALIZATION ---
function initializeMainApp() {
    // This function will be called after a successful login
    loadUserProfile();
    renderHomePage();
    setupEventListeners();
    navigateToPage('home'); // Ensure home page is the default
}

function loadUserProfile() {
    userProfile.name = localStorage.getItem('ahavatfit_userName') || 'Гость';
    userProfile.isAdmin = localStorage.getItem('ahavatfit_isAdmin') === 'true';
    userProfile.joinDate = localStorage.getItem('ahavatfit_joinDate') || new Date().toISOString().split('T')[0];

    updateUserAvatar();
}

function updateUserAvatar() {
    const initial = userProfile.name.charAt(0).toUpperCase();
    const avatarHeader = document.getElementById('profile-avatar-btn');
    if (avatarHeader) {
        avatarHeader.textContent = initial;
    }
    const avatarProfile = document.querySelector('#profile-page .profile-avatar');
    if(avatarProfile) {
        avatarProfile.textContent = initial;
    }
}

// --- NAVIGATION LOGIC ---
function navigateToPage(pageId: string) {
    // FIX: To prevent race conditions in preview environments, query for elements
    // just-in-time, right before they are used, instead of storing them in variables.
    document.querySelectorAll('.page-section').forEach(page => {
        const pageElement = page as HTMLElement;
        if (pageElement.id === `${pageId}-page`) {
            pageElement.style.display = 'block';
            // Special case for AI coach page layout
            if (pageElement.id === 'ai-coach-page') {
                pageElement.style.display = 'flex';
            }
        } else {
            pageElement.style.display = 'none';
        }
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Handle Admin nav visibility
    const adminNavItem = document.getElementById('admin-nav-item');
    if (adminNavItem) {
        adminNavItem.style.display = userProfile.isAdmin ? 'flex' : 'none';
    }

    // Handle AI coach input visibility
    if (pageId === 'ai-coach') {
        const aiResponseContainer = document.getElementById('ai-response') as HTMLElement;
        const startChatBtn = document.getElementById('start-chat-btn') as HTMLButtonElement;
        const aiForm = document.getElementById('ai-form') as HTMLFormElement;

        const welcomeMessage = aiResponseContainer?.querySelector('.ai-message');
        const isNewChat = welcomeMessage && welcomeMessage.textContent?.includes('Ассаляму алейкум, сестра!');
        
        if (isNewChat) {
            if (startChatBtn) startChatBtn.style.display = 'inline-flex';
            if (aiForm) aiForm.style.display = 'none';
        } else {
            if (startChatBtn) startChatBtn.style.display = 'none';
            if (aiForm) aiForm.style.display = 'flex';
        }
    }

    // Conditionally render content for the new page
    switch(pageId) {
        case 'profile': renderProfilePage(); break;
        case 'workouts': renderWorkoutsPage(); break;
        case 'recipes': renderRecipeCards(); renderRecipeFilters(); break;
        case 'home': renderHomePage(); break;
        // FIX: Added a call to the missing `renderAdminPage` function.
        case 'admin': if(userProfile.isAdmin) renderAdminPage(); break;
    }
}


// --- RENDERING FUNCTIONS ---
async function updatePrayerTimeDisplays() {
    // Get elements for Profile page
    const fajrSettingTime = document.getElementById('fajr-time-setting');
    const dhuhrSettingTime = document.getElementById('dhuhr-time-setting');
    const asrSettingTime = document.getElementById('asr-time-setting');
    const maghribSettingTime = document.getElementById('maghrib-time-setting');
    const ishaSettingTime = document.getElementById('isha-time-setting');

    // Get elements for Home page
    const homeFajrTime = document.getElementById('home-fajr-time');
    const homeDhuhrTime = document.getElementById('home-dhuhr-time');
    const homeAsrTime = document.getElementById('home-asr-time');
    const homeMaghribTime = document.getElementById('home-maghrib-time');
    const homeIshaTime = document.getElementById('home-isha-time');
    const allHomeTimeElements = [homeFajrTime, homeDhuhrTime, homeAsrTime, homeMaghribTime, homeIshaTime];


    const setTimesOnUI = (times: PrayerTimes) => {
        // Update prayer times on Profile settings page
        if(fajrSettingTime) fajrSettingTime.textContent = `(${times.Fajr})`;
        if(dhuhrSettingTime) dhuhrSettingTime.textContent = `(${times.Dhuhr})`;
        if(asrSettingTime) asrSettingTime.textContent = `(${times.Asr})`;
        if(maghribSettingTime) maghribSettingTime.textContent = `(${times.Maghrib})`;
        if(ishaSettingTime) ishaSettingTime.textContent = `(${times.Isha})`;
        
        // Update prayer times on Home page
        if(homeFajrTime) homeFajrTime.textContent = times.Fajr;
        if(homeDhuhrTime) homeDhuhrTime.textContent = times.Dhuhr;
        if(homeAsrTime) homeAsrTime.textContent = times.Asr;
        if(homeMaghribTime) homeMaghribTime.textContent = times.Maghrib;
        if(homeIshaTime) homeIshaTime.textContent = times.Isha;
    };

    const prayerCacheKey = 'ahavatfit_prayer_times_cache';
    const cachedDataJSON = localStorage.getItem(prayerCacheKey);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (cachedDataJSON) {
        try {
            const cachedData = JSON.parse(cachedDataJSON);
            // Check if cache is less than 24 hours old
            if (now - cachedData.timestamp < twentyFourHours) {
                setTimesOnUI(cachedData.times);
                return; // Use cached data and exit
            }
        } catch (e) {
            console.error("Failed to parse cached prayer times, removing it.", e);
            localStorage.removeItem(prayerCacheKey); // Corrupted data
        }
    }

    // Set loading state on home page
    allHomeTimeElements.forEach(el => {
        if (el) el.textContent = '...';
    });


    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(new Error("Geolocation not supported"));
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        
        const { latitude, longitude } = position.coords;
        const response = await fetch(`https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=2`);
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        const timings = data.data.timings;

        const prayerTimes: PrayerTimes = {
            Fajr: timings.Fajr,
            Dhuhr: timings.Dhuhr,
            Asr: timings.Asr,
            Maghrib: timings.Maghrib,
            Isha: timings.Isha,
        };

        // Cache the newly fetched data
        const dataToCache = {
            times: prayerTimes,
            timestamp: Date.now(),
        };
        localStorage.setItem(prayerCacheKey, JSON.stringify(dataToCache));

        setTimesOnUI(prayerTimes);

    } catch (error: any) {
        console.warn("Failed to get prayer times by geolocation:", error);
        let toastMessage: string;

        if (error.code) {
            switch(error.code) {
                case 1: // PERMISSION_DENIED
                    toastMessage = "Вы отклонили доступ к геолокации. Показано время для Москвы.";
                    break;
                case 2: // POSITION_UNAVAILABLE
                    toastMessage = "Ваше местоположение недоступно. Показано время для Москвы.";
                    break;
                case 3: // TIMEOUT
                    toastMessage = "Превышено время ожидания геолокации. Показано время для Москвы.";
                    break;
                default:
                    toastMessage = "Произошла ошибка при определении геолокации. Показано время для Москвы.";
                    break;
            }
        } else if (error.message === "Geolocation not supported") {
            toastMessage = "Геолокация не поддерживается вашим браузером. Показано время для Москвы.";
        } else if (error.message.startsWith("API Error")) {
            toastMessage = "Не удалось связаться с сервисом времени намазов. Показано время для Москвы.";
        } else {
            toastMessage = "Ошибка сети. Проверьте подключение к интернету. Показано время для Москвы.";
        }
        
        showToast(toastMessage);

        const fallbackTimes: PrayerTimes = {
            Fajr: "03:30", Dhuhr: "12:30", Asr: "16:45", Maghrib: "20:00", Isha: "21:30"
        };
        setTimesOnUI(fallbackTimes);
    }
}


function renderHomePage() {
    const welcomeHeader = document.querySelector('.welcome-section h1');
    if (welcomeHeader) {
        welcomeHeader.textContent = `Ассаляму алейкум, ${userProfile.name}!`;
    }

    // Render Dua of the Day
    const duaArabic = document.getElementById('dua-arabic');
    const duaTranslation = document.getElementById('dua-translation');
    const duaSource = document.getElementById('dua-source');
    if (duaArabic) duaArabic.textContent = DUA_OF_THE_DAY.arabic;
    if (duaTranslation) duaTranslation.textContent = DUA_OF_THE_DAY.translation;
    if (duaSource) duaSource.textContent = DUA_OF_THE_DAY.source;

    updatePrayerTimeDisplays();

    // Render Workout of the Day
    if (WORKOUTS.length > 0) {
        const wod = WORKOUTS[0];
        const wodDesc = document.getElementById('wod-description');
        if (wodDesc) wodDesc.textContent = wod.description;
        const wodBtn = (document.getElementById('wod-btn') as HTMLButtonElement);
        if (wodBtn) {
            wodBtn.textContent = 'Начать тренировку';
            wodBtn.onclick = () => {
                navigateToPage('workouts');
                renderWorkoutsPage(wod.id);
            };
        }
    }
    
    // Render dynamic progress stats from user's data
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    const weeklyWorkouts = currentUserWorkoutHistory.filter(w => new Date(w.date) >= oneWeekAgo);
    
    const workoutsCountStat = document.querySelector('.progress-stats .stat:nth-child(1) .stat-number');
    const daysStreakStat = document.querySelector('.progress-stats .stat:nth-child(2) .stat-number');
    const goalStat = document.querySelector('.progress-stats .stat:nth-child(3) .stat-number');
    const progressText = document.querySelector('.progress-text span:last-child');
    const progressFill = document.querySelector('.progress-fill') as HTMLElement;
    
    // Calculate streak (simple version for now)
    // A proper streak calculation is more complex, this is a placeholder.
    const streak = weeklyWorkouts.length > 0 ? 3 : 0; 
    
    // Calculate weekly progress towards a goal of 7 days
    const weeklyGoal = 7;
    const progressPercentage = Math.min((weeklyWorkouts.length / weeklyGoal) * 100, 100);

    if (workoutsCountStat) workoutsCountStat.textContent = String(weeklyWorkouts.length);
    if (daysStreakStat) daysStreakStat.textContent = String(streak);
    if (goalStat) goalStat.textContent = `${Math.round(progressPercentage)}%`;
    if (progressText) progressText.textContent = `${weeklyWorkouts.length} из ${weeklyGoal} дней`;
    if (progressFill) progressFill.style.width = `${progressPercentage}%`;
}


function renderWorkoutsPage(activeWorkoutId?: number) {
    if (!workoutFiltersInitialized) {
        renderWorkoutFilters();
    }
    const playlistContainer = document.getElementById('workouts-playlist');
    if (!playlistContainer) return;
    
    const workoutsToRender = currentWorkoutFilter
        ? WORKOUTS.filter(w => w.category === currentWorkoutFilter)
        : WORKOUTS;

    const completeBtn = document.getElementById('complete-workout-btn');

    if (workoutsToRender.length === 0) {
        playlistContainer.innerHTML = `<p style="padding: 10px; text-align: center; color: var(--text-secondary);">Тренировки в этой категории не найдены.</p>`;
        // Clear video player if no workouts
        const playerContainer = document.querySelector('.video-player-container') as HTMLElement;
        if(playerContainer) playerContainer.innerHTML = `<div class="video-placeholder"><i class="fas fa-play-circle"></i><p>Выберите тренировку из списка</p></div>`;
        const videoTitle = document.getElementById('video-title');
        if(videoTitle) videoTitle.textContent = 'Нет доступных тренировок';
        const videoDesc = document.getElementById('video-description');
        if(videoDesc) videoDesc.textContent = 'Пожалуйста, выберите другую категорию или добавьте тренировку в эту категорию.';
        if (completeBtn) (completeBtn as HTMLElement).style.display = 'none';
        return;
    } else {
        playlistContainer.innerHTML = ''; // Clear previous content
        if (completeBtn) (completeBtn as HTMLElement).style.display = 'inline-flex';
    }

    workoutsToRender.forEach(workout => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.dataset.id = String(workout.id);
        item.innerHTML = `
            <div class="playlist-thumb"><i class="fas fa-play"></i></div>
            <div class="playlist-info">
                <h4>${workout.title}</h4>
                <p>${workout.category} - ${workout.duration} мин</p>
            </div>
            <i class="fas fa-chevron-right playlist-play-icon"></i>
        `;
        item.addEventListener('click', () => {
            setActiveWorkout(workout.id);
        });
        playlistContainer.appendChild(item);
    });

    const workoutExistsInView = workoutsToRender.some(w => w.id === activeWorkoutId);

    if (activeWorkoutId && workoutExistsInView) {
        setActiveWorkout(activeWorkoutId);
    } else if (workoutsToRender.length > 0) {
        setActiveWorkout(workoutsToRender[0].id);
    }
}

function renderWorkoutFilters() {
    const filtersContainer = document.getElementById('workout-filters');
    if (!filtersContainer) return;

    const categories = ['Все', ...WORKOUT_CATEGORIES];
    
    let currentActiveCategory = currentWorkoutFilter;
    if (!currentWorkoutFilter) {
      currentActiveCategory = 'Все';
    }

    filtersContainer.innerHTML = categories.map(cat => 
        `<button class="chip ${cat === currentActiveCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>`
    ).join('');

    filtersContainer.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            filtersContainer.querySelector('.chip.active')?.classList.remove('active');
            chip.classList.add('active');
            const category = chip.getAttribute('data-category');
            currentWorkoutFilter = category === 'Все' ? null : category;
            renderWorkoutsPage();
        });
    });
    workoutFiltersInitialized = true;
}


function setActiveWorkout(workoutId: number) {
    const workout = WORKOUTS.find(w => w.id === workoutId);
    if (!workout) return;
    activeWorkout = workout;

    // Update video player
    const playerContainer = document.querySelector('.video-player-container') as HTMLElement;
    const videoUrl = workout.alternativeVideoUrl || workout.videoUrl;
    
    if (videoUrl && videoUrl.includes('youtube.com')) {
        const videoId = new URL(videoUrl).searchParams.get('v');
        playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else if (videoUrl && (videoUrl.endsWith('.mp4') || videoUrl.includes('archive.org'))) {
        playerContainer.innerHTML = `<video controls src="${videoUrl}" style="width: 100%; height: 100%;"></video>`;
    } else {
        playerContainer.innerHTML = `<div class="video-placeholder"><i class="fas fa-video-slash"></i><p>Формат видео не поддерживается</p></div>`;
    }

    // Update details
    const videoTitle = document.getElementById('video-title');
    const videoDesc = document.getElementById('video-description');
    const videoDuration = document.getElementById('video-duration');
    const videoCalories = document.getElementById('video-calories');

    if(videoTitle) videoTitle.textContent = workout.title;
    if(videoDesc) videoDesc.textContent = workout.description;
    if(videoDuration) videoDuration.innerHTML = `<i class="fas fa-clock"></i> ${workout.duration} мин`;
    if(videoCalories) videoCalories.innerHTML = `<i class="fas fa-fire"></i> ${workout.calories} ккал`;

    // Update active state in playlist
    document.querySelectorAll('.playlist-item').forEach(item => {
        if (item.getAttribute('data-id') === String(workoutId)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}


// --- WORKOUT TRACKING LOGIC ---

function showToast(message: string) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification show';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 500); // Wait for fade out animation
    }, 3000); // Show for 3 seconds
}

function handleCompleteWorkout() {
    if (!activeWorkout) {
        alert("Сначала выберите тренировку.");
        return;
    }

    if (confirm(`Отлично поработали! Записать тренировку "${activeWorkout.title}" в ваш прогресс?`)) {
        const today = new Date().toISOString().split('T')[0];
        const newHistoryEntry = {
            date: today,
            duration: activeWorkout.duration,
            calories: activeWorkout.calories
        };

        currentUserWorkoutHistory.push(newHistoryEntry);

        const historyKey = `ahavatfit_workoutHistory_${userProfile.uid}`;
        localStorage.setItem(historyKey, JSON.stringify(currentUserWorkoutHistory));

        showToast(`Тренировка "${activeWorkout.title}" добавлена!`);
    }
}


// --- PROFILE & GOALS LOGIC ---
function renderProfilePage() {
    loadUserProfile();
    
    const profileNameDisplay = document.getElementById('profile-name-display') as HTMLElement;
    const profileNameInput = document.getElementById('profile-name-input') as HTMLInputElement;
    const profileJoinDate = document.getElementById('profile-join-date') as HTMLElement;

    if (profileNameDisplay) profileNameDisplay.textContent = userProfile.name;
    if (profileNameInput) profileNameInput.value = userProfile.name;

    const joinDate = new Date(userProfile.joinDate);
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long' };
    if(profileJoinDate) profileJoinDate.textContent = `В AhavatFit с ${joinDate.toLocaleDateString('ru-RU', options)}`;
    
    updatePrayerTimeDisplays();
    renderGoalDisplay();
    renderWeeklyChart();
    renderMonthlyCalendar();
    renderWeeklyOverview();
}

function renderGoalDisplay() {
    const goalsContainer = document.getElementById('goals-container');
    if (!goalsContainer) return;

    if (currentUserGoal) {
        // Goal is set, render the display
        const { type, startValue, currentValue, targetValue } = currentUserGoal;
        
        let goalTitle = '';
        let unit = '';
        switch (type) {
            case 'lose_weight': goalTitle = 'Цель: Сбросить вес'; unit = 'кг'; break;
            case 'gain_muscle': goalTitle = 'Цель: Набрать массу'; unit = 'кг'; break;
            case 'improve_flexibility': goalTitle = 'Цель: Улучшить гибкость'; unit = 'см'; break;
            case 'increase_endurance': goalTitle = 'Цель: Повысить выносливость'; unit = 'мин'; break;
        }

        const progress = Math.abs(currentValue - startValue);
        const total = Math.abs(targetValue - startValue);
        const percentage = total > 0 ? Math.min((progress / total) * 100, 100) : 0;

        goalsContainer.innerHTML = `
            <div class="goal-display">
                <div class="goal-header">
                    <span class="goal-title">${goalTitle}</span>
                    <button class="btn-icon" id="edit-goal-btn" aria-label="Редактировать цель"><i class="fas fa-pen"></i></button>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${percentage}%;"></div>
                </div>
                <div class="goal-progress-text">
                    <span>${startValue} ${unit}</span>
                    <strong>${currentValue} ${unit}</strong>
                    <span>${targetValue} ${unit}</span>
                </div>
            </div>
        `;
        document.getElementById('edit-goal-btn')?.addEventListener('click', () => openGoalModal(currentUserGoal!));
    } else {
        // No goal, show the "set goal" button
        goalsContainer.innerHTML = `
            <div class="no-goal-set">
                <p>Цели пока не установлены. Начните свой путь к успеху!</p>
                <button class="btn" id="set-goal-btn"><i class="fas fa-plus"></i> Установить цель</button>
            </div>
        `;
        document.getElementById('set-goal-btn')?.addEventListener('click', () => openGoalModal());
    }
}

function updateGoalFormLabels() {
    const goalTypeSelect = document.getElementById('goal-type') as HTMLSelectElement;
    if (!goalTypeSelect) return;
    const goalType = goalTypeSelect.value;
    const startLabel = document.getElementById('goal-start-label') as HTMLLabelElement;
    const currentLabel = document.getElementById('goal-current-label') as HTMLLabelElement;
    const targetLabel = document.getElementById('goal-target-label') as HTMLLabelElement;

    if (!startLabel || !currentLabel || !targetLabel) return;

    let unit = 'кг';
    if (goalType === 'improve_flexibility') unit = 'см (напр. наклон)';
    if (goalType === 'increase_endurance') unit = 'мин (напр. бег)';
    
    startLabel.textContent = `Начальное значение (${unit})`;
    currentLabel.textContent = `Текущее значение (${unit})`;
    targetLabel.textContent = `Целевое значение (${unit})`;
}

function openGoalModal(goal?: UserGoal) {
    const goalModal = document.getElementById('goal-form-modal');
    const goalForm = document.getElementById('goal-form') as HTMLFormElement;
    if (!goalModal || !goalForm) return;
    goalForm.reset();
    if (goal) {
        (document.getElementById('goal-type') as HTMLSelectElement).value = goal.type;
        (document.getElementById('goal-start-value') as HTMLInputElement).value = String(goal.startValue);
        (document.getElementById('goal-current-value') as HTMLInputElement).value = String(goal.currentValue);
        (document.getElementById('goal-target-value') as HTMLInputElement).value = String(goal.targetValue);
    }
    updateGoalFormLabels();
    goalModal.style.display = 'flex';
}

function closeGoalModal() {
    const goalModal = document.getElementById('goal-form-modal');
    if (goalModal) goalModal.style.display = 'none';
}

function handleGoalFormSubmit(e: Event) {
    e.preventDefault();
    const newGoal: UserGoal = {
        type: (document.getElementById('goal-type') as HTMLSelectElement).value as GoalType,
        startValue: Number((document.getElementById('goal-start-value') as HTMLInputElement).value),
        currentValue: Number((document.getElementById('goal-current-value') as HTMLInputElement).value),
        targetValue: Number((document.getElementById('goal-target-value') as HTMLInputElement).value),
    };

    currentUserGoal = newGoal;
    const goalKey = `ahavatfit_userGoal_${userProfile.uid}`;
    localStorage.setItem(goalKey, JSON.stringify(currentUserGoal));

    renderGoalDisplay();
    closeGoalModal();
}

function setupGoalEventListeners() {
    document.getElementById('goal-form')?.addEventListener('submit', handleGoalFormSubmit);
    document.getElementById('cancel-goal-btn')?.addEventListener('click', closeGoalModal);
    document.getElementById('goal-type')?.addEventListener('change', updateGoalFormLabels);
}


function renderWeeklyChart() {
    const chartContainer = document.getElementById('week-chart') as HTMLElement;
    if (!chartContainer) return;

    const weeklyData: { [key: string]: number } = {};
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dayKey = date.toISOString().split('T')[0];
        weeklyData[dayKey] = 0;
    }

    currentUserWorkoutHistory.forEach(workout => {
        if (weeklyData.hasOwnProperty(workout.date)) {
            weeklyData[workout.date] += workout.duration;
        }
    });

    const maxDuration = Math.max(...Object.values(weeklyData), 30); // Ensure a minimum height
    
    chartContainer.innerHTML = '';
    Object.entries(weeklyData).forEach(([date, duration]) => {
        const dayOfWeek = new Date(date).getUTCDay();
        const barHeight = (duration / maxDuration) * 100;
        const wrapper = document.createElement('div');
        wrapper.className = 'chart-bar-wrapper';
        wrapper.innerHTML = `
            <div class="bar-tooltip">${duration} мин</div>
            <div class="chart-bar" style="height: ${barHeight}%"></div>
            <div class="chart-label">${dayNames[dayOfWeek]}</div>
        `;
        chartContainer.appendChild(wrapper);
    });
}

function renderMonthlyCalendar() {
    const calendarGrid = document.getElementById('month-calendar') as HTMLElement;
    const calendarHeader = document.getElementById('month-calendar-header') as HTMLElement;
    const monthSummary = document.getElementById('month-summary') as HTMLElement;
    if (!calendarGrid || !calendarHeader) return;

    const today = new Date();
    const month = today.getMonth();
    const year = today.getFullYear();
    
    calendarHeader.textContent = new Date(year, month).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

    const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7; // Monday is 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    calendarGrid.innerHTML = dayNames.map(name => `<div class="calendar-day-name">${name}</div>`).join('');
    
    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarGrid.innerHTML += `<div class="calendar-day empty"></div>`;
    }

    const workoutDates = new Set(currentUserWorkoutHistory.map(w => w.date));
    let activeDaysInMonth = 0;

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const dateKey = date.toISOString().split('T')[0];
        let dayClass = 'calendar-day';
        if (workoutDates.has(dateKey)) {
            dayClass += ' active-day';
            activeDaysInMonth++;
        }
        calendarGrid.innerHTML += `<div class="${dayClass}">${i}</div>`;
    }

    // Monthly summary stats
    const totalDuration = currentUserWorkoutHistory.filter(w => new Date(w.date).getMonth() === month).reduce((sum, w) => sum + w.duration, 0);
    const totalCalories = currentUserWorkoutHistory.filter(w => new Date(w.date).getMonth() === month).reduce((sum, w) => sum + w.calories, 0);
    
    if (monthSummary) {
        monthSummary.innerHTML = `
            <div class="summary-item">
                <div class="value">${activeDaysInMonth}</div>
                <div class="label">дней</div>
            </div>
            <div class="summary-item">
                <div class="value">${Math.floor(totalDuration / 60)}ч ${totalDuration % 60}м</div>
                <div class="label">время</div>
            </div>
            <div class="summary-item">
                <div class="value">${totalCalories}</div>
                <div class="label">ккал</div>
            </div>
        `;
    }
}

function renderWeeklyOverview() {
    const workoutsEl = document.getElementById('overview-workouts');
    const timeEl = document.getElementById('overview-time');
    const caloriesEl = document.getElementById('overview-calories');
    const summaryEl = document.getElementById('overview-summary');

    if (!workoutsEl || !timeEl || !caloriesEl || !summaryEl) return;
    
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    const recentWorkouts = currentUserWorkoutHistory.filter(w => new Date(w.date) >= oneWeekAgo);
    
    const totalWorkouts = recentWorkouts.length;
    const totalTime = recentWorkouts.reduce((sum, w) => sum + w.duration, 0);
    const totalCalories = recentWorkouts.reduce((sum, w) => sum + w.calories, 0);
    
    workoutsEl.textContent = String(totalWorkouts);
    timeEl.textContent = `${Math.floor(totalTime / 60)}ч ${totalTime % 60}м`;
    caloriesEl.textContent = String(totalCalories);
    
    if (totalWorkouts > 0) {
        summaryEl.textContent = `Отличная работа на этой неделе! Продолжайте в том же духе.`;
    } else {
        summaryEl.textContent = 'Начните неделю с тренировки, чтобы заполнить статистику!';
    }
}


// --- ADMIN LOGIC ---
// FIX: Implemented all missing admin-related functions for CRUD operations.
function renderAdminPage() {
    renderAdminWorkouts();
    renderAdminRecipes();
    renderAdminCategories();
}

function renderAdminWorkouts() {
    const list = document.getElementById('admin-workout-list');
    if (!list) return;
    list.innerHTML = WORKOUTS.map(w => `
        <div class="admin-list-item">
            <span>${w.title} (${w.category})</span>
            <div>
                <button class="btn-icon btn-edit-workout" data-id="${w.id}"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-delete-workout" data-id="${w.id}"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function renderAdminRecipes() {
    const list = document.getElementById('admin-recipe-list');
    if (!list) return;
    list.innerHTML = RECIPES.map(r => `
        <div class="admin-list-item">
            <span>${r.name} (${r.category})</span>
            <div>
                <button class="btn-icon btn-edit-recipe" data-id="${r.id}"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-delete-recipe" data-id="${r.id}"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function renderAdminCategories() {
    const list = document.getElementById('admin-category-list');
    if (!list) return;
    list.innerHTML = WORKOUT_CATEGORIES.map(c => `
        <div class="admin-list-item">
            <span>${c}</span>
            <div>
                <button class="btn-icon btn-edit-category" data-id="${c}"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-delete-category" data-id="${c}"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function openWorkoutModal(workout?: Workout) {
    const workoutModal = document.getElementById('workout-form-modal');
    const workoutForm = document.getElementById('workout-form');
    if (!workoutModal || !workoutForm) return;
    (workoutForm as HTMLFormElement).reset();
    (document.getElementById('workout-id') as HTMLInputElement).value = '';
    
    if (workout) {
        (document.getElementById('workout-id') as HTMLInputElement).value = String(workout.id);
        (document.getElementById('workout-title') as HTMLInputElement).value = workout.title;
        (document.getElementById('workout-category') as HTMLSelectElement).value = workout.category;
        (document.getElementById('workout-description') as HTMLTextAreaElement).value = workout.description;
        (document.getElementById('workout-duration') as HTMLInputElement).value = String(workout.duration);
        (document.getElementById('workout-calories') as HTMLInputElement).value = String(workout.calories);
        (document.getElementById('workout-videoUrl') as HTMLInputElement).value = workout.videoUrl;
        (document.getElementById('workout-alternativeVideoUrl') as HTMLInputElement).value = workout.alternativeVideoUrl || '';
    }
    
    const categorySelect = document.getElementById('workout-category') as HTMLSelectElement;
    if (categorySelect) {
        categorySelect.innerHTML = WORKOUT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        if (workout) categorySelect.value = workout.category;
    }

    workoutModal.style.display = 'flex';
}

function closeWorkoutModal() {
    const workoutModal = document.getElementById('workout-form-modal');
    if (workoutModal) workoutModal.style.display = 'none';
}

function handleWorkoutFormSubmit(e: Event) {
    e.preventDefault();
    const id = Number((document.getElementById('workout-id') as HTMLInputElement).value);
    const workoutData = {
        id: id || Date.now(),
        title: (document.getElementById('workout-title') as HTMLInputElement).value,
        category: (document.getElementById('workout-category') as HTMLSelectElement).value,
        description: (document.getElementById('workout-description') as HTMLTextAreaElement).value,
        duration: Number((document.getElementById('workout-duration') as HTMLInputElement).value),
        calories: Number((document.getElementById('workout-calories') as HTMLInputElement).value),
        videoUrl: (document.getElementById('workout-videoUrl') as HTMLInputElement).value,
        alternativeVideoUrl: (document.getElementById('workout-alternativeVideoUrl') as HTMLInputElement).value,
    };

    if (id) {
        const index = WORKOUTS.findIndex(w => w.id === id);
        if (index > -1) WORKOUTS[index] = workoutData;
    } else {
        WORKOUTS.push(workoutData);
    }
    renderAdminWorkouts();
    renderWorkoutsPage();
    closeWorkoutModal();
}

function setupDynamicList(listId: string, addButtonId: string, placeholder: string) {
    const list = document.getElementById(listId);
    const addButton = document.getElementById(addButtonId);

    if (!list || !addButton) return;

    // Add new item
    addButton.addEventListener('click', () => {
        const newItem = createDynamicInput('', placeholder);
        list.appendChild(newItem);
    });

    // Remove item (using event delegation)
    list.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const removeBtn = target.closest('.btn-remove-item');
        if (removeBtn) {
            removeBtn.parentElement?.remove();
        }
    });
}

function createDynamicInput(value: string, placeholder: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'dynamic-input-wrapper';
    wrapper.innerHTML = `
        <input type="text" class="dynamic-input" value="${value.replace(/"/g, '&quot;')}" placeholder="${placeholder}" required>
        <button type="button" class="btn-remove-item" aria-label="Удалить"><i class="fas fa-trash"></i></button>
    `;
    return wrapper;
}

function openRecipeModal(recipe?: Recipe) {
    const recipeModal = document.getElementById('recipe-form-modal');
    const recipeForm = document.getElementById('recipe-form');
    if (!recipeModal || !recipeForm) return;

    (recipeForm as HTMLFormElement).reset();
    (document.getElementById('recipe-id') as HTMLInputElement).value = '';

    const ingredientsList = document.getElementById('ingredients-list');
    const instructionsList = document.getElementById('instructions-list');
    if (!ingredientsList || !instructionsList) return;

    // Clear previous dynamic fields
    ingredientsList.innerHTML = '';
    instructionsList.innerHTML = '';

    if (recipe) {
        (document.getElementById('recipe-id') as HTMLInputElement).value = String(recipe.id);
        (document.getElementById('recipe-name') as HTMLInputElement).value = recipe.name;
        (document.getElementById('recipe-category') as HTMLSelectElement).value = recipe.category;
        (document.getElementById('recipe-description') as HTMLTextAreaElement).value = recipe.description;
        
        recipe.ingredients.forEach(ing => {
            ingredientsList.appendChild(createDynamicInput(ing, 'Напр., 100г муки'));
        });
        recipe.instructions.forEach(step => {
            instructionsList.appendChild(createDynamicInput(step, 'Напр., Смешать все ингредиенты'));
        });

    } else {
        // Add one empty field to start with for new recipes
        ingredientsList.appendChild(createDynamicInput('', 'Напр., 100г муки'));
        instructionsList.appendChild(createDynamicInput('', 'Напр., Смешать все ингредиенты'));
    }
    recipeModal.style.display = 'flex';
}

function closeRecipeModal() {
    const recipeModal = document.getElementById('recipe-form-modal');
    if (recipeModal) recipeModal.style.display = 'none';
}

function handleRecipeFormSubmit(e: Event) {
    e.preventDefault();
    const id = Number((document.getElementById('recipe-id') as HTMLInputElement).value);

    // Read values from dynamic inputs
    const ingredients = Array.from(document.querySelectorAll('#ingredients-list .dynamic-input'))
        .map(input => (input as HTMLInputElement).value.trim())
        .filter(Boolean);

    const instructions = Array.from(document.querySelectorAll('#instructions-list .dynamic-input'))
        .map(input => (input as HTMLInputElement).value.trim())
        .filter(Boolean);

    const recipeData: Recipe = {
        id: id || Date.now(),
        name: (document.getElementById('recipe-name') as HTMLInputElement).value,
        category: (document.getElementById('recipe-category') as HTMLSelectElement).value,
        description: (document.getElementById('recipe-description') as HTMLTextAreaElement).value,
        ingredients: ingredients,
        instructions: instructions,
    };

    if (!recipeData.name || ingredients.length === 0 || instructions.length === 0) {
        alert("Пожалуйста, заполните название, хотя бы один ингредиент и один шаг инструкции.");
        return;
    }

    if (id) {
        const index = RECIPES.findIndex(r => r.id === id);
        if (index > -1) RECIPES[index] = recipeData;
    } else {
        RECIPES.push(recipeData);
    }
    renderAdminRecipes();
    renderRecipeCards();
    renderRecipeFilters();
    closeRecipeModal();
}

function handleDeleteWorkout(workoutId: number) {
    if (confirm('Вы уверены, что хотите удалить эту тренировку?')) {
        const index = WORKOUTS.findIndex(w => w.id === workoutId);
        if (index > -1) {
            WORKOUTS.splice(index, 1);
            renderAdminWorkouts();
            renderWorkoutsPage();
        }
    }
}

function handleDeleteRecipe(recipeId: number) {
    if (confirm('Вы уверены, что хотите удалить этот рецепт?')) {
        const index = RECIPES.findIndex(r => r.id === recipeId);
        if (index > -1) {
            RECIPES.splice(index, 1);
            renderAdminRecipes();
            renderRecipeCards();
        }
    }
}

function handleAddCategory(e: Event) {
    e.preventDefault();
    const input = document.getElementById('new-category-name') as HTMLInputElement;
    const newCategory = input.value.trim();
    if (newCategory && !WORKOUT_CATEGORIES.includes(newCategory)) {
        WORKOUT_CATEGORIES.push(newCategory);
        renderAdminCategories();
        renderWorkoutFilters();
        input.value = '';
    } else {
        alert('Категория уже существует или название пустое.');
    }
}

function handleEditCategory(categoryName: string) {
    const newName = prompt(`Редактировать категорию "${categoryName}":`, categoryName);
    if (newName && newName.trim() !== '' && newName !== categoryName) {
        const index = WORKOUT_CATEGORIES.indexOf(categoryName);
        if (index > -1) {
            WORKOUT_CATEGORIES[index] = newName;
        }
        WORKOUTS.forEach(w => {
            if (w.category === categoryName) {
                w.category = newName;
            }
        });
        renderAdminCategories();
        renderAdminWorkouts();
        renderWorkoutFilters();
    }
}

function handleDeleteCategory(categoryName: string) {
    const isUsed = WORKOUTS.some(w => w.category === categoryName);
    if (isUsed) {
        alert(`Нельзя удалить категорию "${categoryName}", так как она используется в тренировках.`);
        return;
    }
    if (confirm(`Вы уверены, что хотите удалить категорию "${categoryName}"?`)) {
        WORKOUT_CATEGORIES = WORKOUT_CATEGORIES.filter(c => c !== categoryName);
        renderAdminCategories();
        renderWorkoutFilters();
    }
}

// --- RECIPE BOOK LOGIC ---
// FIX: Implemented the missing `openRecipeDetailModal` function.
// This function finds a recipe by ID and displays its full details in a modal.
function openRecipeDetailModal(recipeId: number) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    const modal = document.getElementById('recipe-detail-modal');
    const contentContainer = document.getElementById('recipe-detail-content');
    if (!modal || !contentContainer) return;

    contentContainer.innerHTML = `
        <h2>${recipe.name}</h2>
        <p class="recipe-category">${recipe.category}</p>
        <p class="recipe-description">${recipe.description}</p>
        <h4>Ингредиенты:</h4>
        <ul>${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}</ul>
        <h4>Инструкции:</h4>
        <ol>${recipe.instructions.map(step => `<li>${step}</li>`).join('')}</ol>
    `;

    modal.style.display = 'flex';
}

function renderRecipeCards() {
    const recipeViewContainer = document.getElementById('recipe-view');
    if (!recipeViewContainer) return;

    const recipesToRender = currentRecipeFilter
        ? RECIPES.filter(r => r.category === currentRecipeFilter)
        : RECIPES;

    if (recipesToRender.length === 0) {
        recipeViewContainer.innerHTML = `<p>Рецепты в этой категории не найдены.</p>`;
        return;
    }

    recipeViewContainer.innerHTML = recipesToRender.map(recipe => `
        <div class="recipe-card" data-recipe-id="${recipe.id}">
            <h3>${recipe.name}</h3>
            <p>${recipe.description}</p>
        </div>
    `).join('');

    // Add event listeners to new cards
    document.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', () => {
            const recipeId = Number(card.getAttribute('data-recipe-id'));
            openRecipeDetailModal(recipeId);
        });
    });
}

function renderRecipeFilters() {
    const filtersContainer = document.getElementById('recipe-filters');
    if (!filtersContainer) return;

    const categories = ['Все', ...Array.from(new Set(RECIPES.map(r => r.category)))];
    
    // Avoid re-rendering if categories haven't changed to preserve active state
    if(filtersContainer.children.length === categories.length) return;

    filtersContainer.innerHTML = categories.map(cat => 
        `<button class="chip ${cat === (currentRecipeFilter || 'Все') ? 'active' : ''}" data-category="${cat}">${cat}</button>`
    ).join('');

    filtersContainer.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            filtersContainer.querySelector('.chip.active')?.classList.remove('active');
            chip.classList.add('active');
            const category = chip.getAttribute('data-category');
            currentRecipeFilter = category === 'Все' ? null : category;
            renderRecipeCards();
        });
    });
    recipeFiltersInitialized = true;
}

// --- APP STARTUP LOGIC ---

// Function to load initial data from JSON files
async function loadInitialData() {
    try {
        const [workoutsResponse, recipesResponse] = await Promise.all([
            fetch('workouts.json'),
            fetch('cookbook.json')
        ]);
        if (!workoutsResponse.ok || !recipesResponse.ok) {
            throw new Error('Failed to fetch data files.');
        }
        const workoutsData = await workoutsResponse.json();
        const recipesData = await recipesResponse.json();

        // Clear existing data to prevent duplicates on hot-reload
        WORKOUTS.length = 0;
        RECIPES.length = 0;

        // Assign unique IDs. The app logic relies on them for CRUD and navigation.
        workoutsData.forEach((workout: any, index: number) => {
            workout.id = Date.now() + index;
            WORKOUTS.push(workout);
        });
        
        recipesData.forEach((recipe: any, index: number) => {
            recipe.id = Date.now() + 1000 + index; // Offset to avoid collisions with workout IDs
            RECIPES.push(recipe);
        });

    } catch (error) {
        console.error("Error loading initial data:", error);
        const homePage = document.getElementById('home-page');
        if (homePage) {
            homePage.innerHTML = `<p style="padding: 20px; text-align: center; color: #e74c3c;">Не удалось загрузить данные для тренировок и рецептов. Пожалуйста, обновите страницу.</p>`;
        }
    }
}

// Main function to start the application
async function startApp() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    setupAuthEventListeners();

    // Handle Firebase config error gracefully
    if (window.firebaseConfigError) {
        showView('login');
        const authContainer = document.querySelector('.auth-container');
        if (authContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'config-error';
            errorDiv.innerHTML = `
                <h4><i class="fas fa-exclamation-triangle"></i> Ошибка конфигурации Firebase</h4>
                <p>Не удалось инициализировать приложение. Пожалуйста, убедитесь, что вы добавили правильную конфигурацию Firebase в <code>index.html</code>.</p>
            `;
            authContainer.insertBefore(errorDiv, authContainer.firstChild);
        }
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        return;
    }

    // Load static data first for a stable startup.
    await loadInitialData();

    // Check for social login redirect result
    try {
        const result = await window.firebaseAuth.getRedirectResult();
        if (result && result.user) {
            handleSuccessfulLogin(result.user);
            return; // Exit as handleSuccessfulLogin will show the app
        }
    } catch (error: any) {
        // FIX: Gracefully handle environments where `getRedirectResult` is not supported (e.g., AI Studio preview).
        // This prevents an error from being shown on every app load in such environments.
        if (error.code === 'auth/operation-not-supported-in-this-environment') {
            console.warn('Firebase redirect operations not supported in this environment. Social login via redirect may not work.');
        } else {
            // Handle other, legitimate errors from getRedirectResult.
            console.error('Redirect result error:', error);
            let errorMessage = 'Произошла ошибка при входе. Попробуйте еще раз.';
            if (error.code === 'auth/account-exists-with-different-credential') {
                 errorMessage = `Аккаунт с этим email уже существует, но был создан другим способом (например, через email и пароль). Пожалуйста, войдите, используя первоначальный метод.`;
            }
            showAuthError(errorMessage, 'login');
        }
    }

    // Check auth state
    window.firebaseAuth.onAuthStateChanged((user: any) => {
        if (user) {
            // User is signed in.
            handleSuccessfulLogin(user);
        } else {
            // User is signed out.
            showView('login');
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    });
}

// Start the application when the DOM is ready.
document.addEventListener('DOMContentLoaded', startApp);
