// community.ts - Community Page "Circle of Sisters" Logic

import * as state from './state';
import { $, handleAsyncOperation } from './ui';
import * as api from './api'; // Phase IV: Import the new API layer

interface CommunityPost {
    id: number;
    text: string;
    reactions: {
        dua: number;
        inspire: number;
        mashallah: number;
    };
}

let posts: CommunityPost[] = [];
let userReactions: Record<number, string> = {};
let activitySimulatorInterval: number | null = null;


export async function renderCommunityPage(setState?: (newState: Partial<state.AppState>) => void) {
    const container = $('#community-page .page-content');
    if (!container) return;

    // Stop any previous simulator when re-rendering the page
    if (activitySimulatorInterval) {
        clearInterval(activitySimulatorInterval);
    }

    container.innerHTML = `
        <div class="card">
            <p>Это безопасное и анонимное пространство для обмена вдохновением. Делитесь своими маленькими победами и поддерживайте сестёр на их пути.</p>
        </div>
        <div id="community-feed">
             <div class="skeleton-card" style="height: 120px; margin-bottom: 1rem;"></div>
             <div class="skeleton-card" style="height: 150px; margin-bottom: 1rem;"></div>
        </div>
    `;

    loadUserReactions();
    await loadPosts();
    renderFeed();
    setupEventListeners();
    startActivitySimulator(); // Phase IV: Make the community feel alive

    state.globalUIState.communityPageInitialized = true;
}

async function loadPosts() {
    // Phase IV: Use the API layer to fetch data
    await handleAsyncOperation(async () => {
        posts = await api.fetchCommunityPosts();
    });
}

function loadUserReactions() {
    const saved = localStorage.getItem(state.COMMUNITY_REACTIONS_KEY);
    userReactions = saved ? JSON.parse(saved) : {};
}

function saveUserReactions() {
    localStorage.setItem(state.COMMUNITY_REACTIONS_KEY, JSON.stringify(userReactions));
}

function renderFeed() {
    const feedContainer = $('#community-feed');
    if (!feedContainer) return;

    feedContainer.innerHTML = posts.map(post => `
        <div class="card post-card" data-id="${post.id}">
            <p class="post-author"><i class="fas fa-feather-alt"></i> Одна из сестёр поделилась:</p>
            <p class="post-text">${post.text}</p>
            <div class="post-reactions">
                ${renderReactionButton(post.id, 'dua', '🤲', post.reactions.dua)}
                ${renderReactionButton(post.id, 'inspire', '✨', post.reactions.inspire)}
                ${renderReactionButton(post.id, 'mashallah', '🌸', post.reactions.mashallah)}
            </div>
        </div>
    `).join('');
}

function renderReactionButton(postId: number, type: string, emoji: string, count: number): string {
    const hasReacted = userReactions[postId] === type;
    return `
        <button class="reaction-btn ${hasReacted ? 'reacted' : ''}" data-type="${type}">
            ${emoji} <span class="count">${count}</span>
        </button>
    `;
}

function updatePostReactions(postId: number) {
    const post = posts.find(p => p.id === postId);
    if(!post) return;

    const postCard = $(`#community-feed .post-card[data-id="${postId}"]`);
    const reactionsContainer = postCard?.querySelector('.post-reactions');
    if (reactionsContainer) {
        reactionsContainer.innerHTML = `
            ${renderReactionButton(postId, 'dua', '🤲', post.reactions.dua)}
            ${renderReactionButton(postId, 'inspire', '✨', post.reactions.inspire)}
            ${renderReactionButton(postId, 'mashallah', '🌸', post.reactions.mashallah)}
        `;
    }
}


async function handleReactionClick(postId: number, reactionType: string) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    
    // Disable buttons during the API call to prevent spam
    const postCard = $(`#community-feed .post-card[data-id="${postId}"]`);
    const buttons = postCard?.querySelectorAll('button');
    buttons?.forEach(b => b.disabled = true);
    
    // Phase IV: Call the API layer
    await api.postCommunityReaction(postId, reactionType);
    
    const currentReaction = userReactions[postId];

    // If clicking the same reaction again, un-react
    if (currentReaction === reactionType) {
        (post.reactions as any)[reactionType]--;
        delete userReactions[postId];
    } else {
        // If switching reaction, decrement the old one
        if (currentReaction) {
            (post.reactions as any)[currentReaction]--;
        }
        // Increment the new one
        (post.reactions as any)[reactionType]++;
        userReactions[postId] = reactionType;
    }

    saveUserReactions();
    
    // Re-render just the affected post's reaction buttons for efficiency
    updatePostReactions(postId);

    buttons?.forEach(b => b.disabled = false);
}

function setupEventListeners() {
    $('#community-feed')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const reactionBtn = target.closest<HTMLButtonElement>('.reaction-btn');
        if (reactionBtn) {
            const postCard = reactionBtn.closest<HTMLElement>('.post-card');
            const postId = parseInt(postCard?.dataset.id || '0', 10);
            const reactionType = reactionBtn.dataset.type;
            if (postId && reactionType) {
                handleReactionClick(postId, reactionType);
            }
        }
    });
}

/**
 * Phase IV: Simulates real-time activity from other users to make the feed feel alive.
 */
function startActivitySimulator() {
    activitySimulatorInterval = window.setInterval(() => {
        if (posts.length === 0) return;

        // Pick a random post and reaction
        const randomPostIndex = Math.floor(Math.random() * posts.length);
        const randomPost = posts[randomPostIndex];
        const reactions = ['dua', 'inspire', 'mashallah'];
        const randomReactionType = reactions[Math.floor(Math.random() * reactions.length)];
        
        // Increment the count
        (randomPost.reactions as any)[randomReactionType]++;

        // Update just that post in the UI
        updatePostReactions(randomPost.id);

    }, 3000); // Add a new reaction every 3 seconds
}