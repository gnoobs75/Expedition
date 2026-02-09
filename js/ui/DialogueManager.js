// =============================================
// Dialogue Manager
// NPC dialogue system with branching conversations
// =============================================

export class DialogueManager {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.currentDialogue = null;
        this.overlay = null;

        this.createOverlay();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'dialogue-overlay';
        this.overlay.className = 'hidden';
        this.overlay.innerHTML = `
            <div class="dialogue-box">
                <div class="dialogue-portrait-area">
                    <div class="dialogue-portrait"></div>
                    <div class="dialogue-speaker-name"></div>
                    <div class="dialogue-speaker-title"></div>
                </div>
                <div class="dialogue-content-area">
                    <div class="dialogue-text"></div>
                    <div class="dialogue-options"></div>
                </div>
            </div>
        `;
        document.getElementById('ui-overlay').appendChild(this.overlay);

        // Close on clicking outside
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    }

    /**
     * Open a dialogue with an NPC
     */
    open(npcConfig) {
        this.isOpen = true;
        this.currentDialogue = npcConfig;
        this.overlay.classList.remove('hidden');

        const portrait = this.overlay.querySelector('.dialogue-portrait');
        const name = this.overlay.querySelector('.dialogue-speaker-name');
        const title = this.overlay.querySelector('.dialogue-speaker-title');

        portrait.textContent = npcConfig.portrait || '?';
        portrait.style.color = npcConfig.color || '#00ffff';
        name.textContent = npcConfig.name;
        title.textContent = npcConfig.title || '';

        this.showText(npcConfig.text, npcConfig.options || []);

        this.game.audio?.play('dialogue-open');
    }

    /**
     * Show dialogue text and options
     */
    showText(text, options = []) {
        const textEl = this.overlay.querySelector('.dialogue-text');
        const optionsEl = this.overlay.querySelector('.dialogue-options');

        // Clear previous typewriter interval
        if (this._typeInterval) clearInterval(this._typeInterval);

        // Typewriter effect
        textEl.textContent = '';
        let charIndex = 0;
        const typeInterval = setInterval(() => {
            if (charIndex < text.length) {
                textEl.textContent += text[charIndex];
                charIndex++;
            } else {
                clearInterval(typeInterval);
                this._typeInterval = null;
            }
        }, 20);
        this._typeInterval = typeInterval;

        // Build options
        if (options.length === 0) {
            options = [{ label: 'Close', action: 'close' }];
        }

        optionsEl.innerHTML = options.map((opt, i) => `
            <div class="dialogue-option" data-index="${i}" data-action="${opt.action || ''}">
                <span class="dialogue-option-marker">&gt;</span>
                ${opt.label}
            </div>
        `).join('');

        optionsEl.querySelectorAll('.dialogue-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const action = opt.dataset.action;
                const index = parseInt(opt.dataset.index);
                this.game.audio?.play('click');

                if (action === 'close') {
                    this.close();
                } else if (action === 'accept-quest') {
                    const questId = options[index].questId;
                    if (questId) {
                        this.game.guildSystem.acceptQuest(questId);
                    }
                    this.close();
                } else if (action === 'accept-commerce-quest') {
                    const questId = options[index].questId;
                    if (questId) {
                        this.game.commerceSystem?.acceptQuest(questId);
                    }
                    this.close();
                } else if (action === 'abandon-quest') {
                    const questId = options[index].questId;
                    if (questId) {
                        this.game.guildSystem.abandonQuest(questId);
                    }
                    this.close();
                } else if (action === 'next') {
                    const nextDialogue = options[index].next;
                    if (nextDialogue) {
                        this.showText(nextDialogue.text, nextDialogue.options || []);
                    }
                } else {
                    this.close();
                }
            });
        });
    }

    /**
     * Close dialogue
     */
    close() {
        this.isOpen = false;
        this.currentDialogue = null;
        if (this._typeInterval) {
            clearInterval(this._typeInterval);
            this._typeInterval = null;
        }
        this.overlay.classList.add('hidden');
        this.game.audio?.play('dialogue-close');
    }
}
