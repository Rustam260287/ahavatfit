// auth.ts - Firebase Authentication Logic

// FIX: Update Firebase imports to v8 namespaced API to resolve module export errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { $, showToast, getFirebaseAuthErrorMessage } from './ui';

/**
 * Generates the HTML string for the login form.
 * @returns HTML string.
 */
function getLoginHTML(): string {
    return `
    <div class="auth-wrapper">
        <div class="auth-card">
            <div class="auth-header">
                <i class="fas fa-heart"></i>
                <h1>AhavatFit</h1>
                <p>Войдите, чтобы продолжить</p>
            </div>
            <form id="login-form">
                <div class="form-group">
                    <label for="login-email">Email</label>
                    <input type="email" id="login-email" class="form-input" required autocomplete="email">
                </div>
                <div class="form-group">
                    <label for="login-password">Пароль</label>
                    <input type="password" id="login-password" class="form-input" required autocomplete="current-password">
                </div>
                <button type="submit" class="btn">Войти</button>
            </form>
            <div class="divider"><span>или</span></div>
            <button id="google-signin-btn" class="btn btn-outline">
                <i class="fab fa-google"></i> Войти с помощью Google
            </button>
            <p class="auth-switch">Нет аккаунта? <a href="#" id="show-signup">Зарегистрироваться</a></p>
        </div>
    </div>
    `;
}

/**
 * Generates the HTML string for the signup form.
 * @returns HTML string.
 */
function getSignupHTML(): string {
    return `
    <div class="auth-wrapper">
        <div class="auth-card">
            <div class="auth-header">
                <i class="fas fa-heart"></i>
                <h1>AhavatFit</h1>
                <p>Создайте свой аккаунт</p>
            </div>
            <form id="signup-form">
                 <div class="form-group">
                    <label for="signup-email">Email</label>
                    <input type="email" id="signup-email" class="form-input" required autocomplete="email">
                </div>
                <div class="form-group">
                    <label for="signup-password">Пароль</label>
                    <input type="password" id="signup-password" class="form-input" required minlength="6" autocomplete="new-password">
                </div>
                <button type="submit" class="btn">Зарегистрироваться</button>
            </form>
            <div class="divider"><span>или</span></div>
            <button id="google-signin-btn" class="btn btn-outline">
                <i class="fab fa-google"></i> Войти с помощью Google
            </button>
            <p class="auth-switch">Уже есть аккаунт? <a href="#" id="show-login">Войти</a></p>
        </div>
    </div>
    `;
}

/**
 * Renders the authentication UI (login or signup) into a container.
 * @param container - The HTMLElement to render the UI into.
 * @param view - The view to render, either 'login' or 'signup'.
 */
export function renderAuthPage(container: HTMLElement, view: 'login' | 'signup' = 'login') {
    container.innerHTML = view === 'login' ? getLoginHTML() : getSignupHTML();
    
    // Add listeners for switching between login and signup forms
    $('#show-signup')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderAuthPage(container, 'signup');
        setupAuthEventListeners(); // Re-attach listeners to the new form
    });
    $('#show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderAuthPage(container, 'login');
        setupAuthEventListeners(); // Re-attach listeners to the new form
    });
}


export function setupAuthEventListeners() {
    // Login Form Submission
    $('#login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent page reload
        const email = $<HTMLInputElement>('#login-email')?.value;
        const password = $<HTMLInputElement>('#login-password')?.value;
        if (!email || !password) {
            showToast('Пожалуйста, введите email и пароль.');
            return;
        }
        
        // FIX: Use v8 namespaced API for authentication.
        const auth = firebase.auth();
        try {
            await auth.signInWithEmailAndPassword(email, password);
            // onAuthStateChanged in index.tsx will handle the UI changes.
        } catch (error) {
            showToast(getFirebaseAuthErrorMessage(error));
        }
    });
    
    // Signup Form Submission
    $('#signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent page reload
        const email = $<HTMLInputElement>('#signup-email')?.value;
        const password = $<HTMLInputElement>('#signup-password')?.value;
        if (!email || !password) {
            showToast('Пожалуйста, введите email и пароль.');
            return;
        }

        // FIX: Use v8 namespaced API for authentication.
        const auth = firebase.auth();
        try {
            await auth.createUserWithEmailAndPassword(email, password);
             // onAuthStateChanged in index.tsx will handle the UI changes.
        } catch (error) {
            showToast(getFirebaseAuthErrorMessage(error));
        }
    });

    // Google Sign-In
    $('#google-signin-btn')?.addEventListener('click', async () => {
        // FIX: Use v8 namespaced API for Google Auth Provider and sign-in.
        const auth = firebase.auth();
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await auth.signInWithPopup(provider);
            // onAuthStateChanged will handle the rest.
        } catch (error)
        {
            showToast(getFirebaseAuthErrorMessage(error));
        }
    });
}

export async function logout() {
    try {
        // FIX: Use v8 namespaced API for sign out.
        const auth = firebase.auth();
        await auth.signOut();
        // onAuthStateChanged in index.tsx will show the login page.
        showToast('Вы вышли из системы.');
    } catch (error) {
        console.error("Logout Error:", error);
        showToast('Ошибка при выходе из системы.');
    }
}