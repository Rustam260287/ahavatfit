// serenity.ts - Serenity Page Logic for Audio Meditations

import * as state from './state';
import { $, handleAsyncOperation, formatTime } from './ui';
import * as api from './api'; // Phase IV: Import the new API layer

interface Meditation {
    id: number;
    title: string;
    description: string;
    duration: number; // in minutes
    icon: string;
    audioUrl: string;
}

let meditations: Meditation[] = [];

export async function renderSerenityPage(setState?: (newState: Partial<state.AppState>) => void) {
    const container = $('#serenity-page .page-content');
    if (!container) return;

    container.innerHTML = `
        <div id="meditation-player-container"></div>
        <div class="card">
            <div id="meditation-list">
                <div class="skeleton-item"></div>
                <div class="skeleton-item"></div>
            </div>
        </div>
    `;

    await loadMeditations();
    renderMeditationList();
    if(meditations.length > 0) {
        renderAudioPlayer(meditations[0]);
    }

    setupEventListeners();

    state.globalUIState.serenityPageInitialized = true;
}

async function loadMeditations() {
    if (meditations.length > 0) return;
    
    // Phase IV: Use the API layer to fetch data
    await handleAsyncOperation(async () => {
        const data = await api.fetchMeditations();
        meditations = data;
    });
}

function renderMeditationList() {
    const listContainer = $('#meditation-list');
    if (!listContainer) return;

    listContainer.innerHTML = meditations.map(m => `
        <div class="meditation-list-item" data-id="${m.id}">
            <div class="icon"><i class="${m.icon}"></i></div>
            <div class="info">
                <h4>${m.title}</h4>
                <p>${m.duration} мин - ${m.description}</p>
            </div>
        </div>
    `).join('');
    
    // Mark the first item as active
    const firstItem = listContainer.querySelector('.meditation-list-item');
    if(firstItem) firstItem.classList.add('active');
}

function renderAudioPlayer(meditation: Meditation) {
    const playerContainer = $('#meditation-player-container');
    if (!playerContainer) return;
    
    playerContainer.innerHTML = `
    <div class="card audio-player-card" id="audio-player" data-id="${meditation.id}">
        <h3>${meditation.title}</h3>
        <p class="duration">${meditation.description}</p>
        <audio src="${meditation.audioUrl}" preload="metadata"></audio>
        <div class="audio-player-progress-container">
            <div class="audio-player-progress"></div>
        </div>
        <div class="audio-player-time">
            <span class="current-time">00:00</span>
            <span class="total-time">00:00</span>
        </div>
        <div class="audio-player-controls">
            <button class="audio-play-btn"><i class="fas fa-play"></i></button>
        </div>
    </div>
    `;

    setupPlayerLogic();
}

function setupPlayerLogic() {
    const player = $<HTMLElement>('#audio-player');
    if (!player) return;

    const audio = player.querySelector<HTMLAudioElement>('audio');
    const playBtn = player.querySelector<HTMLButtonElement>('.audio-play-btn');
    const playIcon = playBtn?.querySelector('i');
    const progress = player.querySelector<HTMLElement>('.audio-player-progress');
    const progressContainer = player.querySelector<HTMLElement>('.audio-player-progress-container');
    const currentTimeEl = player.querySelector<HTMLElement>('.current-time');
    const totalTimeEl = player.querySelector<HTMLElement>('.total-time');

    if (!audio || !playBtn || !playIcon || !progress || !progressContainer || !currentTimeEl || !totalTimeEl) return;

    const togglePlay = () => audio.paused ? audio.play() : audio.pause();

    playBtn.addEventListener('click', togglePlay);
    
    audio.addEventListener('play', () => playIcon.className = 'fas fa-pause');
    audio.addEventListener('pause', () => playIcon.className = 'fas fa-play');
    audio.addEventListener('ended', () => playIcon.className = 'fas fa-play');
    
    audio.addEventListener('loadedmetadata', () => {
        totalTimeEl.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
        currentTimeEl.textContent = formatTime(audio.currentTime);
        progress.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    });

    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        audio.currentTime = (clickX / rect.width) * audio.duration;
    });
}


function setupEventListeners() {
    $('#serenity-page')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const listItem = target.closest<HTMLElement>('.meditation-list-item');

        if (listItem) {
            const currentActive = $('.meditation-list-item.active');
            if(currentActive) currentActive.classList.remove('active');
            listItem.classList.add('active');

            const meditationId = parseInt(listItem.dataset.id || '0', 10);
            const selectedMeditation = meditations.find(m => m.id === meditationId);
            if(selectedMeditation) {
                renderAudioPlayer(selectedMeditation);
            }
        }
    });
}