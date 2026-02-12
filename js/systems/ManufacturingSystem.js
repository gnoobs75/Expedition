// =============================================
// Manufacturing System
// Manages blueprint ownership, crafting jobs,
// and material consumption for item production
// =============================================

import { BLUEPRINT_DATABASE, MATERIAL_DATABASE } from '../data/blueprintDatabase.js';
import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';
import { SHIP_DATABASE } from '../data/shipDatabase.js';

export class ManufacturingSystem {
    constructor(game) {
        this.game = game;

        // Owned blueprints: Set of blueprintIds
        this.ownedBlueprints = new Set();

        // Active crafting jobs: [{id, blueprintId, startTime, craftTime, progress, completed}]
        this.activeJobs = [];

        // Job counter
        this.nextJobId = 1;

        // Max concurrent jobs
        this.maxJobs = 3;
    }

    // =============================================
    // UPDATE
    // =============================================

    /**
     * Tick all active jobs, complete when ready
     */
    update(dt) {
        for (const job of this.activeJobs) {
            if (job.completed) continue;

            job.progress += dt;

            if (job.progress >= job.craftTime) {
                job.progress = job.craftTime;
                job.completed = true;
                this.completeJob(job.id);
            }
        }
    }

    // =============================================
    // BLUEPRINT OWNERSHIP
    // =============================================

    /**
     * Check if player owns a blueprint
     */
    ownsBlueprint(bpId) {
        return this.ownedBlueprints.has(bpId);
    }

    /**
     * Purchase a blueprint at station (deducts credits)
     */
    purchaseBlueprint(bpId) {
        const bp = BLUEPRINT_DATABASE[bpId];
        if (!bp) return false;

        if (this.ownedBlueprints.has(bpId)) {
            this.game.ui?.showToast('Blueprint already owned', 'warning');
            return false;
        }

        if (this.game.credits < bp.price) {
            this.game.ui?.showToast('Insufficient credits for blueprint', 'warning');
            return false;
        }

        this.game.credits -= bp.price;
        this.ownedBlueprints.add(bpId);

        this.game.events.emit('blueprint:purchased', { blueprintId: bpId, blueprint: bp });
        this.game.ui?.showToast(`Blueprint acquired: ${bp.name}`, 'success');
        this.game.ui?.log(`Purchased blueprint: ${bp.name}`, 'system');
        this.game.audio?.play('quest-complete');

        return true;
    }

    /**
     * Add blueprint directly (quest/loot reward)
     */
    addBlueprint(bpId) {
        const bp = BLUEPRINT_DATABASE[bpId];
        if (!bp) return false;

        if (this.ownedBlueprints.has(bpId)) {
            // Already owned - could grant a small credit refund
            return false;
        }

        this.ownedBlueprints.add(bpId);
        this.game.events.emit('blueprint:acquired', { blueprintId: bpId, blueprint: bp });
        this.game.ui?.showToast(`Blueprint found: ${bp.name}`, 'success');
        this.game.ui?.log(`Acquired blueprint: ${bp.name}`, 'system');

        return true;
    }

    // =============================================
    // MATERIAL CHECKING
    // =============================================

    /**
     * Check if player has required materials in cargo
     * Materials come from:
     *   - player.materials map (crafting materials like refined-minerals, salvage-components)
     *   - player.cargo (ores, if a blueprint requires raw ore)
     *   - player.tradeGoods (electronics, rare-alloys, etc.)
     * Returns {canCraft: bool, missing: {materialId: amount}}
     */
    hasMaterials(bpId) {
        const bp = BLUEPRINT_DATABASE[bpId];
        if (!bp || !bp.materials) return { canCraft: false, missing: {} };

        const player = this.game.player;
        if (!player) return { canCraft: false, missing: {} };

        const missing = {};
        let canCraft = true;

        for (const [materialId, requiredAmount] of Object.entries(bp.materials)) {
            const available = this._getPlayerMaterialCount(player, materialId);
            if (available < requiredAmount) {
                missing[materialId] = requiredAmount - available;
                canCraft = false;
            }
        }

        return { canCraft, missing };
    }

    /**
     * Get the amount of a specific material the player has across all storage
     */
    _getPlayerMaterialCount(player, materialId) {
        let count = 0;

        // Check player.materials map (primary source for crafting materials)
        if (player.materials && player.materials[materialId] !== undefined) {
            count += player.materials[materialId];
        }

        // Check player.cargo (raw ores)
        if (player.cargo && player.cargo[materialId] !== undefined) {
            count += player.cargo[materialId];
        }

        // Check player.tradeGoods (trade goods like electronics, rare-alloys)
        if (player.tradeGoods && player.tradeGoods[materialId] !== undefined) {
            count += player.tradeGoods[materialId];
        }

        return count;
    }

    // =============================================
    // CRAFTING JOBS
    // =============================================

