// workouts.ts - Workouts Page Logic and Video Player for AhavatFit

import * as state from './state';
import { $, $$, formatTime, renderList, handleAsyncOperation } from './ui';
import * as api from './api'; // Phase IV: Import the new API layer

/**
 * Renders the main workouts page, fetching data if necessary.
 * @param setState - Callback to update global app state.
 */
export async function renderWorkoutsPage(setState: (newState: Partial<state.AppState>) => void) {
    const playlistContainer = $('#workouts-playlist');
    if (!playlistContainer) return;
    playlistContainer.innerHTML = `<div class="skeleton-playlist"><div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div></div>`;

    // Phase IV: Use the API layer to fetch data
    const loadWorkouts = async () => {
        if (state.appState.workouts.length === 0) {
            const fetchedWorkouts = await api.fetchWorkouts();
            setState({ workouts: fetchedWorkouts });
        }
    };
    
    const result = await handleAsyncOperation(loadWorkouts, {
        container: playlistContainer,
        errorMessage: '<p>Не удалось загрузить тренировки. Попробуйте позже.</p>'
    });

    // If result is null, it means the operation failed and the error is already handled.
    if (result === null) return;

    // --- If successful, render the content ---
    const filtersContainer = $('#workout-filters');
    if (filtersContainer) {
        filtersContainer.innerHTML = `<button class="chip active" data-category="all">Все</button>` + state.WORKOUT_CATEGORIES.map(cat => `<button class="chip" data-category="${cat}">${cat}</button>`).join('');
    }
    renderWorkoutList(state.appState.workouts, playlistContainer);
    if (state.appState.workouts.length > 0) {
        renderVideoPlayer(state.appState.workouts[0]);
        const firstItem = playlistContainer.querySelector('.playlist-item');
        if (firstItem) firstItem.classList.add('active');
    }
    state.globalUIState.workoutsInitialized = true;
}

/**
 * Renders a list of workouts into a container using an efficient diffing strategy.
 * @param workoutList - The array of workouts to render.
 * @param container - The HTML element to render into.
 */
export function renderWorkoutList(workoutList: state.Workout[], container: HTMLElement) {
    const renderFn = (w: state.Workout) => `
        <div class="playlist-item" data-id="${w.id}">
            <div class="playlist-thumb"><i class="fas fa-play"></i></div>
            <div class="playlist-info"><h4>${w.title}</h4><p>${w.category} - ${w.duration} мин</p></div>
            <i class="fas fa-chevron-right playlist-play-icon"></i>
        </div>`;
    const emptyHtml = '<p>Тренировки в этой категории не найдены.</p>';
    
    renderList(container, workoutList, w => w.id, renderFn, emptyHtml);
}


/**
 * Renders the video player and details for a selected workout.
 * @param workout - The workout object to display.
 */
export function renderVideoPlayer(workout: state.Workout) {
    state.globalUIState.currentWorkout = workout;
    const playerContainer = $('.video-player-container'); if (!playerContainer) return;
    playerContainer.innerHTML = '';
    const videoUrl = workout.videoUrl || workout.alternativeVideoUrl;
    if (videoUrl && videoUrl.endsWith('.mp4')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-player-wrapper';
        wrapper.innerHTML = `
            <video class="custom-video-player" src="${videoUrl}" preload="metadata"></video>
            <div class="video-controls hidden">
                <button class="control-btn play-pause-btn" aria-label="Play/Pause"><i class="fas fa-play"></i></button>
                <div class="progress-bar-container"><div class="progress-bar-seek"></div></div>
                <div class="time-display">00:00 / 00:00</div>
                <div class="volume-container">
                    <button class="control-btn volume-btn" aria-label="Mute/Unmute"><i class="fas fa-volume-up"></i></button>
                    <input type="range" class="volume-slider" min="0" max="1" step="0.01" value="1">
                </div>
                <button class="control-btn fullscreen-btn" aria-label="Fullscreen"><i class="fas fa-expand"></i></button>
            </div>`;
        playerContainer.appendChild(wrapper);
        setupCustomVideoPlayer(wrapper);
    } else if (videoUrl && videoUrl.includes('youtube.com')) {
        const videoId = new URL(videoUrl).searchParams.get('v');
        playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        playerContainer.innerHTML = `<div class="video-placeholder"><i class="fas fa-video-slash"></i><p>Формат видео не поддерживается</p></div>`;
    }
    const videoTitleEl = $('#video-title'); if(videoTitleEl) videoTitleEl.textContent = workout.title;
    const videoDescEl = $('#video-description'); if(videoDescEl) videoDescEl.textContent = workout.description;
    const videoDurEl = $('#video-duration'); if(videoDurEl) videoDurEl.innerHTML = `<i class="far fa-clock"></i> ${workout.duration} мин`;
    const videoCalEl = $('#video-calories'); if(videoCalEl) videoCalEl.innerHTML = `<i class="far fa-fire"></i> ${workout.calories} ккал`;
    
    // Reset the complete button so the new workout can be logged
    const completeBtn = $<HTMLButtonElement>('.complete-workout-btn');
    if (completeBtn) {
        completeBtn.disabled = false;
        completeBtn.innerHTML = `<i class="far fa-check-circle"></i> Завершить тренировку`;
    }
}

