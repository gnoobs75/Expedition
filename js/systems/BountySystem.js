// =============================================
// Bounty System
// Manages bounty board contracts for named
// pirate captains with unique encounters
// =============================================

import { CONFIG, UNIVERSE_LAYOUT } from '../config.js';
import { BOUNTY_TARGETS, BOUNTY_CONFIG } from '../data/bountyTargetDatabase.js';

export class BountySystem {
    constructor(game) {
        this.game = game;

        // Bounty board: available contracts at stations
        this.board = []; // [{targetId, accepted}]

        // Active bounties: accepted by the player
        this.activeBounties = []; // [{targetId, acceptedTime, lastSeenSector, spawnedEntityId}]

        // Completed bounty target IDs (for respawn tracking)
        this.completedBounties = new Set();

        // Respawn timers for killed targets: targetId -> killTime (seconds since page load)
        this.respawnTimers = new Map();

        // Board refresh timer
        this.refreshTimer = 0;

        // Last-seen update timer (for abstract patrol tracking)
        this.lastSeenTimer = 0;
        this.lastSeenInterval = 10; // Update last-seen every 10 seconds

        // Listen for kills to check bounty completion
        game.events.on('entity:destroyed', (entity) => this.checkBountyKill(entity));

        // Listen for sector changes to spawn bounty targets
        game.events.on('sector:change', (sectorId) => this.onSectorEnter(sectorId));

        // Initial board population
        this.refreshBoard();
    }

    // ==========================================
    // Main Update Loop
    // ==========================================

    /**
     * Update bounty system each frame
     */
    update(dt) {
        // Board refresh timer
        this.refreshTimer += dt;
        if (this.refreshTimer >= BOUNTY_CONFIG.refreshInterval) {
            this.refreshTimer -= BOUNTY_CONFIG.refreshInterval;
            this.refreshBoard();
        }

        // Check respawn timers - move targets back to eligible pool
        const now = performance.now() / 1000;
        for (const [targetId, killTime] of this.respawnTimers.entries()) {
            if (now - killTime >= BOUNTY_CONFIG.respawnTime) {
                this.completedBounties.delete(targetId);
                this.respawnTimers.delete(targetId);
            }
        }

        // Update "last seen" for active bounties (abstract patrol simulation)
        this.lastSeenTimer += dt;
        if (this.lastSeenTimer >= this.lastSeenInterval) {
            this.lastSeenTimer -= this.lastSeenInterval;
            this.updateLastSeen();
        }
    }

    // ==========================================
    // Board Management
    // ==========================================

    /**
     * Refresh the bounty board with available targets
     * Fills up to boardSize with targets that aren't active or recently completed
     */
    refreshBoard() {
        // Keep accepted bounties on the board
        this.board = this.board.filter(entry => entry.accepted);

        const allTargetIds = Object.keys(BOUNTY_TARGETS);
        const activeTargetIds = new Set(this.activeBounties.map(b => b.targetId));
        const boardTargetIds = new Set(this.board.map(b => b.targetId));

        // Filter eligible targets
        const eligible = allTargetIds.filter(tid => {
            if (activeTargetIds.has(tid)) return false;
            if (boardTargetIds.has(tid)) return false;
            if (this.completedBounties.has(tid)) return false;
            return true;
        });

        // Shuffle eligible targets
        for (let i = eligible.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
        }

        // Fill board up to boardSize
        const slotsToFill = BOUNTY_CONFIG.boardSize - this.board.length;
        for (let i = 0; i < Math.min(slotsToFill, eligible.length); i++) {
            this.board.push({
                targetId: eligible[i],
                accepted: false,
            });
        }

        // Sort board by tier for display
        this.board.sort((a, b) => {
            const ta = BOUNTY_TARGETS[a.targetId];
            const tb = BOUNTY_TARGETS[b.targetId];
            return (ta?.tier || 1) - (tb?.tier || 1);
        });
    }

    /**
     * Accept a bounty from the board
     * @returns {boolean} Whether the bounty was successfully accepted
     */
    acceptBounty(targetId) {
        // Check max active limit
        if (this.activeBounties.length >= BOUNTY_CONFIG.maxActive) {
            this.game.ui?.showToast('Maximum active bounties reached', 'warning');
            return false;
        }

        // Find on board
        const boardEntry = this.board.find(b => b.targetId === targetId && !b.accepted);
        if (!boardEntry) {
            this.game.ui?.showToast('Bounty no longer available', 'warning');
            return false;
        }

        const target = BOUNTY_TARGETS[targetId];
        if (!target) return false;

        // Mark as accepted on board
        boardEntry.accepted = true;

        // Pick initial "last seen" sector from patrol route
        const patrolSectors = target.patrolSectors || [];
        const lastSeen = patrolSectors.length > 0
            ? patrolSectors[Math.floor(Math.random() * patrolSectors.length)]
            : 'hub';

        // Add to active bounties
        this.activeBounties.push({
            targetId,
            acceptedTime: performance.now() / 1000,
            lastSeenSector: lastSeen,
            spawnedEntityId: null,
        });

        // Notify player
        this.game.ui?.showToast(`Bounty accepted: ${target.name} - ${target.title}`, 'system');
        this.game.ui?.log(`Bounty contract accepted: ${target.name} "${target.title}" - ${this.formatCredits(target.bounty)} ISK`, 'system');
        this.game.ui?.addShipLogEntry(`Accepted bounty: ${target.name}`, 'trade');
        this.game.audio?.play('sell', 0.3);

        this.game.events.emit('bounty:accepted', { targetId, target });

        return true;
    }

