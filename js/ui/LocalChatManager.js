// ==================================
// Local Chat Manager
// Chat panel with channels, NPC callouts, and floating chat bubbles
// ==================================

export class LocalChatManager {
    constructor(game) {
        this.game = game;
        this.messages = []; // {channel, sender, text, color, timestamp}
        this.maxMessages = 200;
        this.bubbles = []; // {entityId, text, color, expiresAt, element}
        this.activeChannel = 'local'; // local, combat, trade, faction
        this.panel = null;
        this.bubbleContainer = null;
        this.visible = false;
    }

    init() {
        // Create bubble container (screen-space overlay for chat bubbles)
        this.bubbleContainer = document.createElement('div');
        this.bubbleContainer.id = 'chat-bubbles';
        this.bubbleContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';
        document.body.appendChild(this.bubbleContainer);

        // Find or create chat panel
        this.panel = document.getElementById('local-chat-panel');

        // Subscribe to NPC chat events
        this.game.events?.on('npc:chat', (data) => this.onNPCChat(data));
    }

    toggle() {
        this.visible = !this.visible;
        if (this.panel) {
            this.panel.style.display = this.visible ? 'flex' : 'none';
            if (this.visible) this.renderMessages();
        }
    }

    show() { this.visible = true; if (this.panel) { this.panel.style.display = 'flex'; this.renderMessages(); } }
    hide() { this.visible = false; if (this.panel) this.panel.style.display = 'none'; }

    addMessage(channel, sender, text, color = '#aaaaaa') {
        const msg = {
            channel,
            sender,
            text,
            color,
            timestamp: Date.now()
        };
        this.messages.push(msg);
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }
        if (this.visible) this.renderMessages();
    }

    onNPCChat(data) {
        // data: { entity, text, channel, color, bubble }
        if (!data || !data.text) return;
        const channel = data.channel || 'local';
        const sender = data.entity?.name || 'Unknown';
        const color = data.color || '#aaaaaa';
        this.addMessage(channel, sender, data.text, color);

        // Show bubble over entity if requested
        if (data.bubble !== false && data.entity) {
            this.showBubble(data.entity, data.text, color);
        }
    }

    showBubble(entity, text, color = '#aaaaaa') {
        // Remove existing bubble for this entity
        this.bubbles = this.bubbles.filter(b => {
            if (b.entityId === entity.id) {
                b.element?.remove();
                return false;
            }
            return true;
        });

        const el = document.createElement('div');
        el.className = 'chat-bubble';
        el.style.cssText = `border-color: ${color};`;
        // Truncate long messages
        el.textContent = text.length > 60 ? text.substring(0, 57) + '...' : text;
        this.bubbleContainer.appendChild(el);

        this.bubbles.push({
            entityId: entity.id,
            entity,
            text,
            color,
            expiresAt: Date.now() + 4000,
            element: el,
        });
    }

    updateBubblePositions() {
        const now = Date.now();
        const renderer = this.game.renderer;
        if (!renderer) return;

        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];

            // Remove expired bubbles
            if (now > b.expiresAt) {
                b.element?.remove();
                this.bubbles.splice(i, 1);
                continue;
            }

            // Fade out in last second
            const remaining = b.expiresAt - now;
            if (remaining < 1000) {
                b.element.style.opacity = remaining / 1000;
            }

            // Position bubble above entity (screen-space projection)
            const entity = b.entity;
            if (!entity || !renderer.camera) continue;

            // Convert world to screen coords
            const screenPos = renderer.worldToScreen(entity.x, entity.y);
            if (screenPos) {
                b.element.style.left = `${screenPos.x}px`;
                b.element.style.top = `${screenPos.y - 60}px`;
                b.element.style.display = 'block';
            } else {
                b.element.style.display = 'none';
            }
        }
    }

    renderMessages() {
        if (!this.panel) return;

        const msgContainer = this.panel.querySelector('.chat-messages');
        if (!msgContainer) {
            this.panel.innerHTML = `
                <div class="chat-header">
                    <span class="chat-title">LOCAL COMMS</span>
                    <div class="chat-channels">
                        ${['local', 'combat', 'trade', 'faction'].map(ch =>
                            `<button class="chat-channel-btn ${this.activeChannel === ch ? 'active' : ''}" data-channel="${ch}">${ch.toUpperCase()}</button>`
                        ).join('')}
                    </div>
                    <button class="chat-close-btn" title="Close">X</button>
                </div>
                <div class="chat-messages"></div>
            `;

            // Wire channel buttons
            this.panel.querySelectorAll('.chat-channel-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.activeChannel = btn.dataset.channel;
                    this.renderMessages();
                });
            });
            this.panel.querySelector('.chat-close-btn')?.addEventListener('click', () => this.hide());
        }

        const container = this.panel.querySelector('.chat-messages');
        if (!container) return;

        const filtered = this.activeChannel === 'local'
            ? this.messages
            : this.messages.filter(m => m.channel === this.activeChannel);

        const last50 = filtered.slice(-50);

        container.innerHTML = last50.map(m => {
            const time = new Date(m.timestamp);
            const ts = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            return `<div class="chat-msg">
                <span class="chat-ts">${ts}</span>
                <span class="chat-sender" style="color:${m.color}">${m.sender}</span>
                <span class="chat-text">${m.text}</span>
            </div>`;
        }).join('');

        container.scrollTop = container.scrollHeight;

        // Update channel button active states
        this.panel.querySelectorAll('.chat-channel-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.channel === this.activeChannel);
        });
    }

    update(dt) {
        this.updateBubblePositions();
    }
}
