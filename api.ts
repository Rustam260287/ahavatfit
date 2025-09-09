// api.ts - API Abstraction Layer for AhavatFit (Project Asas)

import * as state from './state';
import type { Workout, Recipe, Program } from './state';

// --- SIMULATION & CACHING ---

// Simulate network delay to make the app feel like it's communicating over a network.
const FAKE_DELAY = 400;

// In-memory caches to prevent re-fetching static JSON files.
let workoutsCache: Workout[] | null = null;
let recipesCache: Recipe[] | null = null;
let communityPostsCache: any[] | null = null;
let meditationsCache: any[] | null = null;
let programsCache: Program[] | null = null;

/**
 * A generic fetcher that simulates network delay and caches the result.
 * @param url The URL to fetch (local JSON file).
 * @param cache The cache variable to use.
 * @returns A promise that resolves with the fetched data.
 */
async function fetchData<T>(url: string, cache: T[] | null): Promise<T[]> {
    if (cache) {
        return Promise.resolve(cache);
    }
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, FAKE_DELAY));
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.statusText}`);
        throw new Error(`Failed to fetch ${url}`);
    }
    const data = await response.json();
    return data;
}

// --- PUBLIC API METHODS ---

/**
 * Fetches the list of all available workouts.
 */
export async function fetchWorkouts(): Promise<Workout[]> {
    if (workoutsCache) return workoutsCache;
    const data = await fetchData<Workout>('workouts.json', workoutsCache);
    // Ensure workouts have a unique ID
    workoutsCache = data.map((w, index) => ({ ...w, id: w.id ?? index }));
    return workoutsCache;
}

/**
 * Fetches the list of all available recipes.
 */
export async function fetchRecipes(): Promise<Recipe[]> {
    if (recipesCache) return recipesCache;
    const data = await fetchData<Recipe>('cookbook.json', recipesCache);
    // Ensure recipes have a unique ID
    recipesCache = data.map((r, index) => ({ ...r, id: index }));
    return recipesCache;
}

/**
 * Fetches the list of all available meditations.
 */
export async function fetchMeditations(): Promise<any[]> {
    if (meditationsCache) return meditationsCache;
    meditationsCache = await fetchData<any>('meditations.json', meditationsCache);
    return meditationsCache;
}

/**
 * Fetches the list of available workout programs.
 */
export async function fetchPrograms(): Promise<Program[]> {
    if (programsCache) return programsCache;
    const data = await fetchData<Program>('programs.json', programsCache);
    
    // In a real app, workout titles would come from a joined query, but here we can populate them.
    const allWorkouts = await fetchWorkouts();
    data.forEach(program => {
        program.schedule.forEach(week => {
            week.days.forEach(day => {
                const workout = allWorkouts.find(w => w.id === day.workoutId);
                day.title = workout ? workout.title : 'Неизвестная тренировка';
            });
        });
    });

    programsCache = data;
    return programsCache;
}


/**
 * Fetches the community posts feed.
 */
export async function fetchCommunityPosts(): Promise<any[]> {
    // We don't cache community posts to allow for simulated updates.
    const data = await fetchData<any>('community_posts.json', null);
    communityPostsCache = data;
    return communityPostsCache;
}

/**
 * Simulates posting a reaction to a community post.
 * In a real app, this would be a POST request to the backend.
 * @param postId The ID of the post.
 * @param reactionType The type of reaction ('dua', 'inspire', 'mashallah').
 * @returns A promise that resolves with a success status.
 */
export async function postCommunityReaction(postId: number, reactionType: string): Promise<{ success: boolean }> {
    // Simulate a quick network request for an action
    await new Promise(resolve => setTimeout(resolve, 150));
    console.log(`[API Simulation] Posted reaction '${reactionType}' to post ${postId}.`);
    // The actual data manipulation happens on the client side in this simulation.
    // A real backend would handle this and return the updated post.
    return { success: true };
}