// ai.ts - Gemini AI and Speech Logic for AhavatFit

// FIX: Add global interface to handle browser-specific Speech Recognition APIs and prevent TypeScript errors.
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

import { GoogleGenAI, Chat, Type, GenerateContentResponse } from "@google/genai";
import * as state from './state';
import { $, $$, showToast } from './ui';
import { initializeMarkdown, renderMarkdown } from './markdown';
import { DayPhaseInfo } from './cycle';

let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;
let goalChat: Chat | null = null;

/**
 * Initializes the GoogleGenAI clients for the main chat and the goal-setting chat.
 */
export function setupAICoaches() {
    try {
        if (!process.env.API_KEY) throw new Error("API_KEY environment variable not set.");
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: 'You are Amina, a friendly and knowledgeable AI fitness coach for Muslim women using the AhavatFit app. Your tone is supportive, gentle, and culturally sensitive. You provide advice on fitness, halal nutrition, and well-being, always aligning with Islamic values. Keep answers concise and motivating. Respond in Russian.' }
        });
        
        goalChat = ai.chats.create({
             model: 'gemini-2.5-flash',
             config: {
                systemInstruction: `You are Amina, an AI assistant helping a user set a SMART (Specific, Measurable, Achievable, Relevant, Time-bound) weekly fitness goal. Guide the user from a vague desire to a concrete goal of type 'workouts', 'minutes', or 'calories'. When you propose a final goal, your response MUST be ONLY a single JSON object with "text" (your proposal in Russian) and "goal" (an object with "type" and "target" keys). Example: {"text": "Отличная идея! Как насчет такой цели: выполнять 3 тренировки в неделю?", "goal": {"type": "workouts", "target": 3}}`,
                responseMimeType: "application/json",
             }
        });

        const savedHistory = localStorage.getItem(state.AI_CHAT_HISTORY_KEY);
        state.globalUIState.aiChatHistory = savedHistory ? JSON.parse(savedHistory) : [];
        initSpeechRecognition();
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI", e);
        const statusText = $('#ai-status-text');
        if (statusText) statusText.textContent = "Ошибка инициализации AI-тренера.";
        const submitBtn = $<HTMLButtonElement>('#ai-submit-btn');
        const promptInput = $<HTMLInputElement>('#ai-prompt-input');
        if(submitBtn) submitBtn.disabled = true;
        if(promptInput) promptInput.disabled = true;
    }
}

/**
 * Uses Gemini to analyze a meal description and return nutritional information.
 * @param mealDescription - The user's description of their meal.
 * @returns A promise that resolves to a nutritional analysis object.
 */
export async function getNutritionAnalysis(mealDescription: string): Promise<state.MealEntry['aiAnalysis']> {
    if (!ai) throw new Error("AI not initialized.");
    const prompt = `Analyze the following meal description from a user in Russia and return a JSON object with your nutritional analysis. The meal is: "${mealDescription}". Provide a concise, encouraging feedback sentence in Russian (1-2 sentences). Estimate calories, protein, carbs, and fat as numbers.`;
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            feedback: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fat: { type: Type.NUMBER }
        }
    };
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema }
    });
    return JSON.parse(response.text.trim());
}

/**
 * Phase VII: Uses Gemini to generate a personalized "Plan for Today", now with program and symptom context.
 * @param context - An object containing all relevant user data.
 * @returns A promise that resolves to a daily plan object.
 */