    /**
     * Start a crafting job (must be docked at station)
     * Validates: owns BP, has materials, not at max jobs, is docked
     * Consumes materials from player cargo
     * Returns job object or null
     */
    startJob(bpId) {
        const bp = BLUEPRINT_DATABASE[bpId];
        if (!bp) {
            this.game.ui?.showToast('Invalid blueprint', 'error');
            return null;
        }

        // Must own the blueprint
        if (!this.ownedBlueprints.has(bpId)) {
            this.game.ui?.showToast('Blueprint not owned', 'warning');
            return null;
        }

        // Must be docked
        if (!this.game.dockedAt) {
            this.game.ui?.showToast('Must be docked at a station to manufacture', 'warning');
            return null;
        }

        // Check job limit
        const activeCount = this.activeJobs.filter(j => !j.completed).length;
        if (activeCount >= this.maxJobs) {
            this.game.ui?.showToast(`Maximum ${this.maxJobs} concurrent jobs`, 'warning');
            return null;
        }

        // Check materials
        const { canCraft, missing } = this.hasMaterials(bpId);
        if (!canCraft) {
            const missingNames = Object.entries(missing).map(([id, amt]) => {
                const mat = MATERIAL_DATABASE[id];
                return `${mat ? mat.name : id} x${amt}`;
            });
            this.game.ui?.showToast(`Missing materials: ${missingNames.join(', ')}`, 'warning');
            return null;
        }

        // Consume materials
        this._consumeMaterials(bp.materials);

        // Create job
        const job = {
            id: this.nextJobId++,
            blueprintId: bpId,
            startTime: Date.now(),
            craftTime: bp.craftTime || 60,
            progress: 0,
            completed: false,
        };

        this.activeJobs.push(job);

        this.game.events.emit('manufacturing:job-started', { job, blueprint: bp });
        this.game.ui?.showToast(`Manufacturing started: ${bp.name}`, 'info');
        this.game.ui?.log(`Started manufacturing: ${bp.name} (${bp.craftTime}s)`, 'system');
        this.game.audio?.play('loot');

        return job;
    }

    /**
     * Consume materials from player inventory
     */
    _consumeMaterials(materials) {
        const player = this.game.player;
        if (!player) return;

        for (const [materialId, requiredAmount] of Object.entries(materials)) {
            let remaining = requiredAmount;

            // Consume from player.materials first
            if (player.materials && player.materials[materialId] !== undefined) {
                const take = Math.min(player.materials[materialId], remaining);
                player.materials[materialId] -= take;
                remaining -= take;
                if (player.materials[materialId] <= 0) {
                    delete player.materials[materialId];
                }
            }

            // Then from player.cargo
            if (remaining > 0 && player.cargo && player.cargo[materialId] !== undefined) {
                const take = Math.min(player.cargo[materialId], remaining);
                player.cargo[materialId] -= take;
                remaining -= take;
                if (player.cargo[materialId] <= 0) {
                    delete player.cargo[materialId];
                }
            }

            // Then from player.tradeGoods
            if (remaining > 0 && player.tradeGoods && player.tradeGoods[materialId] !== undefined) {
                const take = Math.min(player.tradeGoods[materialId], remaining);
                player.tradeGoods[materialId] -= take;
                remaining -= take;
                if (player.tradeGoods[materialId] <= 0) {
                    delete player.tradeGoods[materialId];
                }
            }
        }
    }

    /**
     * Complete a job - add output to player inventory
     */
    completeJob(jobId) {
        const job = this.activeJobs.find(j => j.id === jobId);
        if (!job) return;

        const bp = BLUEPRINT_DATABASE[job.blueprintId];
        if (!bp) return;

        // Already delivered
        if (job.delivered) return;
        job.delivered = true;

        if (bp.outputType === 'module') {
            // Add module to player's moduleInventory
            const player = this.game.player;
            if (player) {
                if (!player.moduleInventory) {
                    player.moduleInventory = [];
                }
                const config = EQUIPMENT_DATABASE[bp.outputId];
                if (config) {
                    player.moduleInventory.push({ id: bp.outputId, config });
                    this.game.ui?.showToast(`Manufactured: ${config.name}`, 'success');
                    this.game.ui?.log(`Manufacturing complete: ${config.name}`, 'system');
                } else {
                    // Fallback: just push the ID
                    player.moduleInventory.push({ id: bp.outputId });
                    this.game.ui?.showToast(`Manufactured: ${bp.name}`, 'success');
                    this.game.ui?.log(`Manufacturing complete: ${bp.name}`, 'system');
                }
            }
        } else if (bp.outputType === 'ship') {
            // Ship manufacturing - player claims at station vendor
            this.game.ui?.showToast('Ship blueprint manufactured - visit station vendor to claim', 'success');
            this.game.ui?.log(`Ship manufactured: ${bp.name} - claim at station vendor`, 'system');

            // Store the manufactured ship for claiming
            if (!this.game._manufacturedShips) {
                this.game._manufacturedShips = [];
            }
            this.game._manufacturedShips.push(bp.outputId);
        }

        this.game.events.emit('manufacturing:job-completed', { job, blueprint: bp });
        this.game.audio?.play('quest-complete');

        // Remove completed job from active list after a short display period
        setTimeout(() => {
            const idx = this.activeJobs.indexOf(job);
            if (idx !== -1) {
                this.activeJobs.splice(idx, 1);
            }
        }, 5000);
    }

