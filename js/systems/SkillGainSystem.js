// =============================================
// Skill Gain System - By-Use XP Tracking
// Tracks 6 skills that level 1-100 through gameplay
// Awards 1 Skill Point per level-up for the skill tree
// =============================================

import { SKILL_GAIN_DEFINITIONS, MAX_SKILL_LEVEL, xpForLevel, cumulativeXP } from '../data/skillGainDatabase.js';

const LS_KEY = 'expedition-skill-gains';

export class SkillGainSystem {
    constructor(game) {
        this.game = game;
        this.skills = this.load();
        this.skillPoints = this.skills._sp || 0;
        this._saveTimer = null;
        this._pendingFlashes = []; // [{skillId, oldLevel, newLevel}]
        this.setupEvents();
    }

    setupEvents() {
        const events = this.game.events;

        // Gunnery: landing hits
        events.on('combat:hit', (data) => {
            if (data.source === this.game.player) {
                this.addXP('gunnery', 2);
            }
            // Engineering: taking hits
            if (data.target === this.game.player && this.game.player?.alive) {
                this.addXP('engineering', 1);
            }
        });

        // Gunnery: kills
        events.on('entity:destroyed', (entity) => {
            if (entity.bounty && entity.bounty > 0 && entity.lastDamageSource === this.game.player) {
                const xp = Math.floor(10 + entity.bounty * 0.05);
                this.addXP('gunnery', xp);
            }
        });

        // Mining: ore extraction
        events.on('mining:complete', (data) => {
            const units = data.units || 1;
            this.addXP('mining', Math.floor(3 + units * 0.5));
        });

        // Navigation: sector jumps
        events.on('sector:change', () => {
            this.addXP('navigation', 15);
        });

        // Navigation: warps
        events.on('warp:complete', () => {
            this.addXP('navigation', 5);
        });

        // Engineering: station repairs
        events.on('station:repair', () => {
            this.addXP('engineering', 10);
        });

        // Trade: buy/sell
        events.on('trade:complete', (data) => {
            const amount = data?.amount || data?.value || 100;
            this.addXP('trade', Math.floor(5 + amount * 0.01));
        });

        // Trade: refinery
        events.on('refinery:complete', () => {
            this.addXP('trade', 8);
        });

        // Tactical: EWAR
        events.on('ewar:applied', () => {
            this.addXP('tactical', 3);
        });

        // Tactical: fleet commands
        events.on('fleet:command', () => {
            this.addXP('tactical', 5);
        });

        // Tactical: scans
        events.on('scan:complete', () => {
            this.addXP('tactical', 8);
        });
    }

    addXP(skillId, amount) {
        if (!this.skills[skillId]) return;
        const skill = this.skills[skillId];
        if (skill.level >= MAX_SKILL_LEVEL) return;
        if (amount <= 0) return;

        skill.xp += amount;

        // Check for level ups
        while (skill.level < MAX_SKILL_LEVEL) {
            const needed = cumulativeXP(skill.level + 1);
            if (skill.xp >= needed) {
                skill.level++;
                this.skillPoints++;
                this._pendingFlashes.push({ skillId, level: skill.level });
                this.onLevelUp(skillId, skill.level);
            } else {
                break;
            }
        }

        // Emit flash for Skippy overlay
        if (this._pendingFlashes.length > 0) {
            const flashes = [...this._pendingFlashes];
            this._pendingFlashes = [];
            for (const f of flashes) {
                this.game.events.emit('skill:levelUp', f);
            }
        } else {
            // Emit XP gain for flash display (throttled)
            this.game.events.emit('skill:xpGain', { skillId, amount, level: skill.level, xp: skill.xp });
        }

        this.debounceSave();
    }

    onLevelUp(skillId, newLevel) {
        const def = SKILL_GAIN_DEFINITIONS[skillId];
        if (!def) return;

        this.game.ui?.showToast(`${def.name} reached Level ${newLevel}!`, 'level-up');
        this.game.ui?.log(`Skill up! ${def.name} is now Level ${newLevel} (+1 SP)`, 'system');
        this.game.ui?.addShipLogEntry(`${def.name} reached Level ${newLevel}`, 'skill');
        this.game.audio?.play('level-up');

        const p = this.game.player;
        if (p) {
            this.game.renderer?.effects?.spawnEffect('level-up', p.x, p.y);
        }

        this.applyBonuses();
    }

    /**
     * Calculate passive bonuses from by-use skill levels
     * Returns { statName: totalBonus } (additive within this system)
     */
    getPassiveBonuses() {
        const bonuses = {};
        for (const [skillId, def] of Object.entries(SKILL_GAIN_DEFINITIONS)) {
            const skill = this.skills[skillId];
            if (!skill) continue;
            for (const [stat, perLevel] of Object.entries(def.passivePerLevel)) {
                bonuses[stat] = (bonuses[stat] || 0) + perLevel * skill.level;
            }
        }
        return bonuses;
    }