export async function generateTodaysPlanAI(context: {
    profile: any,
    phase: any,
    goal: any,
    todaysProgramWorkout: { title: string } | null,
    cycleSymptoms: string[]
}) {
    if (!ai) throw new Error("AI not initialized.");

    const { profile, phase, goal, todaysProgramWorkout, cycleSymptoms } = context;

    const prompt = `
        You are Amina, an AI fitness coach for Muslim women. Create a personalized, actionable 'plan for today' for the app's home screen.
        The plan must include three distinct components: a workout suggestion, a nutrition tip, and a mindful moment.
        All text must be in Russian, supportive, and concise.

        User's Context:
        - Profile: ${JSON.stringify(profile) || 'Not set'}
        - Weekly Goal: ${JSON.stringify(goal) || 'Not set'}
        - Menstrual Cycle: Day ${phase.dayOfCycle || 'N/A'} which is the ${phase.phase || 'Unknown'} phase.
        - Recent Symptoms Logged: ${cycleSymptoms.length > 0 ? cycleSymptoms.join(', ') : 'None'}
        - Today's Workout from Active Program: ${todaysProgramWorkout ? `"${todaysProgramWorkout.title}"` : 'None'}

        CRITICAL INSTRUCTIONS:
        1.  **Workout Suggestion:**
            - If "Today's Workout from Active Program" is provided, YOU MUST use that workout. The 'title' should be its title, and the 'reason' should state that it's part of their program (e.g., "Сегодня по плану...").
            - If the user has logged symptoms like 'cramps' or 'fatigue', you MUST add a gentle modification to the reason. For example: "...но я вижу, ты чувствуешь усталость. Попробуй выполнить ее с легкими весами или сократи количество подходов. Прислушайся к своему телу.".
            - If NO program workout is provided, recommend a workout type (e.g., 'Силовая тренировка', 'Легкое кардио') that is appropriate for their cycle phase and symptoms.

        2.  **Nutrition Tip & Mindful Moment:** Provide simple, actionable tips relevant to the user's overall context (cycle phase, symptoms, goals).

        Return ONLY a JSON object matching the schema.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            workoutSuggestion: {
                type: Type.OBJECT, properties: {
                    emoji: { type: Type.STRING },
                    title: { type: Type.STRING },
                    reason: { type: Type.STRING }
                }
            },
            nutritionTip: {
                type: Type.OBJECT, properties: {
                    emoji: { type: Type.STRING },
                    title: { type: Type.STRING },
                    reason: { type: Type.STRING }
                }
            },
            mindfulMoment: {
                type: Type.OBJECT, properties: {
                    emoji: { type: Type.STRING },
                    title: { type: Type.STRING },
                    reason: { type: Type.STRING }
                }
            }
        }
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema }
    });

    return JSON.parse(response.text.trim());
}


/**
 * Phase VI: Uses Gemini to generate insights and tips based on the current cycle phase.
 * @param phaseInfo - The user's current menstrual cycle phase information.
 * @returns A promise that resolves to an object with phase insights.
 */
export async function getCycleInsightsAI(phaseInfo: DayPhaseInfo) {
    if (!ai) throw new Error("AI not initialized.");

    const phaseNameMapping: { [key: string]: string } = {
        menstruation: "Менструация",
        follicular: "Фолликулярная фаза",
        ovulation: "Овуляция",
        luteal: "Лютеиновая фаза",
        unknown: "Неизвестно"
    };

    const prompt = `
        You are Amina, a supportive AI coach. The user is on day ${phaseInfo.dayOfCycle} of her cycle, which is the '${phaseInfo.phase}' phase.
        Provide concise, empowering, and scientifically-grounded insights for her. The response must be in Russian.
        Return ONLY a JSON object with the following structure:
        - title: The Russian name for the current phase.
        - description: A short, 1-2 sentence explanation of what's happening in her body.
        - workoutTip: A concrete, actionable tip for exercise during this phase.
        - nutritionTip: A concrete, actionable nutrition tip for this phase.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            workoutTip: { type: Type.STRING },
            nutritionTip: { type: Type.STRING },
        }
    };
    
    // Provide a default fallback in case AI fails
    const fallbackResponses: { [key in DayPhaseInfo['phase']]: any } = {
        menstruation: { title: "Менструация", description: "Время для отдыха и восстановления. Ваше тело усердно работает, поэтому будьте особенно нежны к себе.", workoutTip: "Выбирайте легкие нагрузки: прогулки, растяжку или нежную йогу.", nutritionTip: "Сосредоточьтесь на продуктах, богатых железом, таких как чечевица и шпинат." },
        follicular: { title: "Фолликулярная фаза", description: "Ваш уровень энергии начинает расти. Это отличное время для новых начинаний и активной деятельности.", workoutTip: "Можно постепенно увеличивать интенсивность тренировок, пробовать кардио и силовые.", nutritionTip: "Поддержите организм легкими белками и свежими овощами." },
        ovulation: { title: "Овуляция", description: "Пик вашей энергии! Вы можете чувствовать себя особенно сильной и выносливой.", workoutTip: "Это лучшее время для высокоинтенсивных тренировок (HIIT) и силовых рекордов.", nutritionTip: "Добавьте в рацион больше клетчатки и антиоксидантов из ягод и зелени." },
        luteal: { title: "Лютеиновая фаза", description: "Энергия может начать снижаться, возможны симптомы ПМС. Важно прислушиваться к своему телу.", workoutTip: "Переключитесь на более спокойные, но стабильные тренировки, например, пилатес или плавание.", nutritionTip: "Увеличьте потребление сложных углеводов и магния для поддержания настроения." },
        unknown: { title: "Отметьте свой цикл", description: "Начните отмечать дни менструации в календаре, чтобы получать персонализированные советы.", workoutTip: "Прислушивайтесь к своему телу – оно лучший советчик в выборе нагрузки.", nutritionTip: "Сбалансированное питание важно в любой день. Пейте достаточно воды." }
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema }
        });
        const parsedResponse = JSON.parse(response.text.trim());
        // Ensure the title matches our internal mapping for consistency
        parsedResponse.title = phaseNameMapping[phaseInfo.phase] || parsedResponse.title;
        return parsedResponse;
    } catch (error) {
        console.error("AI Cycle Insight Error:", error);
        return fallbackResponses[phaseInfo.phase] || fallbackResponses.unknown;
    }
}


