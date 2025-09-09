// markdown.ts - Markdown Renderer Initialization and Helpers

let md: any;

/**
 * Dynamically imports and initializes the markdown-it library.
 * To prevent startup crashes on iOS, modules are imported dynamically after the app starts.
 */
export async function initializeMarkdown() {
    if (md) return;
    try {
        const module = await import('https://esm.sh/markdown-it@14.1.0');
        const MarkdownIt = module.default;
        md = new MarkdownIt();
    } catch (error) {
        console.error("Failed to load Markdown renderer:", error);
        // `md` will remain undefined, and the app will fall back to plain text rendering.
    }
}

/**
 * Renders a string of markdown text to HTML. Falls back to plain text if the library failed to load.
 * @param text The markdown text to render.
 * @returns An HTML string.
 */
export function renderMarkdown(text: string): string {
    if (md) {
        return md.render(text);
    }
    // Fallback for when markdown-it fails to load, or for user messages
    // This basic version just wraps the text in <p> tags and replaces newlines with <br>.
    return `<p>${text.replace(/\n/g, '<br>')}</p>`;
}
