// state.ts - Centralized State Management for AhavatFit

// --- TYPE DEFINITIONS ---

export interface UserProfile {
    name: string;
    goal: 'lose_weight' | 'gain_muscle' | 'maintain_fitness' | 'improve_endurance';
    level: 'beginner' | 'intermediate' | 'advanced';
}

export interface Workout {
    id: number;
    title: string;
    description: string;
    category: string;
    duration: number; // in minutes
    calories: number; // estimated
    videoUrl: string;
    alternativeVideoUrl?: string;
}

export interface Recipe {
    id: number;
    name: string;
    description: string;
    category: string;
    ingredients: string[];
    instructions: string[];
}

export interface MealEntry {
    date: string; // ISO string
    userText: string;
    aiAnalysis: {
        feedback: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
}

export interface CycleLogEntry {
    period?: 'start' | 'flow' | 'end';
    symptoms: string[];
    mood: string;
    notes?: string;
}

export interface Program {
    id: string;
    title: string;
    duration: number; // in weeks
    description: string;
    schedule: {
        week: number;
        days: {
            day: number;
            workoutId: number;
            title?: string; // Can be pre-filled
        }[];
    }[];
}

export interface ActiveProgramState {
    programId: string;
    startDate: string; // ISO date string YYYY-MM-DD
}


// --- APP STATE ---

export interface AppState {
    workouts: Workout[];
    recipes: Recipe[];
    programs: Program[];
}

export const appState: AppState = {
    workouts: [],
    recipes: [],
    programs: []
};

// --- UI STATE ---

export const globalUIState = {
    currentPage: 'home',
    homePageInitialized: false,
    workoutsInitialized: false,
    nutritionPageInitialized: false,
    serenityPageInitialized: false,
    communityPageInitialized: false,
    foodPageInitialized: false,
    cyclePageInitialized: false,
    programsPageInitialized: false,
    aiCoachPageInitialized: false,
    profilePageInitialized: false,
    adminPageInitialized: false,
    isAIProcessing: false,
    isGoalChatProcessing: false,
    isListening: false,
    isSpeaking: false,
    currentWorkout: null as Workout | null,
    aiChatHistory: [] as { sender: 'user' | 'ai', text: string }[],
    speechRecognition: null as any,
    speechSynthesis: null as any,
};

// --- LOCAL STORAGE KEYS ---

export const USER_PROFILE_KEY = 'ahavatfit_user_profile';
export const ONBOARDING_COMPLETED_KEY = 'ahavatfit_onboarding_completed';
export const CYCLE_LOG_DATA_KEY = 'ahavatfit_cycle_log';
export const CYCLE_SETTINGS_KEY = 'ahavatfit_cycle_settings';
export const PRAYER_SETTINGS_KEY = 'ahavatfit_prayer_settings';
export const NUTRITION_LOG_KEY = 'ahavatfit_nutrition_log';
export const VIEWED_RECIPES_KEY = 'ahavatfit_viewed_recipes';
export const COMPLETED_WORKOUTS_KEY = 'ahavatfit_completed_workouts';
export const USER_GOAL_KEY = 'ahavatfit_user_goal';
export const AI_CHAT_HISTORY_KEY = 'ahavatfit_ai_chat_history';
export const ACHIEVEMENTS_KEY = 'ahavatfit_achievements';
export const COMMUNITY_REACTIONS_KEY = 'ahavatfit_community_reactions';
export const ACTIVE_PROGRAM_KEY = 'ahavatfit_active_program';


// --- CONSTANTS ---

export const WORKOUT_CATEGORIES = ['Силовая', 'Кардио', 'Растяжка', 'Дыхание'];