/**
 * Uses Gemini to generate a personalized weekly workout plan.
 * @param profile - The user's profile data.
 * @param phase - The user's current menstrual cycle phase information.
 * @param availableWorkouts - The list of all available workouts.
 * @returns A promise that resolves to a weekly plan object.
 */
export async function generateWeeklyPlanAI(profile: any, phase: any, availableWorkouts: any[]) {
    if (!ai) throw new Error("AI not initialized.");
    const prompt = `
        You are Amina, a friendly and knowledgeable AI fitness coach for Muslim women. Your tone is supportive, gentle, and culturally sensitive.
        Based on the user's profile and the available workouts, create a personalized and balanced weekly workout plan. Select 3 to 4 workouts. For each selected workout, provide a short, encouraging reason (1-2 sentences in Russian) explaining why it's a good choice.
        User Profile: - Main Goal: ${profile.goal} - Fitness Level: ${profile.level} - Current Menstrual Cycle Phase: ${phase.phase || 'Unknown'}
        Available Workouts (JSON format): ${JSON.stringify(availableWorkouts.map(w => ({id: w.id, title: w.title, category: w.category})))}
        Return your response ONLY in the specified JSON format.`;
    const responseSchema = {
        type: Type.OBJECT, properties: {
            plan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { workoutId: { type: Type.INTEGER }, reason: { type: Type.STRING } } } }
        }
    };
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", contents: prompt,
        config: { responseMimeType: "application/json", responseSchema }
    });
    return JSON.parse(response.text.trim());
}

/**
 * Uses Gemini to generate conversation starter suggestions for the AI coach page.
 * @returns A promise that resolves to an object containing prompt suggestions.
 */
async function getAICoachSuggestions() {
    if (!ai) throw new Error("AI not initialized.");
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Generate 4 short, engaging, and supportive conversation starter prompts for a Muslim woman using a fitness app. The prompts should be in Russian. They will be displayed as clickable chips in the app to start a conversation with an AI fitness coach named Amina. The topics can cover motivation, gentle exercise, healthy eating (halal), and spiritual well-being.",
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT, properties: {
                    prompts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                        emoji: { type: Type.STRING, description: "A relevant emoji for the prompt." },
                        text: { type: Type.STRING, description: "The short prompt text in Russian." }
                    }}}
                }
            }
        }
    });
    return JSON.parse(response.text.trim());
}