function setupCustomVideoPlayer(wrapper: HTMLElement) {
    const video = wrapper.querySelector<HTMLVideoElement>('.custom-video-player');
    const controls = wrapper.querySelector<HTMLElement>('.video-controls');
    const playPauseBtn = wrapper.querySelector<HTMLButtonElement>('.play-pause-btn');
    const playPauseIcon = playPauseBtn?.querySelector('i');
    const progressBar = wrapper.querySelector<HTMLElement>('.progress-bar-seek');
    const progressBarContainer = wrapper.querySelector<HTMLElement>('.progress-bar-container');
    const timeDisplay = wrapper.querySelector<HTMLElement>('.time-display');
    const volumeBtn = wrapper.querySelector<HTMLButtonElement>('.volume-btn');
    const volumeIcon = volumeBtn?.querySelector('i');
    const volumeSlider = wrapper.querySelector<HTMLInputElement>('.volume-slider');
    const fullscreenBtn = wrapper.querySelector<HTMLButtonElement>('.fullscreen-btn');
    const fullscreenIcon = fullscreenBtn?.querySelector('i');
    if (!video || !controls || !playPauseBtn || !playPauseIcon || !progressBar || !progressBarContainer || !timeDisplay || !volumeBtn || !volumeIcon || !volumeSlider || !fullscreenBtn || !fullscreenIcon) return;

    let controlsTimeout: number;
    const showControls = () => { if(controls) controls.classList.remove('hidden'); };
    const hideControls = () => { if (!video.paused && controls) controls.classList.add('hidden'); };
    const scheduleHideControls = () => { clearTimeout(controlsTimeout); controlsTimeout = window.setTimeout(hideControls, 3000); };
    const togglePlay = () => { video.paused ? video.play() : video.pause(); };

    video.addEventListener('play', () => { playPauseIcon?.classList.replace('fa-play', 'fa-pause'); scheduleHideControls(); });
    video.addEventListener('pause', () => { playPauseIcon?.classList.replace('fa-pause', 'fa-play'); showControls(); clearTimeout(controlsTimeout); });
    video.addEventListener('ended', () => { playPauseIcon?.classList.replace('fa-pause', 'fa-play'); });
    playPauseBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);
    video.addEventListener('loadedmetadata', () => { timeDisplay.textContent = `${formatTime(0)} / ${formatTime(video.duration)}`; });
    video.addEventListener('timeupdate', () => {
        progressBar.style.width = `${(video.currentTime / video.duration) * 100}%`;
        timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    });
    progressBarContainer.addEventListener('click', (e: MouseEvent) => {
        const rect = progressBarContainer.getBoundingClientRect();
        video.currentTime = ((e.clientX - rect.left) / rect.width) * video.duration;
    });
    const updateVolumeIcon = () => {
        volumeIcon.className = 'fas';
        if (video.muted || video.volume === 0) volumeIcon.classList.add('fa-volume-mute');
        else if (video.volume < 0.5) volumeIcon.classList.add('fa-volume-down');
        else volumeIcon.classList.add('fa-volume-up');
    };
    volumeBtn.addEventListener('click', () => { video.muted = !video.muted; });
    volumeSlider.addEventListener('input', () => { video.volume = parseFloat(volumeSlider.value); video.muted = video.volume === 0; });
    video.addEventListener('volumechange', () => { volumeSlider.value = video.muted ? '0' : String(video.volume); updateVolumeIcon(); });
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) wrapper.requestFullscreen().catch(err => alert(`Fullscreen error: ${err.message}`));
        else document.exitFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
        const isFullscreen = document.fullscreenElement === wrapper;
        fullscreenIcon.classList.toggle('fa-expand', !isFullscreen);
        fullscreenIcon.classList.toggle('fa-compress', isFullscreen);
    });

    wrapper.addEventListener('mouseenter', () => { showControls(); clearTimeout(controlsTimeout); });
    wrapper.addEventListener('mouseleave', hideControls);
    wrapper.addEventListener('mousemove', () => { showControls(); if(!video.paused) scheduleHideControls(); });
    showControls();
    if (!video.paused) scheduleHideControls();
}