// progress.ts - User Progress Calculation Logic

import * as state from './state';

export interface CompletedWorkout {
    workoutId: number;
    date: string; // YYYY-MM-DD
    duration: number;
    calories: number;
}

/**
 * Retrieves and parses completed workouts from localStorage.
 */
export function getCompletedWorkouts(): CompletedWorkout[] {
    const rawData = localStorage.getItem(state.COMPLETED_WORKOUTS_KEY);
    try {
        return rawData ? JSON.parse(rawData) : [];
    } catch (e) {
        console.error("Failed to parse completed workouts from localStorage:", e);
        localStorage.removeItem(state.COMPLETED_WORKOUTS_KEY); // Clear corrupted data
        return [];
    }
}

/**
 * Calculates the user's current workout streak based on consecutive days.
 */
export function calculateCurrentStreak(completedWorkouts: CompletedWorkout[]): number {
    if (completedWorkouts.length === 0) return 0;

    // Get unique, sorted dates in descending order
    const workoutDates = [...new Set(completedWorkouts.map(w => w.date))].sort((a, b) => b.localeCompare(a));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastWorkoutDate = new Date(workoutDates[0]);
    lastWorkoutDate.setHours(0, 0, 0, 0);

    const diff = (today.getTime() - lastWorkoutDate.getTime()) / (1000 * 3600 * 24);

    // If the last workout was more than a day ago, the streak is broken.
    if (diff > 1) {
        return 0;
    }
    
    let streak = 1;
    for (let i = 0; i < workoutDates.length - 1; i++) {
        const d1 = new Date(workoutDates[i]);
        const d2 = new Date(workoutDates[i+1]);
        d1.setHours(0,0,0,0);
        d2.setHours(0,0,0,0);

        const dayDiff = (d1.getTime() - d2.getTime()) / (1000 * 3600 * 24);
        
        if (dayDiff === 1) {
            streak++;
        } else {
            // A gap of more than one day was found.
            break;
        }
    }
    
    return streak;
}


/**
 * Calculates progress for the current week (assuming Monday is the first day).
 */
export function getWeekProgress(completedWorkouts: CompletedWorkout[]) {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // Adjust to get Monday of the current week
    const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    const monday = new Date(today.setDate(diffToMonday));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const workoutsThisWeek = completedWorkouts.filter(w => {
        const workoutDate = new Date(w.date);
        return workoutDate >= monday && workoutDate <= sunday;
    });

    const totalWorkouts = workoutsThisWeek.length;
    const totalMinutes = workoutsThisWeek.reduce((sum, w) => sum + w.duration, 0);
    const totalCalories = workoutsThisWeek.reduce((sum, w) => sum + w.calories, 0);
    const totalTimeFormatted = `${Math.floor(totalMinutes / 60)}ч ${totalMinutes % 60}м`;
    
    // Index mapping: 0=Mon, 1=Tue, ..., 6=Sun
    const dailyCounts = Array(7).fill(0); 
    workoutsThisWeek.forEach(w => {
        const workoutDate = new Date(w.date);
        let dayIndex = workoutDate.getDay() - 1; // getDay() is 0=Sun, so Mon becomes 0
        if (dayIndex === -1) dayIndex = 6; // Adjust Sunday to be index 6
        dailyCounts[dayIndex]++;
    });

    return {
        totalWorkouts,
        totalTime: totalMinutes,
        totalTimeFormatted,
        totalCalories,
        dailyCounts
    };
}


/**
 * Calculates the user's weekly goal completion percentage.
 */
export function getGoalProgress(weekProgress: ReturnType<typeof getWeekProgress>): number {
    const goalRaw = localStorage.getItem(state.USER_GOAL_KEY);
    if (!goalRaw) return 0;
    
    let goal;
    try {
        goal = JSON.parse(goalRaw);
    } catch (e) {
        console.error("Failed to parse user goal from localStorage", e);
        localStorage.removeItem(state.USER_GOAL_KEY); // Clear corrupted data
        return 0;
    }

    if (!goal.target || goal.target === 0) return 0;
    
    let currentProgressValue = 0;
    switch(goal.type) {
        case 'workouts':
            currentProgressValue = weekProgress.totalWorkouts;
            break;
        case 'minutes':
            currentProgressValue = weekProgress.totalTime;
            break;
        case 'calories':
            currentProgressValue = weekProgress.totalCalories;
            break;
    }
    
    const percentage = Math.min(100, Math.round((currentProgressValue / goal.target) * 100));
    return percentage;
}