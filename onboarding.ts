// onboarding.ts - User Onboarding Logic for AhavatFit

import * as state from './state';
import { $, $$ } from './ui';

/**
 * Checks if onboarding is completed. If not, it shows the modal and returns a promise
 * that resolves when the user completes the onboarding process.
 * @returns A promise that resolves when onboarding is complete.
 */
export function checkAndShowOnboarding(): Promise<void> {
    return new Promise((resolve) => {
        const onboardingCompleted = localStorage.getItem(state.ONBOARDING_COMPLETED_KEY);
        if (!onboardingCompleted) {
            renderOnboardingModal(resolve); // Pass the resolve function to be called on completion
        } else {
            resolve(); // Onboarding is already done, resolve immediately.
        }
    });
}

function renderOnboardingModal(onFinishCallback: () => void) {
    const modal = $('#onboarding-modal');
    const step1 = $('#onboarding-step-1');
    
    if (modal && step1) {
        // Hide all steps except the first one
        $$('#onboarding-modal .onboarding-step').forEach(s => (s as HTMLElement).style.display = 'none');
        step1.style.display = 'block';
        modal.style.display = 'flex';
        
        setupOnboardingListeners(onFinishCallback);
    } else {
        // If modal doesn't exist for some reason, resolve immediately to not block the app.
        onFinishCallback();
    }
}

function setupOnboardingListeners(onFinishCallback: () => void) {
    const nextButton = $('#onboarding-step-1 .next-btn');
    const nameInput = $<HTMLInputElement>('#onboarding-name');
    
    if (nextButton && nameInput) {
        nextButton.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (name) {
                finishOnboarding(name, onFinishCallback);
            } else {
                alert('Пожалуйста, введите ваше имя.');
            }
        }, { once: true }); // Use { once: true } if this setup is called multiple times
    }
}

function finishOnboarding(name: string, onFinishCallback: () => void) {
    // For now, we only have the name. Goal and level can be added later.
    const profile: state.UserProfile = {
        name: name,
        goal: 'maintain_fitness', // Default value
        level: 'beginner'       // Default value
    };

    localStorage.setItem(state.USER_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(state.ONBOARDING_COMPLETED_KEY, 'true');

    const modal = $('#onboarding-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Resolve the promise to let the app continue.
    onFinishCallback();
}