    /**
     * Abandon an active bounty
     */
    abandonBounty(targetId) {
        const idx = this.activeBounties.findIndex(b => b.targetId === targetId);
        if (idx === -1) return false;

        const bounty = this.activeBounties[idx];

        // If spawned in current sector, despawn entity
        this.despawnBountyEntity(bounty);

        // Remove from active
        this.activeBounties.splice(idx, 1);

        // Remove accepted flag from board
        const boardEntry = this.board.find(b => b.targetId === targetId);
        if (boardEntry) {
            boardEntry.accepted = false;
        }

        const target = BOUNTY_TARGETS[targetId];
        this.game.ui?.showToast(`Bounty abandoned: ${target?.name || targetId}`, 'warning');
        this.game.ui?.log(`Bounty abandoned: ${target?.name || targetId}`, 'system');

        this.game.events.emit('bounty:abandoned', { targetId });

        return true;
    }

    // ==========================================
    // Patrol Simulation & Spawning
    // ==========================================

    /**
     * Update "last seen" locations for active bounties
     * This is abstract - bounty targets patrol between sectors even when
     * the player isn't there. Each update cycle, there's a chance the
     * target "moves" to a different sector in their patrol route.
     */
    updateLastSeen() {
        for (const bounty of this.activeBounties) {
            // Don't move if already spawned in player's sector
            if (bounty.spawnedEntityId) continue;

            const target = BOUNTY_TARGETS[bounty.targetId];
            if (!target) continue;

            const patrolSectors = target.patrolSectors || [];
            if (patrolSectors.length <= 1) continue;

            // 30% chance to move to a different patrol sector each cycle
            if (Math.random() < 0.3) {
                const others = patrolSectors.filter(s => s !== bounty.lastSeenSector);
                if (others.length > 0) {
                    bounty.lastSeenSector = others[Math.floor(Math.random() * others.length)];
                }
            }
        }
    }

    /**
     * Called when player enters a new sector
     * Spawn bounty targets that are "patrolling" this sector
     */
    onSectorEnter(sectorId) {
        // Despawn any bounty entities from the previous sector
        for (const bounty of this.activeBounties) {
            if (bounty.spawnedEntityId) {
                bounty.spawnedEntityId = null;
            }
        }

        // Check if any active bounties are in this sector
        for (const bounty of this.activeBounties) {
            const target = BOUNTY_TARGETS[bounty.targetId];
            if (!target) continue;

            const patrolSectors = target.patrolSectors || [];

            // Map patrol sector names to actual sector IDs
            // Patrol sectors may use shorthand names, so check both exact match
            // and partial match against UNIVERSE_LAYOUT sector names
            const isInSector = patrolSectors.some(ps => {
                if (ps === sectorId) return true;
                // Check if patrol sector name matches a universe sector
                const universeSector = UNIVERSE_LAYOUT.sectors.find(
                    s => s.id === sectorId
                );
                if (universeSector && universeSector.name.toLowerCase().includes(ps.toLowerCase())) {
                    return true;
                }
                return false;
            });

            if (isInSector) {
                // Target is patrolling here - chance to spawn
                // Higher tier targets are less likely to be present
                const spawnChance = Math.max(0.3, 1.0 - (target.tier - 1) * 0.15);
                if (Math.random() < spawnChance) {
                    this.spawnBountyTarget(bounty, sectorId);
                }
            }
        }
    }

