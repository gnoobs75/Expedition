// =============================================
// Skill / Experience Progression System
// Tracks XP across 5 pilot skills, awards level-ups
// =============================================

export const SKILL_DEFINITIONS = {
    navigation: {
        name: 'Navigation',
        icon: '\u2699',
        description: 'Warp speed, align time, max velocity',
        color: '#44aaff',
        perLevel: [
            { stat: 'warpSpeedBonus', value: 0.08, label: '+8% warp speed' },
            { stat: 'maxSpeedBonus', value: 0.04, label: '+4% max speed' },
        ],
        specializations: {
            warpExpert: {
                name: 'Warp Expert',
                description: 'Master of FTL travel',
                perLevel: [
                    { stat: 'warpSpeedBonus', value: 0.12, label: '+12% warp speed' },
                    { stat: 'warpSpoolBonus', value: 0.10, label: '-10% spool time' },
                ],
            },
            speedDemon: {
                name: 'Speed Demon',
                description: 'Unmatched sublight velocity',
                perLevel: [
                    { stat: 'maxSpeedBonus', value: 0.08, label: '+8% max speed' },
                    { stat: 'accelerationBonus', value: 0.10, label: '+10% acceleration' },
                ],
            },
        },
    },
    gunnery: {
        name: 'Gunnery',
        icon: '\u2694',
        description: 'Weapon damage, tracking, range',
        color: '#ff4444',
        perLevel: [
            { stat: 'damageBonus', value: 0.06, label: '+6% damage' },
            { stat: 'trackingBonus', value: 0.05, label: '+5% tracking' },
        ],
        specializations: {
            sniper: {
                name: 'Sniper',
                description: 'Precision strikes at extreme range',
                perLevel: [
                    { stat: 'damageBonus', value: 0.04, label: '+4% damage' },
                    { stat: 'rangeBonus', value: 0.10, label: '+10% weapon range' },
                ],
            },
            brawler: {
                name: 'Brawler',
                description: 'Devastating close-range firepower',
                perLevel: [
                    { stat: 'damageBonus', value: 0.10, label: '+10% damage' },
                    { stat: 'trackingBonus', value: 0.08, label: '+8% tracking' },
                ],
            },
        },
    },
    mining: {
        name: 'Mining',
        icon: '\u26CF',
        description: 'Mining yield, cycle time',
        color: '#ffaa22',
        perLevel: [
            { stat: 'miningYieldBonus', value: 0.10, label: '+10% yield' },
        ],
        specializations: {
            stripMiner: {
                name: 'Strip Miner',
                description: 'Maximum extraction rate',
                perLevel: [
                    { stat: 'miningYieldBonus', value: 0.15, label: '+15% yield' },
                    { stat: 'miningSpeedBonus', value: 0.10, label: '+10% cycle speed' },
                ],
            },
            deepCore: {
                name: 'Deep Core',
                description: 'Specialist in rare ores',
                perLevel: [
                    { stat: 'miningYieldBonus', value: 0.08, label: '+8% yield' },
                    { stat: 'refineryBonus', value: 0.12, label: '+12% refinery output' },
                ],
            },
        },
    },
    engineering: {
        name: 'Engineering',
        icon: '\u26A1',
        description: 'Shield, capacitor, fitting',
        color: '#44ff88',
        perLevel: [
            { stat: 'shieldBonus', value: 0.05, label: '+5% shield HP' },
            { stat: 'capacitorBonus', value: 0.06, label: '+6% capacitor' },
        ],
        specializations: {
            shieldSpec: {
                name: 'Shield Specialist',
                description: 'Advanced shield technology',
                perLevel: [
                    { stat: 'shieldBonus', value: 0.08, label: '+8% shield HP' },
                    { stat: 'shieldResistBonus', value: 0.05, label: '+5% shield resist' },
                ],
            },
            armorSpec: {
                name: 'Armor Specialist',
                description: 'Reinforced hull plating expert',
                perLevel: [
                    { stat: 'armorBonus', value: 0.08, label: '+8% armor HP' },
                    { stat: 'armorResistBonus', value: 0.05, label: '+5% armor resist' },
                ],
            },
        },
    },
    trade: {
        name: 'Trade',
        icon: '\u2696',
        description: 'Better buy/sell prices, cargo space',
        color: '#ffdd44',
        perLevel: [
            { stat: 'priceBonus', value: 0.04, label: '+4% trade margin' },
            { stat: 'cargoBonus', value: 0.05, label: '+5% cargo space' },
        ],
        specializations: {
            tycoon: {
                name: 'Tycoon',
                description: 'Market domination through better deals',
                perLevel: [
                    { stat: 'priceBonus', value: 0.08, label: '+8% trade margin' },
                    { stat: 'taxReduction', value: 0.06, label: '-6% station tax' },
                ],
            },
            smuggler: {
                name: 'Smuggler',
                description: 'Haul more, move faster',
                perLevel: [
                    { stat: 'cargoBonus', value: 0.12, label: '+12% cargo space' },
                    { stat: 'maxSpeedBonus', value: 0.03, label: '+3% speed with cargo' },
                ],
            },
        },
    },
};

