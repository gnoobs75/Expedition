import { CONFIG } from '../config.js';
import { FACTIONS } from '../data/factionDatabase.js';

// 8 mission templates
const MISSION_TEMPLATES = {
    kill: { name: 'Extermination', description: 'Destroy {count} {targetType} ships', category: 'combat', objectiveType: 'kill', minDifficulty: 'easy' },
    deliver: { name: 'Delivery', description: 'Deliver {count} {itemName} to {destination}', category: 'trade', objectiveType: 'deliver', minDifficulty: 'easy' },
    mine: { name: 'Mining Contract', description: 'Mine {count} units of {oreName}', category: 'industry', objectiveType: 'mine', minDifficulty: 'easy' },
    scout: { name: 'Reconnaissance', description: 'Visit {count} sectors', category: 'exploration', objectiveType: 'visit-sector', minDifficulty: 'easy' },
    escort: { name: 'Escort Duty', description: 'Protect a convoy for {duration}s', category: 'combat', objectiveType: 'escort', minDifficulty: 'medium' },
    salvage: { name: 'Salvage Operation', description: 'Collect {count} salvage components', category: 'industry', objectiveType: 'salvage', minDifficulty: 'easy' },
    bounty: { name: 'Bounty Hunt', description: 'Destroy the target: {targetName}', category: 'combat', objectiveType: 'kill-specific', minDifficulty: 'medium' },
    defend: { name: 'Sector Defense', description: 'Destroy {count} hostiles in {sectorName}', category: 'combat', objectiveType: 'kill-in-sector', minDifficulty: 'hard' },
};

export class MissionSystem {
    constructor(game) {
        this.game = game;
        this.activeMissions = []; // max 5
        this.completedMissionIds = new Set();
        this.missionCounter = 0;
        
        // Subscribe to events for objective tracking
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // entity:destroyed -> check kill missions
        this.game.events.on('entity:destroyed', (entity) => this.checkKillObjective(entity));
        // mining:complete -> check mine missions  
        this.game.events.on('mining:complete', (data) => this.checkMineObjective(data));
        // sector:change -> check scout missions
        this.game.events.on('sector:change', (data) => this.checkScoutObjective(data));
        // cargo:updated -> check deliver missions
        this.game.events.on('cargo:updated', () => this.checkDeliverObjective());
    }
    
    // Generate 3-5 missions for a station visit
    generateMissions(stationFaction, sectorDifficulty) {
        const count = 3 + Math.floor(Math.random() * 3); // 3-5
        const missions = [];
        const templateKeys = Object.keys(MISSION_TEMPLATES);
        const used = new Set();
        
        for (let i = 0; i < count; i++) {
            // Pick random template, avoid duplicates
            let key;
            do { key = templateKeys[Math.floor(Math.random() * templateKeys.length)]; } while (used.has(key) && used.size < templateKeys.length);
            used.add(key);
            
            const template = MISSION_TEMPLATES[key];
            const difficulty = this.getDifficultyLevel(sectorDifficulty);
            const mission = this.buildMission(key, template, stationFaction, difficulty);
            if (mission) missions.push(mission);
        }
        return missions;
    }
    