    /**
     * Apply combined bonuses to player (called after level-up or load)
     * Merges with tree bonuses if tree system exists
     */
    applyBonuses() {
        const p = this.game.player;
        if (!p) return;

        const gainBonuses = this.getPassiveBonuses();
        const treeBonuses = this.game.skillTreeSystem?.getAllocatedBonuses?.() || {};

        // Multiplicative merge: (1 + gainBonus) * (1 + treeBonus)
        const allStats = new Set([...Object.keys(gainBonuses), ...Object.keys(treeBonuses)]);
        const combined = {};
        for (const stat of allStats) {
            const g = gainBonuses[stat] || 0;
            const t = treeBonuses[stat] || 0;
            combined[stat] = (1 + g) * (1 + t) - 1;
        }

        // Build skillBonuses object matching the old SkillSystem format
        p.skillBonuses = {
            damage: 1 + (combined.damageBonus || 0),
            tracking: 1 + (combined.trackingBonus || 0),
            maxSpeed: 1 + (combined.maxSpeedBonus || 0),
            warpSpeed: 1 + (combined.warpSpeedBonus || 0),
            warpSpool: 1 + (combined.warpSpoolBonus || 0),
            acceleration: 1 + (combined.accelerationBonus || 0),
            miningYield: 1 + (combined.miningYieldBonus || 0),
            miningSpeed: 1 + (combined.miningSpeedBonus || 0),
            refinery: 1 + (combined.refineryBonus || 0),
            shield: 1 + (combined.shieldBonus || 0),
            shieldResist: 1 + (combined.shieldResistBonus || 0),
            armor: 1 + (combined.armorBonus || 0),
            armorResist: 1 + (combined.armorResistBonus || 0),
            capacitor: 1 + (combined.capacitorBonus || 0),
            price: 1 + (combined.priceBonus || 0),
            cargo: 1 + (combined.cargoBonus || 0),
            range: 1 + (combined.rangeBonus || 0),
            taxReduction: 1 + (combined.taxReduction || 0),
            fireRate: 1 + (combined.fireRateBonus || 0),
            critChance: combined.critChance || 0,
            missileDamage: 1 + (combined.missileDamageBonus || 0),
            droneDamage: 1 + (combined.droneDamageBonus || 0),
            evasion: combined.evasionBonus || 0,
            ewar: 1 + (combined.ewarBonus || 0),
            fleet: 1 + (combined.fleetBonus || 0),
            scan: 1 + (combined.scanBonus || 0),
            insurance: 1 + (combined.insuranceBonus || 0),
            capacitorRegen: 1 + (combined.capacitorRegenBonus || 0),
            capacitorDrain: 1 + (combined.capacitorDrain || 0),
            rareOre: combined.rareOreChance || 0,
            hull: 1 + (combined.hullBonus || 0),
            ewarResist: 1 + (combined.ewarResist || 0),
            fleetTank: 1 + (combined.fleetTankBonus || 0),
            fleetWarp: 1 + (combined.fleetWarpBonus || 0),
            scanRange: 1 + (combined.scanRange || 0),
        };
    }

    /**
     * Get info for a single skill (for UI display)
     */
    getSkillInfo(skillId) {
        const skill = this.skills[skillId];
        const def = SKILL_GAIN_DEFINITIONS[skillId];
        if (!skill || !def) return null;

        const currentXP = skill.xp;
        const thisLevelXP = cumulativeXP(skill.level);
        const nextLevelXP = skill.level < MAX_SKILL_LEVEL ? cumulativeXP(skill.level + 1) : currentXP;
        const levelRange = nextLevelXP - thisLevelXP;
        const progress = skill.level >= MAX_SKILL_LEVEL ? 1 :
            levelRange > 0 ? (currentXP - thisLevelXP) / levelRange : 0;

        return {
            id: skillId,
            name: def.name,
            description: def.description,
            color: def.color,
            icon: def.icon,
            level: skill.level,
            xp: currentXP,
            nextXP: nextLevelXP,
            thisLevelXP,
            progress: Math.min(1, Math.max(0, progress)),
            maxed: skill.level >= MAX_SKILL_LEVEL,
            passivePerLevel: def.passivePerLevel,
        };
    }

    getAllSkills() {
        return Object.keys(SKILL_GAIN_DEFINITIONS).map(id => this.getSkillInfo(id));
    }

    /** Spend skill points (called by tree system) */
    spendSP(amount) {
        if (this.skillPoints < amount) return false;
        this.skillPoints -= amount;
        this.debounceSave();
        return true;
    }

    /** Refund skill points (called by tree system on respec) */
    refundSP(amount) {
        this.skillPoints += amount;
        this.debounceSave();
    }

    debounceSave() {
        if (!this._saveTimer) {
            this._saveTimer = setTimeout(() => {
                this.save();
                this._saveTimer = null;
            }, 2000);
        }
    }

    save() {
        try {
            const data = { ...this.skills, _sp: this.skillPoints };
            localStorage.setItem(LS_KEY, JSON.stringify(data));
        } catch (e) { /* storage full */ }
    }

    load() {
        try {
            const data = localStorage.getItem(LS_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                const skills = {};
                for (const id of Object.keys(SKILL_GAIN_DEFINITIONS)) {
                    skills[id] = parsed[id] || { level: 0, xp: 0 };
                }
                skills._sp = parsed._sp || 0;
                return skills;
            }
        } catch (e) { /* corrupt */ }

        const skills = {};
        for (const id of Object.keys(SKILL_GAIN_DEFINITIONS)) {
            skills[id] = { level: 0, xp: 0 };
        }
        skills._sp = 0;
        return skills;
    }

    // Legacy compatibility: old SkillSystem had onTrade / onWarp
    onTrade(amount) {
        this.addXP('trade', Math.floor(5 + amount * 0.01));
    }

    onWarp(distance) {
        this.addXP('navigation', Math.floor(2 + distance * 0.001));
    }
}