// XP required per level (1-5): 0, 100, 350, 800, 1500, 3000
const XP_TABLE = [0, 100, 350, 800, 1500, 3000];
const MAX_LEVEL = 5;

export class SkillSystem {
    constructor(game) {
        this.game = game;
        this.skills = this.load();
        this.setupEvents();
    }

    setupEvents() {
        const events = this.game.events;

        // Combat XP from kills
        events.on('entity:destroyed', (entity) => {
            if (entity.bounty && entity.bounty > 0 && this.game.player?.alive) {
                const xp = Math.floor(10 + entity.bounty * 0.05);
                this.addXP('gunnery', xp);
            }
        });

        // Combat hit XP (small drip)
        events.on('combat:hit', (data) => {
            if (data.source === this.game.player) {
                this.addXP('gunnery', 1);
            }
            if (data.target === this.game.player && this.game.player.alive) {
                this.addXP('engineering', 1);
            }
        });

        // Mining XP
        events.on('mining:complete', (data) => {
            const units = data.units || 1;
            this.addXP('mining', Math.floor(3 + units * 0.5));
        });

        // Jump XP
        events.on('sector:change', () => {
            this.addXP('navigation', 15);
        });
    }

    /**
     * Award trade XP (called externally by commerce/refinery)
     */
    onTrade(amount) {
        const xp = Math.floor(5 + amount * 0.01);
        this.addXP('trade', xp);
    }

    /**
     * Award navigation XP for warping
     */
    onWarp(distance) {
        const xp = Math.floor(2 + distance * 0.001);
        this.addXP('navigation', xp);
    }

    addXP(skillId, amount) {
        if (!this.skills[skillId]) return;
        const skill = this.skills[skillId];
        if (skill.level >= MAX_LEVEL) return;

        skill.xp += amount;

        // Check for level up
        while (skill.level < MAX_LEVEL && skill.xp >= XP_TABLE[skill.level + 1]) {
            skill.level++;
            this.onLevelUp(skillId, skill.level);
        }

        // Debounced save
        if (!this._saveTimer) {
            this._saveTimer = setTimeout(() => {
                this.save();
                this._saveTimer = null;
            }, 2000);
        }
    }

    onLevelUp(skillId, newLevel) {
        const def = SKILL_DEFINITIONS[skillId];
        if (!def) return;

        // Toast notification
        this.game.ui?.showToast(`${def.name} reached Level ${newLevel}!`, 'level-up');
        this.game.ui?.log(`Skill up! ${def.name} is now Level ${newLevel}`, 'system');
        this.game.ui?.addShipLogEntry(`${def.name} reached Level ${newLevel}`, 'skill');
        this.game.audio?.play('level-up');

        // Visual effect at player
        const p = this.game.player;
        if (p) {
            this.game.renderer?.effects?.spawnEffect('level-up', p.x, p.y);
        }

        // At level 3, prompt specialization choice if not already chosen
        if (newLevel === 3 && def.specializations && !this.skills[skillId].spec) {
            this.promptSpecialization(skillId);
        }

        this.save();
        this.applyBonuses();
    }

    /**
     * Prompt the player to choose a specialization at level 3
     */
    promptSpecialization(skillId) {
        const def = SKILL_DEFINITIONS[skillId];
        if (!def?.specializations) return;

        this._pendingSpec = skillId;
        this.game.events.emit('skill:specChoice', {
            skillId,
            skillName: def.name,
            options: Object.entries(def.specializations).map(([key, spec]) => ({
                key,
                name: spec.name,
                description: spec.description,
                bonuses: spec.perLevel.map(p => p.label).join(', '),
            })),
        });
    }

    /**
     * Apply chosen specialization
     */
    chooseSpecialization(skillId, specKey) {
        const def = SKILL_DEFINITIONS[skillId];
        if (!def?.specializations?.[specKey]) return;
        if (!this.skills[skillId]) return;

        this.skills[skillId].spec = specKey;
        this._pendingSpec = null;

        const spec = def.specializations[specKey];
        this.game.ui?.showToast(`${def.name}: ${spec.name} specialization chosen!`, 'level-up');
        this.game.ui?.log(`Specialized in ${spec.name}!`, 'system');
        this.game.audio?.play('quest-complete');

        this.save();
        this.applyBonuses();
    }