    /**
     * Spawn a bounty target entity in the current sector
     */
    spawnBountyTarget(bounty, sectorId) {
        const target = BOUNTY_TARGETS[bounty.targetId];
        if (!target) return;

        const sector = this.game.currentSector;
        if (!sector) return;

        const EnemyShipClass = this.game._EnemyShipClass;
        if (!EnemyShipClass) return;

        // Spawn position: random location away from station and center
        const cx = CONFIG.SECTOR_SIZE / 2;
        const cy = CONFIG.SECTOR_SIZE / 2;
        const angle = Math.random() * Math.PI * 2;
        const dist = 4000 + Math.random() * 8000;
        const spawnX = cx + Math.cos(angle) * dist;
        const spawnY = cy + Math.sin(angle) * dist;

        // Determine base enemy type from tier
        const baseEnemyType = target.tier >= 3 ? 'pirate-cruiser' : 'pirate-frigate';

        // Create the bounty target as an EnemyShip with overrides
        const entity = new EnemyShipClass(this.game, {
            x: spawnX,
            y: spawnY,
            enemyType: baseEnemyType,
            name: `${target.name} "${target.title}"`,
        });

        // Override with bounty target stats
        const stats = target.stats || {};
        if (stats.shield) {
            entity.shield = Math.floor(entity.shield * stats.shield);
            entity.maxShield = entity.shield;
        }
        if (stats.armor) {
            entity.armor = Math.floor(entity.armor * stats.armor);
            entity.maxArmor = entity.armor;
        }
        if (stats.hull) {
            entity.hull = Math.floor(entity.hull * stats.hull);
            entity.maxHull = entity.hull;
        }

        // Set bounty reward
        entity.bounty = target.bounty;

        // Mark as bounty target for identification on kill
        entity.bountyTargetId = bounty.targetId;
        entity.isBountyTarget = true;

        // Increase aggro range for bounty targets (they're aggressive hunters)
        entity.aggroRange = 2000;
        entity.aggression = 0.9;

        // Add to sector
        sector.addEntity(entity);
        bounty.spawnedEntityId = entity.id;
        bounty.lastSeenSector = sectorId;

        // Notify player
        this.game.ui?.showToast(`Bounty target detected: ${target.name}!`, 'danger');
        this.game.ui?.log(`BOUNTY TARGET SIGHTED: ${target.name} "${target.title}" is in this sector!`, 'combat');
        this.game.audio?.play('ewar-warning', 0.5);

        this.game.events.emit('bounty:targetSpawned', {
            targetId: bounty.targetId,
            entityId: entity.id,
            sectorId,
        });
    }

    /**
     * Despawn a bounty entity from the sector
     */
    despawnBountyEntity(bounty) {
        if (!bounty.spawnedEntityId) return;

        const sector = this.game.currentSector;
        if (!sector) {
            bounty.spawnedEntityId = null;
            return;
        }

        const entity = sector.entities.find(e => e.id === bounty.spawnedEntityId);
        if (entity && entity.alive) {
            entity.alive = false;
            if (entity.destroy) entity.destroy();
            sector.removeEntity(entity);
        }

        bounty.spawnedEntityId = null;
    }

    // ==========================================
    // Kill Checking & Completion
    // ==========================================

    /**
     * Check if a destroyed entity was a bounty target
     */
    checkBountyKill(entity) {
        if (!entity || !entity.bountyTargetId) return;

        const targetId = entity.bountyTargetId;
        const bounty = this.activeBounties.find(b => b.targetId === targetId);
        if (!bounty) return;

        this.completeBounty(targetId, entity);
    }

    /**
     * Complete a bounty contract and award rewards
     */
    completeBounty(targetId, killedEntity) {
        const target = BOUNTY_TARGETS[targetId];
        if (!target) return;

        const bountyIdx = this.activeBounties.findIndex(b => b.targetId === targetId);
        if (bountyIdx === -1) return;

        // Remove from active bounties
        this.activeBounties.splice(bountyIdx, 1);

        // Remove from board
        const boardIdx = this.board.findIndex(b => b.targetId === targetId);
        if (boardIdx !== -1) {
            this.board.splice(boardIdx, 1);
        }

        // Mark as completed with respawn timer
        this.completedBounties.add(targetId);
        this.respawnTimers.set(targetId, performance.now() / 1000);

        // Award bounty credits
        const bountyReward = target.bounty;
        this.game.credits += bountyReward;

        // Award special loot
        const lootDropped = [];
        if (target.specialLoot) {
            for (const loot of target.specialLoot) {
                if (Math.random() < (loot.chance || 0.1)) {
                    lootDropped.push(loot.itemId);
                    // Add to player module inventory if it's a module
                    if (this.game.player?.moduleInventory) {
                        this.game.player.moduleInventory.push(loot.itemId);
                    }
                }
            }
        }

        // Track stats
        if (this.game.stats) {
            this.game.stats.bountyEarned = (this.game.stats.bountyEarned || 0) + bountyReward;
        }

        // Visual and audio feedback
        this.game.audio?.play('quest-complete', 0.6);
        this.game.renderer?.effects?.spawn('loot', killedEntity?.x || 0, killedEntity?.y || 0, {
            count: 20,
            color: 0xffdd44,
        });

        // Toast notification
        this.game.ui?.showToast(
            `BOUNTY COMPLETE: ${target.name} - ${this.formatCredits(bountyReward)} ISK`,
            'success'
        );

        // Credit popup
        if (this.game.ui?.showCreditPopup) {
            this.game.ui.showCreditPopup(
                bountyReward,
                window.innerWidth / 2,
                window.innerHeight / 2 - 60,
                'gain'
            );
        }

        // Log
        this.game.ui?.log(
            `Bounty collected: ${target.name} "${target.title}" - ${this.formatCredits(bountyReward)} ISK`,
            'combat'
        );
        this.game.ui?.addShipLogEntry(
            `Bounty complete: ${target.name} +${this.formatCredits(bountyReward)} ISK`,
            'combat'
        );

        if (lootDropped.length > 0) {
            this.game.ui?.log(`Special loot recovered: ${lootDropped.join(', ')}`, 'system');
        }

        // Emit event
        this.game.events.emit('bounty:completed', {
            targetId,
            target,
            reward: bountyReward,
            loot: lootDropped,
        });
    }