    // Build a concrete mission from a template
    buildMission(templateKey, template, factionId, difficulty) {
        const id = `mission-${++this.missionCounter}`;
        const diffMult = { easy: 1, medium: 1.5, hard: 2.5, deadly: 4 }[difficulty] || 1;
        
        // Build objectives based on type
        let objective = {};
        let rewardCredits = 0;
        let rewardStanding = 0.2;
        let descriptionFilled = template.description;
        
        switch (templateKey) {
            case 'kill':
                objective = { type: 'kill', targetType: 'enemy', count: Math.floor(3 * diffMult), progress: 0 };
                descriptionFilled = template.description.replace('{count}', objective.count).replace('{targetType}', 'hostile');
                rewardCredits = Math.floor(500 * diffMult);
                break;
            case 'deliver':
                const goods = ['electronics', 'medical-supplies', 'rare-minerals', 'luxury-goods'];
                const good = goods[Math.floor(Math.random() * goods.length)];
                objective = { type: 'deliver', itemName: good, count: Math.floor(5 * diffMult), progress: 0 };
                descriptionFilled = template.description.replace('{count}', objective.count).replace('{itemName}', good).replace('{destination}', 'any station');
                rewardCredits = Math.floor(400 * diffMult);
                break;
            case 'mine':
                const ores = ['iron', 'gold', 'platinum', 'titanium'];
                const ore = ores[Math.floor(Math.random() * ores.length)];
                objective = { type: 'mine', oreName: ore, count: Math.floor(10 * diffMult), progress: 0 };
                descriptionFilled = template.description.replace('{count}', objective.count).replace('{oreName}', ore);
                rewardCredits = Math.floor(300 * diffMult);
                break;
            case 'scout':
                objective = { type: 'visit-sector', count: Math.floor(2 * diffMult), progress: 0, visitedSectors: [] };
                descriptionFilled = template.description.replace('{count}', objective.count);
                rewardCredits = Math.floor(350 * diffMult);
                break;
            case 'escort':
                objective = { type: 'escort', duration: Math.floor(60 * diffMult), elapsed: 0 };
                descriptionFilled = template.description.replace('{duration}', objective.duration);
                rewardCredits = Math.floor(600 * diffMult);
                break;
            case 'salvage':
                objective = { type: 'salvage', count: Math.floor(3 * diffMult), progress: 0 };
                descriptionFilled = template.description.replace('{count}', objective.count);
                rewardCredits = Math.floor(350 * diffMult);
                break;
            case 'bounty':
                const names = ['Crimson Blade', 'Shadow Runner', 'Void Walker', 'Iron Fist', 'Death Dealer'];
                const targetName = names[Math.floor(Math.random() * names.length)];
                objective = { type: 'kill-specific', targetName, count: 1, progress: 0 };
                descriptionFilled = template.description.replace('{targetName}', targetName);
                rewardCredits = Math.floor(1000 * diffMult);
                rewardStanding = 0.5;
                break;
            case 'defend':
                const sectorName = this.game.currentSector?.name || 'current sector';
                objective = { type: 'kill-in-sector', sectorId: this.game.currentSector?.id, sectorName, count: Math.floor(5 * diffMult), progress: 0 };
                descriptionFilled = template.description.replace('{count}', objective.count).replace('{sectorName}', sectorName);
                rewardCredits = Math.floor(800 * diffMult);
                rewardStanding = 0.4;
                break;
        }
        
        return {
            id,
            templateKey,
            name: template.name,
            description: descriptionFilled,
            category: template.category,
            faction: factionId,
            difficulty,
            objective,
            reward: { credits: rewardCredits, standing: rewardStanding },
            expiresAt: Date.now() + 30 * 60 * 1000, // 30 min
            accepted: false,
            completed: false,
        };
    }
    
    getDifficultyLevel(sectorDifficulty) {
        const levels = ['easy', 'medium', 'hard', 'deadly'];
        return sectorDifficulty || levels[Math.floor(Math.random() * 3)];
    }
    
    // Accept a mission (max 5 active)
    acceptMission(mission) {
        if (this.activeMissions.length >= 5) {
            this.game.ui?.toast('Maximum 5 active missions', 'warning');
            return false;
        }
        mission.accepted = true;
        this.activeMissions.push(mission);
        this.game.events.emit('mission:accepted', mission);
        this.game.ui?.toast(`Mission accepted: ${mission.name}`, 'info');
        return true;
    }
    
    // Abandon a mission
    abandonMission(missionId) {
        const idx = this.activeMissions.findIndex(m => m.id === missionId);
        if (idx >= 0) {
            const mission = this.activeMissions.splice(idx, 1)[0];
            this.game.events.emit('mission:abandoned', mission);
            this.game.ui?.toast(`Mission abandoned: ${mission.name}`, 'warning');
        }
    }
    
    // Complete a mission - give rewards
    completeMission(missionId) {
        const idx = this.activeMissions.findIndex(m => m.id === missionId);
        if (idx < 0) return;
        const mission = this.activeMissions[idx];
        
        // Award credits
        this.game.credits += mission.reward.credits;
        
        // Award faction standing
        if (mission.faction) {
            this.game.modifyStanding?.(mission.faction, mission.reward.standing);
        }
        
        // Remove from active
        this.activeMissions.splice(idx, 1);
        this.completedMissionIds.add(mission.id);
        mission.completed = true;
        
        this.game.events.emit('mission:completed', mission);
        this.game.audio?.play('quest-complete');
        this.game.ui?.toast(`Mission complete: ${mission.name} (+${mission.reward.credits} ISK)`, 'success');
    }
    