    /**
     * Get the multiplier for a given stat bonus
     * Base perLevel bonuses apply for levels 1-5
     * Specialization bonuses apply for levels 3-5 (up to 3 extra levels)
     */
    getBonus(statName) {
        let total = 0;
        for (const [skillId, skill] of Object.entries(this.skills)) {
            const def = SKILL_DEFINITIONS[skillId];
            if (!def) continue;

            // Base bonuses (all levels)
            for (const perk of def.perLevel) {
                if (perk.stat === statName) {
                    total += perk.value * skill.level;
                }
            }

            // Specialization bonuses (levels 3-5 only)
            if (skill.spec && skill.level >= 3 && def.specializations?.[skill.spec]) {
                const specLevels = skill.level - 2; // 1 at lvl3, 2 at lvl4, 3 at lvl5
                for (const perk of def.specializations[skill.spec].perLevel) {
                    if (perk.stat === statName) {
                        total += perk.value * specLevels;
                    }
                }
            }
        }
        return 1 + total; // e.g. 1.12 for +12%
    }

    /**
     * Apply skill bonuses to player ship stats
     */
    applyBonuses() {
        const p = this.game.player;
        if (!p) return;

        // Recalculate effective stats from base + skills
        // These are multiplicative bonuses applied on top of base stats
        p.skillBonuses = {
            damage: this.getBonus('damageBonus'),
            tracking: this.getBonus('trackingBonus'),
            maxSpeed: this.getBonus('maxSpeedBonus'),
            warpSpeed: this.getBonus('warpSpeedBonus'),
            warpSpool: this.getBonus('warpSpoolBonus'),
            acceleration: this.getBonus('accelerationBonus'),
            miningYield: this.getBonus('miningYieldBonus'),
            miningSpeed: this.getBonus('miningSpeedBonus'),
            refinery: this.getBonus('refineryBonus'),
            shield: this.getBonus('shieldBonus'),
            shieldResist: this.getBonus('shieldResistBonus'),
            armor: this.getBonus('armorBonus'),
            armorResist: this.getBonus('armorResistBonus'),
            capacitor: this.getBonus('capacitorBonus'),
            price: this.getBonus('priceBonus'),
            cargo: this.getBonus('cargoBonus'),
            range: this.getBonus('rangeBonus'),
            taxReduction: this.getBonus('taxReduction'),
        };
    }

    /**
     * Get skill info for display
     */
    getSkillInfo(skillId) {
        const skill = this.skills[skillId];
        const def = SKILL_DEFINITIONS[skillId];
        if (!skill || !def) return null;

        const currentXP = skill.xp;
        const currentLevelXP = XP_TABLE[skill.level] || 0;
        const nextLevelXP = skill.level < MAX_LEVEL ? XP_TABLE[skill.level + 1] : currentXP;
        const progress = skill.level >= MAX_LEVEL ? 1 :
            (currentXP - currentLevelXP) / (nextLevelXP - currentLevelXP);

        const specKey = skill.spec;
        const specDef = specKey && def.specializations?.[specKey];

        return {
            ...def,
            id: skillId,
            level: skill.level,
            xp: currentXP,
            nextXP: nextLevelXP,
            progress: Math.min(1, Math.max(0, progress)),
            maxed: skill.level >= MAX_LEVEL,
            spec: specKey || null,
            specName: specDef?.name || null,
            specDescription: specDef?.description || null,
            canSpecialize: skill.level >= 3 && !specKey && !!def.specializations,
        };
    }

    /**
     * Get all skills for display
     */
    getAllSkills() {
        return Object.keys(SKILL_DEFINITIONS).map(id => this.getSkillInfo(id));
    }

    save() {
        try {
            localStorage.setItem('expedition-skills', JSON.stringify(this.skills));
        } catch (e) { /* storage full */ }
    }

    load() {
        try {
            const data = localStorage.getItem('expedition-skills');
            if (data) {
                const parsed = JSON.parse(data);
                // Ensure all skills exist
                const skills = {};
                for (const id of Object.keys(SKILL_DEFINITIONS)) {
                    skills[id] = parsed[id] || { level: 0, xp: 0 };
                }
                return skills;
            }
        } catch (e) { /* corrupt */ }

        // Default: all skills at level 0
        const skills = {};
        for (const id of Object.keys(SKILL_DEFINITIONS)) {
            skills[id] = { level: 0, xp: 0 };
        }
        return skills;
    }
}