    // ==========================================
    // Query Methods
    // ==========================================

    /**
     * Get bounty board data for station UI
     */
    getBoardData() {
        return this.board.map(entry => {
            const target = BOUNTY_TARGETS[entry.targetId];
            if (!target) return null;

            return {
                targetId: entry.targetId,
                name: target.name,
                title: target.title,
                tier: target.tier,
                shipClass: target.shipClass,
                bounty: target.bounty,
                description: target.description,
                patrolSectors: target.patrolSectors || [],
                accepted: entry.accepted,
            };
        }).filter(Boolean);
    }

    /**
     * Get active bounty data for the player's HUD/panel
     */
    getActiveBountyData() {
        return this.activeBounties.map(bounty => {
            const target = BOUNTY_TARGETS[bounty.targetId];
            if (!target) return null;

            // Resolve last seen sector name
            const lastSeenInfo = UNIVERSE_LAYOUT.sectors.find(
                s => s.id === bounty.lastSeenSector
            );

            return {
                targetId: bounty.targetId,
                name: target.name,
                title: target.title,
                tier: target.tier,
                shipClass: target.shipClass,
                bounty: target.bounty,
                description: target.description,
                acceptedTime: bounty.acceptedTime,
                lastSeenSector: bounty.lastSeenSector,
                lastSeenSectorName: lastSeenInfo?.name || bounty.lastSeenSector,
                isSpawned: bounty.spawnedEntityId !== null,
                patrolSectors: target.patrolSectors || [],
            };
        }).filter(Boolean);
    }

    /**
     * Check if a target is currently on the board
     */
    isOnBoard(targetId) {
        return this.board.some(b => b.targetId === targetId);
    }

    /**
     * Check if a target is currently an active bounty
     */
    isActiveBounty(targetId) {
        return this.activeBounties.some(b => b.targetId === targetId);
    }

    /**
     * Check if a target has been completed recently
     */
    isCompleted(targetId) {
        return this.completedBounties.has(targetId);
    }

    // ==========================================
    // Utility
    // ==========================================

    /**
     * Format credits for display (thousands separator)
     */
    formatCredits(amount) {
        return amount.toLocaleString();
    }

    // ==========================================
    // Persistence
    // ==========================================

    /**
     * Save bounty state for serialization
     */
    saveState() {
        return {
            board: this.board.map(b => ({
                targetId: b.targetId,
                accepted: b.accepted,
            })),
            activeBounties: this.activeBounties.map(b => ({
                targetId: b.targetId,
                acceptedTime: b.acceptedTime,
                lastSeenSector: b.lastSeenSector,
                // Don't save spawnedEntityId - entities are recreated on sector enter
            })),
            completedBounties: [...this.completedBounties],
            respawnTimers: Object.fromEntries(this.respawnTimers),
            refreshTimer: this.refreshTimer,
        };
    }

    /**
     * Load bounty state from save data
     */
    loadState(data) {
        if (!data) return;

        // Restore board
        this.board = (data.board || []).map(b => ({
            targetId: b.targetId,
            accepted: b.accepted || false,
        }));

        // Restore active bounties
        this.activeBounties = (data.activeBounties || []).map(b => ({
            targetId: b.targetId,
            acceptedTime: b.acceptedTime || 0,
            lastSeenSector: b.lastSeenSector || 'hub',
            spawnedEntityId: null, // Re-spawned on sector enter
        }));

        // Restore completed set
        this.completedBounties = new Set(data.completedBounties || []);

        // Restore respawn timers
        this.respawnTimers = new Map();
        if (data.respawnTimers) {
            for (const [targetId, killTime] of Object.entries(data.respawnTimers)) {
                this.respawnTimers.set(targetId, Number(killTime));
            }
        }

        // Restore refresh timer
        this.refreshTimer = data.refreshTimer || 0;

        // Fill board if needed
        if (this.board.length < BOUNTY_CONFIG.boardSize) {
            this.refreshBoard();
        }
    }
}