/**
 * Renders the initial content of the AI Coach page, including chat history and suggestions.
 */
export async function renderAICoachPage(setState?: (newState: Partial<state.AppState>) => void) {
    // Lazily initialize the markdown renderer when the user first visits the coach.
    initializeMarkdown();

    const responseContainer = $('#ai-response'); if(!responseContainer) return;
    responseContainer.innerHTML = '';

    if (state.globalUIState.aiChatHistory.length === 0) {
        addMessage('Ассаляму алейкум, сестра! Меня зовут Амина, ваш личный AI-тренер. Я здесь, чтобы помочь вам на пути к здоровью и благополучию в соответствии с нашими ценностями. Чем я могу помочь сегодня?', 'ai');
    } else {
        state.globalUIState.aiChatHistory.forEach(msg => addMessage(msg.text, msg.sender));
        responseContainer.scrollTop = responseContainer.scrollHeight;
    }
    
    const suggestionChipsContainer = $('#ai-suggestion-chips'); if (!suggestionChipsContainer) return;
    suggestionChipsContainer.innerHTML = `<p class="loading-chips-text">Подбираем интересные темы...</p>`;
    try {
        if (!ai) throw new Error("AI not initialized, cannot generate suggestions.");
        const suggestions = await getAICoachSuggestions();
        if (suggestions.prompts && suggestions.prompts.length > 0) {
            suggestionChipsContainer.innerHTML = suggestions.prompts.map((p: { emoji: string; text: string }) => `<button class="chip" data-prompt="${p.text}">${p.emoji} ${p.text}</button>`).join('');
        } else { throw new Error("Received empty prompts from AI."); }
    } catch (error) {
        console.error("Failed to generate AI suggestion chips:", error);
        suggestionChipsContainer.innerHTML = `<button class="chip" data-prompt="Дай мне исламскую мотивацию для заботы о своем здоровье сегодня.">✨ Мотивация</button><button class="chip" data-prompt="Предложи мне простой и здоровый рецепт для халяль-ужина.">🍽️ Рецепт ужина</button><button class="chip" data-prompt="Составь для меня мягкую 15-минутную тренировку на сегодня.">🤸‍♀️ Мягкая тренировка</button><button class="chip" data-prompt="Какие упражнения безопасны во время менструации?">💧 Советы для цикла</button>`;
    }
    state.globalUIState.aiCoachPageInitialized = true;
}

function updateAIStatus(text: string, isProcessing: boolean) {
    const statusText = $('#ai-status-text'); if (statusText) statusText.textContent = text;
    state.globalUIState.isAIProcessing = isProcessing;
    const submitBtn = $<HTMLButtonElement>('#ai-submit-btn');
    const promptInput = $<HTMLInputElement>('#ai-prompt-input');
    const micBtn = $<HTMLButtonElement>('#ai-mic-btn');
    if(submitBtn) submitBtn.disabled = isProcessing;
    if(promptInput) promptInput.disabled = isProcessing;
    if(micBtn) micBtn.disabled = isProcessing;
    const icon = submitBtn?.querySelector('i');
    if (icon) {
        icon.className = isProcessing ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane';
    }
}

/**
 * Adds a message to the AI chat window.
 * @param text - The message content.
 * @param sender - 'user' or 'ai'.
 * @param isStreaming - Whether the message is being streamed.
 * @returns The created message element or null.
 */