    // Check kill objectives against destroyed entity
    checkKillObjective(entity) {
        if (!entity || entity.isPlayer) return;
        for (const mission of this.activeMissions) {
            const obj = mission.objective;
            if (obj.type === 'kill' && (entity.type === 'enemy' || entity.hostility === 'hostile')) {
                if (entity.lastDamageSource === this.game.player || entity.lastDamageSource?.isFleet) {
                    obj.progress = Math.min(obj.count, (obj.progress || 0) + 1);
                    if (obj.progress >= obj.count) this.completeMission(mission.id);
                }
            }
            if (obj.type === 'kill-specific' && entity.name?.includes(obj.targetName)) {
                obj.progress = 1;
                this.completeMission(mission.id);
            }
            if (obj.type === 'kill-in-sector' && obj.sectorId === this.game.currentSector?.id) {
                if (entity.type === 'enemy' && (entity.lastDamageSource === this.game.player || entity.lastDamageSource?.isFleet)) {
                    obj.progress = Math.min(obj.count, (obj.progress || 0) + 1);
                    if (obj.progress >= obj.count) this.completeMission(mission.id);
                }
            }
        }
    }
    
    // Check mine objectives
    checkMineObjective(data) {
        if (!data) return;
        for (const mission of this.activeMissions) {
            const obj = mission.objective;
            if (obj.type === 'mine') {
                if (!obj.oreName || data.oreType === obj.oreName) {
                    obj.progress = Math.min(obj.count, (obj.progress || 0) + (data.amount || 1));
                    if (obj.progress >= obj.count) this.completeMission(mission.id);
                }
            }
        }
    }
    
    // Check scout/visit objectives
    checkScoutObjective(data) {
        for (const mission of this.activeMissions) {
            const obj = mission.objective;
            if (obj.type === 'visit-sector') {
                const sectorId = data?.sectorId || this.game.currentSector?.id;
                if (sectorId && !obj.visitedSectors.includes(sectorId)) {
                    obj.visitedSectors.push(sectorId);
                    obj.progress = obj.visitedSectors.length;
                    if (obj.progress >= obj.count) this.completeMission(mission.id);
                }
            }
        }
    }
    
    // Check deliver objectives (when docking at station with cargo)
    checkDeliverObjective() {
        if (!this.game.dockedAt) return;
        for (const mission of this.activeMissions) {
            const obj = mission.objective;
            if (obj.type === 'deliver') {
                const have = this.game.player?.tradeGoods?.[obj.itemName] || this.game.player?.cargo?.[obj.itemName]?.amount || 0;
                obj.progress = Math.min(obj.count, have);
                if (obj.progress >= obj.count) this.completeMission(mission.id);
            }
        }
    }
    
    // Update - check for expired missions
    update(dt) {
        const now = Date.now();
        for (let i = this.activeMissions.length - 1; i >= 0; i--) {
            const m = this.activeMissions[i];
            if (m.expiresAt && now > m.expiresAt) {
                this.activeMissions.splice(i, 1);
                this.game.ui?.toast(`Mission expired: ${m.name}`, 'warning');
                this.game.events.emit('mission:expired', m);
            }
            // Escort timer
            if (m.objective.type === 'escort' && m.accepted) {
                m.objective.elapsed = (m.objective.elapsed || 0) + dt;
                if (m.objective.elapsed >= m.objective.duration) {
                    this.completeMission(m.id);
                }
            }
        }
    }
    
    // Save state
    saveState() {
        return {
            activeMissions: this.activeMissions,
            completedIds: [...this.completedMissionIds],
            counter: this.missionCounter,
        };
    }
    
    // Load state
    loadState(data) {
        if (!data) return;
        this.activeMissions = data.activeMissions || [];
        this.completedMissionIds = new Set(data.completedIds || []);
        this.missionCounter = data.counter || 0;
    }
}
