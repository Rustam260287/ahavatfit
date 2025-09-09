// ui.ts - UI Helper Functions for AhavatFit

// --- CORE UTILITIES ---

export const $ = <T extends HTMLElement>(selector:string) => document.querySelector<T>(selector);
export const $$ = <T extends HTMLElement>(selector:string) => document.querySelectorAll<T>(selector);


// --- THEME MANAGEMENT ---

export function applyTheme(theme: 'light' | 'dark') {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
        themeColorMeta.setAttribute('content', theme === 'dark' ? '#1A2E2C' : '#D4A5A5');
    }
}

export function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    applyTheme(currentTheme as 'light' | 'dark');
    const darkModeToggle = $<HTMLInputElement>('#dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.checked = currentTheme === 'dark';
    }
}


// --- UI & NOTIFICATIONS ---

export function showLoadingOverlay() {
    const overlay = $('#loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}

export function hideLoadingOverlay() {
    const overlay = $('#loading-overlay');
    if(overlay) overlay.style.display = 'none';
}

export function showToast(message: string) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

export function showAchievementModal(achievement: { title: string; description: string; }) {
    const modal = $('#achievement-modal');
    const content = $('#achievement-modal-content');
    if(!modal || !content) return;

    content.innerHTML = `
        <div class="achievement-icon-wrapper">
            <i class="fas fa-trophy"></i>
        </div>
        <h2>${achievement.title}</h2>
        <p>${achievement.description}</p>
        <button class="btn close-btn">Продолжить</button>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

export function showShareSuccessModal(workoutTitle: string) {
    const modal = $('#share-success-modal');
    const content = $('#share-success-content');
    if (!modal || !content) return;

    const modalTitle = content.querySelector('h3');
    if (modalTitle) modalTitle.textContent = `Поздравляем с завершением "${workoutTitle}"!`;

    const textarea = $<HTMLTextAreaElement>('#share-success-textarea');
    if (textarea) textarea.value = '';

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

export function closeModal() {
    const modal = $('.modal.show');
    if(modal) {
        modal.classList.remove('show');
        setTimeout(() => { (modal as HTMLElement).style.display = 'none'; }, 300);
    }
}


export async function sendNotification(title: string, body: string) {
    if (!('Notification' in window)) {
        alert(`${title}: ${body}`);
        return;
    }
    if (Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: '/images/icon-192x192.png' });
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            sendNotification(title, body);
        }
    }
}

/**
 * A wrapper for handling async operations gracefully.
 * Shows a generic toast on error and can update a specific UI container.
 * @param asyncFn The async function to execute.
 * @param options Optional configuration for error handling.
 * @returns A promise that resolves with the result of the async function or null on error.
 */
export async function handleAsyncOperation<T>(
    asyncFn: () => Promise<T>,
    options: {
        container?: HTMLElement | null;
        errorMessage?: string;
        genericToastMessage?: string;
    } = {}
): Promise<T | null> {
    const {
        container,
        errorMessage = '<p>Не удалось загрузить данные. Проверьте подключение к сети и попробуйте еще раз.</p>',
        genericToastMessage = 'Произошла ошибка. Пожалуйста, попробуйте позже.'
    } = options;

    try {
        const result = await asyncFn();
        return result;
    } catch (error) {
        console.error("Async Operation Failed:", error);
        showToast(genericToastMessage);
        if (container) {
            container.innerHTML = errorMessage;
        }
        return null;
    }
}

// --- AUTH UTILITIES ---

export function getFirebaseAuthErrorMessage(error: any): string {
    switch (error.code) {
        case 'auth/user-not-found': return 'Пользователь с таким email не найден.';
        case 'auth/wrong-password': return 'Неверный пароль.';
        case 'auth/invalid-login-credentials': return 'Неверный email или пароль.';
        case 'auth/invalid-email': return 'Некорректный формат email адреса.';
        case 'auth/email-already-in-use': return 'Этот email уже зарегистрирован.';
        case 'auth/weak-password': return 'Пароль слишком слабый. Он должен содержать не менее 6 символов.';
        case 'auth/popup-closed-by-user': return 'Окно входа было закрыто. Попробуйте еще раз.';
        default: console.error("Firebase Auth Error:", error); return 'Произошла ошибка. Пожалуйста, попробуйте позже.';
    }
}

// --- VIDEO PLAYER UTILITIES ---
export function formatTime(timeInSeconds: number): string {
    if (isNaN(timeInSeconds)) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

/**
 * Efficiently renders a list of items into a container using a keying strategy
 * to minimize DOM manipulations. It handles additions, removals, and reordering.
 * @param container The parent HTMLElement to render into.
 * @param items The array of data items.
 * @param keyFn A function that returns a unique key for an item from a data object.
 * @param renderFn A function that returns the HTML string for a single item.
 * @param emptyHtml The HTML string to display when the items array is empty.
 */
export function renderList<T>(
    container: HTMLElement,
    items: T[],
    keyFn: (item: T) => string | number,
    renderFn: (item: T) => string,
    emptyHtml: string = '<p>Нет элементов для отображения.</p>'
) {
    if (items.length === 0) {
        container.innerHTML = emptyHtml;
        return;
    }
    
    // Map of existing DOM nodes by their key.
    const existingNodes = new Map<string, HTMLElement>();
    for (const child of Array.from(container.children)) {
        const node = child as HTMLElement;
        const key = node.dataset.id; // Assuming the key is stored in data-id
        if (key) {
            existingNodes.set(key, node);
        }
    }

    const newNodes: HTMLElement[] = [];
    const usedKeys = new Set<string>();

    // Step 1: Create new nodes and identify nodes to keep.
    items.forEach(item => {
        const key = String(keyFn(item));
        usedKeys.add(key);
        const existingNode = existingNodes.get(key);

        if (existingNode) {
            // Node already exists, we will reuse it.
            newNodes.push(existingNode);
        } else {
            // Node doesn't exist, create it.
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderFn(item).trim();
            const newNode = tempDiv.firstChild as HTMLElement;
            if (newNode) {
                newNodes.push(newNode);
            }
        }
    });

    // Step 2: Remove nodes that are no longer needed.
    for (const [key, node] of existingNodes.entries()) {
        if (!usedKeys.has(key)) {
            node.remove();
        }
    }

    // Step 3: Re-order and insert nodes efficiently.
    let lastNode: Element | null = null;
    newNodes.forEach((newNode) => {
        const expectedNode = lastNode ? lastNode.nextElementSibling : container.firstElementChild;

        // If the newNode is not in the correct position, move it.
        // If they are the same, it's already in the right spot.
        if (expectedNode !== newNode) {
            if (lastNode) {
                lastNode.after(newNode);
            } else {
                container.prepend(newNode);
            }
        }
        lastNode = newNode;
    });
}