    /**
     * Cancel a job (refund 50% materials)
     */
    cancelJob(jobId) {
        const jobIndex = this.activeJobs.findIndex(j => j.id === jobId);
        if (jobIndex === -1) return false;

        const job = this.activeJobs[jobIndex];
        if (job.completed || job.delivered) {
            this.game.ui?.showToast('Cannot cancel a completed job', 'warning');
            return false;
        }

        const bp = BLUEPRINT_DATABASE[job.blueprintId];
        if (bp && bp.materials) {
            // Refund 50% of materials
            const player = this.game.player;
            if (player) {
                if (!player.materials) {
                    player.materials = {};
                }
                for (const [materialId, amount] of Object.entries(bp.materials)) {
                    const refund = Math.floor(amount * 0.5);
                    if (refund > 0) {
                        player.materials[materialId] = (player.materials[materialId] || 0) + refund;
                    }
                }
            }
        }

        this.activeJobs.splice(jobIndex, 1);

        this.game.events.emit('manufacturing:job-cancelled', { job, blueprint: bp });
        this.game.ui?.showToast(`Job cancelled. 50% materials refunded.`, 'info');
        this.game.ui?.log(`Manufacturing cancelled: ${bp ? bp.name : 'Unknown'}`, 'system');

        return true;
    }

    // =============================================
    // STATION BLUEPRINTS
    // =============================================

    /**
     * Get available blueprints at current station (for purchase)
     * Returns BPs with source='station', filtered by tier based on sector difficulty
     */
    getStationBlueprints() {
        const sector = this.game.currentSector;
        if (!sector) return [];

        const difficulty = sector.difficulty || 'normal';

        // Map difficulty to max tier available
        const tierMap = {
            hub: 1,
            safe: 1,
            normal: 2,
            dangerous: 3,
            deadly: 4,
        };
        const maxTier = tierMap[difficulty] || 2;

        const available = [];
        for (const [bpId, bp] of Object.entries(BLUEPRINT_DATABASE)) {
            // Only show blueprints purchasable at stations
            if (bp.source !== 'station') continue;

            // Filter by tier
            const bpTier = bp.tier || 1;
            if (bpTier > maxTier) continue;

            available.push({
                id: bpId,
                ...bp,
                owned: this.ownedBlueprints.has(bpId),
            });
        }

        // Sort by tier, then price
        available.sort((a, b) => {
            if (a.tier !== b.tier) return (a.tier || 1) - (b.tier || 1);
            return (a.price || 0) - (b.price || 0);
        });

        return available;
    }

    // =============================================
    // JOB QUERIES
    // =============================================

    /**
     * Get all active (in-progress) jobs
     */
    getActiveJobs() {
        return this.activeJobs.filter(j => !j.completed);
    }

    /**
     * Get all completed jobs waiting to be cleared
     */
    getCompletedJobs() {
        return this.activeJobs.filter(j => j.completed);
    }

    /**
     * Get a specific job by ID
     */
    getJob(jobId) {
        return this.activeJobs.find(j => j.id === jobId) || null;
    }

    /**
     * Get job progress as a 0-1 fraction
     */
    getJobProgress(jobId) {
        const job = this.activeJobs.find(j => j.id === jobId);
        if (!job) return 0;
        return Math.min(1, job.progress / job.craftTime);
    }

    /**
     * Get all owned blueprint IDs
     */
    getOwnedBlueprints() {
        return [...this.ownedBlueprints].map(bpId => {
            const bp = BLUEPRINT_DATABASE[bpId];
            return bp ? { id: bpId, ...bp } : null;
        }).filter(Boolean);
    }

    // =============================================
    // SAVE / LOAD
    // =============================================

    /**
     * Save manufacturing state
     */
    saveState() {
        return {
            ownedBlueprints: [...this.ownedBlueprints],
            activeJobs: this.activeJobs.map(j => ({
                id: j.id,
                blueprintId: j.blueprintId,
                startTime: j.startTime,
                craftTime: j.craftTime,
                progress: j.progress,
                completed: j.completed,
                delivered: j.delivered || false,
            })),
            nextJobId: this.nextJobId,
        };
    }

    /**
     * Load manufacturing state from saved data
     */
    loadState(data) {
        if (!data) return;

        if (data.ownedBlueprints) {
            this.ownedBlueprints = new Set(data.ownedBlueprints);
        }

        if (data.activeJobs) {
            this.activeJobs = data.activeJobs.map(j => ({
                id: j.id,
                blueprintId: j.blueprintId,
                startTime: j.startTime,
                craftTime: j.craftTime,
                progress: j.progress,
                completed: j.completed || false,
                delivered: j.delivered || false,
            }));
        }

        if (data.nextJobId !== undefined) {
            this.nextJobId = data.nextJobId;
        }
    }
}
