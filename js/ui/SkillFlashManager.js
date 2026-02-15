// =============================================
// Skill Flash Manager - XP Gain Display near Skippy
// Shows brief flash of "Mining 10.6" etc. in the Skippy panel
// =============================================

import { SKILL_GAIN_DEFINITIONS } from '../data/skillGainDatabase.js';

export class SkillFlashManager {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.activeFlashes = [];
        this.maxFlashes = 4;
        this._throttle = {}; // skillId -> lastFlashTime

        this.createContainer();
        this.setupEvents();
    }

    createContainer() {
        // Find or create the flash container in skippy panel body
        const skippy = document.getElementById('skippy-body');
        if (!skippy) {
            // Defer until skippy panel exists
            setTimeout(() => this.createContainer(), 500);
            return;
        }

        this.container = document.createElement('div');
        this.container.id = 'skill-flash-container';
        this.container.className = 'skill-flash-container';
        skippy.appendChild(this.container);
    }

    setupEvents() {
        // XP gain flash (throttled to 1 per skill per 3s)
        this.game.events.on('skill:xpGain', (data) => {
            const now = Date.now();
            const lastTime = this._throttle[data.skillId] || 0;
            if (now - lastTime < 3000) return;
            this._throttle[data.skillId] = now;

            const def = SKILL_GAIN_DEFINITIONS[data.skillId];
            if (!def) return;

            // Show fractional level: e.g., "Mining 10.6"
            const info = this.game.skillGainSystem?.getSkillInfo(data.skillId);
            if (!info) return;
            const displayLevel = info.level + info.progress;
            this.showFlash(def.name, displayLevel.toFixed(1), def.color, false);
        });

        // Level-up flash (always shown, bigger)
        this.game.events.on('skill:levelUp', (data) => {
            const def = SKILL_GAIN_DEFINITIONS[data.skillId];
            if (!def) return;
            this.showFlash(def.name, `${data.level}`, def.color, true);
            this._throttle[data.skillId] = Date.now();
        });
    }

    showFlash(name, levelText, color, isLevelUp) {
        if (!this.container) return;

        // Remove oldest if at max
        while (this.activeFlashes.length >= this.maxFlashes) {
            const oldest = this.activeFlashes.shift();
            oldest?.remove();
        }

        const el = document.createElement('div');
        el.className = `skill-flash ${isLevelUp ? 'skill-flash-levelup' : ''}`;
        el.innerHTML = `<span class="skill-flash-name" style="color:${color}">${name}</span> <span class="skill-flash-level">${levelText}</span>`;

        this.container.appendChild(el);
        this.activeFlashes.push(el);

        // Trigger animation
        requestAnimationFrame(() => el.classList.add('skill-flash-active'));

        // Remove after animation
        const duration = isLevelUp ? 3000 : 2000;
        setTimeout(() => {
            el.classList.add('skill-flash-fade');
            setTimeout(() => {
                el.remove();
                const idx = this.activeFlashes.indexOf(el);
                if (idx >= 0) this.activeFlashes.splice(idx, 1);
            }, 400);
        }, duration);
    }
}