export function addMessage(text: string, sender: 'user' | 'ai', isStreaming: boolean = false): HTMLElement | null {
    const responseContainer = $('#ai-response'); if (!responseContainer) return null;

    if (sender === 'user') {
        state.globalUIState.aiChatHistory.push({ sender, text });
        localStorage.setItem(state.AI_CHAT_HISTORY_KEY, JSON.stringify(state.globalUIState.aiChatHistory));
    }

    if (isStreaming) {
        let lastMessage = responseContainer.lastElementChild as HTMLElement;
        if (!lastMessage || !lastMessage.classList.contains('ai-message') || !lastMessage.dataset.streaming) {
            const newMessage = document.createElement('div');
            newMessage.className = 'message ai-message';
            newMessage.dataset.streaming = 'true';
            responseContainer.appendChild(newMessage);
            lastMessage = newMessage;
        }
        lastMessage.innerHTML = renderMarkdown(text);
    } else {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;
        messageElement.innerHTML = (sender === 'ai') ? renderMarkdown(text) : text;
        responseContainer.appendChild(messageElement);
    }
    responseContainer.scrollTop = responseContainer.scrollHeight;
    return responseContainer.lastElementChild as HTMLElement;
}

/**
 * Sends a prompt to the AI coach and streams the response.
 * @param prompt - The user's prompt.
 */
export async function askAI(prompt: string) {
    if (!chat) { addMessage("Извините, AI-тренер сейчас не в сети.", 'ai'); return; }
    updateAIStatus("Амина печатает...", true);
    try {
        const stream = await chat.sendMessageStream({ message: prompt });
        let fullResponse = "";
        let aiMessageElement: HTMLElement | null = null;
        for await (const chunk of stream) {
            fullResponse += chunk.text;
            if (!aiMessageElement) aiMessageElement = addMessage('', 'ai', true);
            if (aiMessageElement) {
                aiMessageElement.innerHTML = renderMarkdown(fullResponse);
                const responseContainer = $('#ai-response');
                if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
            }
        }
        if (aiMessageElement) delete aiMessageElement.dataset.streaming;
        state.globalUIState.aiChatHistory.push({ sender: 'ai', text: fullResponse });
        localStorage.setItem(state.AI_CHAT_HISTORY_KEY, JSON.stringify(state.globalUIState.aiChatHistory));
        if (localStorage.getItem('voice-response-enabled') === 'true' && state.globalUIState.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(fullResponse);
            const russianVoice = state.globalUIState.speechSynthesis.getVoices().find(v => v.lang === 'ru-RU');
            if(russianVoice) utterance.voice = russianVoice;
            utterance.onstart = () => { state.globalUIState.isSpeaking = true; if(aiMessageElement) aiMessageElement.classList.add('speaking'); };
            utterance.onend = () => { state.globalUIState.isSpeaking = false; if(aiMessageElement) aiMessageElement.classList.remove('speaking'); };
            state.globalUIState.speechSynthesis.speak(utterance);
        }
        updateAIStatus("", false);
    } catch (error) {
        console.error("AI Error:", error);
        addMessage("Произошла ошибка при обращении к AI. Пожалуйста, попробуйте еще раз.", 'ai');
        updateAIStatus("", false);
    }
}

/**
 * Initializes the Speech Recognition API.
 */
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Speech Recognition not supported.");
        const micBtn = $<HTMLButtonElement>('#ai-mic-btn'); if (micBtn) micBtn.disabled = true;
        return;
    }
    state.globalUIState.speechRecognition = new SpeechRecognition();
    state.globalUIState.speechSynthesis = window.speechSynthesis;
    state.globalUIState.speechRecognition.lang = 'ru-RU';
    state.globalUIState.speechRecognition.interimResults = false;
    state.globalUIState.speechRecognition.maxAlternatives = 1;
    const micBtn = $<HTMLButtonElement>('#ai-mic-btn');
    const input = $<HTMLInputElement>('#ai-prompt-input');
    const statusText = $('#ai-status-text');

    state.globalUIState.speechRecognition.onstart = () => { state.globalUIState.isListening = true; if (micBtn) micBtn.classList.add('listening'); if (statusText) statusText.textContent = 'Слушаю...'; };
    state.globalUIState.speechRecognition.onresult = (event: any) => { if (input) input.value = event.results[0][0].transcript; };
    // FIX: Removed the second argument from the showToast call, as the function only accepts one argument.
    state.globalUIState.speechRecognition.onerror = (event: any) => { console.error('Speech recognition error', event.error); showToast(`Ошибка распознавания: ${event.error}`); };
    state.globalUIState.speechRecognition.onend = () => { state.globalUIState.isListening = false; if (micBtn) micBtn.classList.remove('listening'); if (statusText && !state.globalUIState.isAIProcessing) statusText.textContent = ''; };
}

/**
 * Sends a prompt to the goal-setting AI.
 * @param prompt - The user's input.
 * @param renderGoalProgress - Callback to re-render goal progress widgets.
 */
export async function askGoalAI(prompt: string, renderGoalProgress: () => void) {
    if (!goalChat) {
        addGoalMessage("Извините, помощник по целям сейчас не в сети.", 'ai');
        return;
    }
    updateGoalChatStatus("Амина печатает...", true);
    try {
        const response: GenerateContentResponse = await goalChat.sendMessage({ message: prompt });
        const responseText = response.text.trim();
        const responseData = JSON.parse(responseText);
        
        addGoalMessage(responseData.text, 'ai');
        
        if (responseData.goal) {
            showGoalConfirmation(responseData.goal, renderGoalProgress);
        }
        updateGoalChatStatus("", false);
    } catch (error) {
        console.error("Goal AI Error:", error);
        addGoalMessage("Произошла ошибка. Попробуйте перефразировать свой ответ.", 'ai');
        updateGoalChatStatus("Что вы думаете?", false);
    }
}

/**
 * Adds a message to the goal-setting chat window.
 * @param text - The message content.
 * @param sender - 'user' or 'ai'.
 */
export function addGoalMessage(text: string, sender: 'user' | 'ai') {
    const container = $('#goal-chat-response');
    if (!container) return;
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    messageElement.innerHTML = renderMarkdown(text);
    container.appendChild(messageElement);
    const containerParent = container.parentElement;
    if (containerParent) {
        containerParent.scrollTop = containerParent.scrollHeight;
    }
}

function updateGoalChatStatus(text: string, isProcessing: boolean) {
    const statusText = $('#goal-chat-status-text');
    const input = $<HTMLInputElement>('#goal-chat-input');
    const submitBtn = $<HTMLButtonElement>('#goal-chat-submit-btn');
    state.globalUIState.isGoalChatProcessing = isProcessing;

    if (statusText) statusText.textContent = text;
    if (input) input.disabled = isProcessing;
    if (submitBtn) {
        submitBtn.disabled = isProcessing;
        const icon = submitBtn.querySelector('i');
        if (icon) icon.className = isProcessing ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane';
    }
}

function showGoalConfirmation(goal: {type: string, target: number}, renderGoalProgress: () => void) {
    const container = $('#goal-chat-response');
    if (!container) return;
    
    const confirmationEl = document.createElement('div');
    confirmationEl.className = 'goal-confirmation-actions';
    confirmationEl.innerHTML = `
        <p>Установить эту цель?</p>
        <button class="btn" id="confirm-goal-btn">Да, установить</button>
        <button class="btn btn-outline" id="reject-goal-btn">Нет, продолжить</button>
    `;
    container.appendChild(confirmationEl);
    const containerParent = container.parentElement;
    if(containerParent) containerParent.scrollTop = containerParent.scrollHeight;

    $('#confirm-goal-btn')?.addEventListener('click', () => {
        localStorage.setItem(state.USER_GOAL_KEY, JSON.stringify(goal));
        showToast('Отлично! Новая цель установлена.');
        const modal = $('#goal-form-modal');
        if(modal) modal.style.display = 'none';
        renderGoalProgress(); 
    }, { once: true });

    $('#reject-goal-btn')?.addEventListener('click', () => {
        confirmationEl.remove();
        addGoalMessage("Хорошо, давайте попробуем по-другому. Какую цель вы бы хотели поставить?", 'ai');
    }, { once: true });
}