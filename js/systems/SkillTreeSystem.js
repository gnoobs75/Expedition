// =============================================
// Skill Tree System - Allocatable Constellation Nodes
// Players spend Skill Points earned from by-use leveling
// Free unlimited respecs
// =============================================

import { SKILL_TREE_NODES, CONSTELLATIONS } from '../data/skillTreeDatabase.js';

const LS_KEY = 'expedition-skill-tree';

export class SkillTreeSystem {
    constructor(game) {
        this.game = game;
        // allocated[nodeId] = number of points allocated (0 to maxPoints)
        this.allocated = this.load();
    }

    /**
     * Check if a node's prerequisites are met
     */
    canAllocate(nodeId) {
        const node = SKILL_TREE_NODES[nodeId];
        if (!node) return false;
        if (node.type === 'start') return false; // starts are always "allocated"

        const current = this.allocated[nodeId] || 0;
        if (current >= node.maxPoints) return false;

        // Check prerequisites: each required node must have at least 1 point (or be a start node)
        for (const reqId of node.requires) {
            const reqNode = SKILL_TREE_NODES[reqId];
            if (!reqNode) return false;
            if (reqNode.type === 'start') continue; // starts are always unlocked
            if ((this.allocated[reqId] || 0) <= 0) return false;
        }

        // Check if player has SP
        const gainSystem = this.game.skillGainSystem;
        if (!gainSystem || gainSystem.skillPoints < 1) return false;

        return true;
    }

    /**
     * Allocate 1 point to a node
     */
    allocate(nodeId) {
        if (!this.canAllocate(nodeId)) return false;

        const gainSystem = this.game.skillGainSystem;
        if (!gainSystem.spendSP(1)) return false;

        this.allocated[nodeId] = (this.allocated[nodeId] || 0) + 1;
        this.save();

        // Reapply bonuses
        gainSystem.applyBonuses();

        const node = SKILL_TREE_NODES[nodeId];
        this.game.events.emit('skill:nodeAllocated', { nodeId, points: this.allocated[nodeId], node });

        return true;
    }

    /**
     * Deallocate 1 point from a node (if no dependent nodes require it)
     */
    deallocate(nodeId) {
        const node = SKILL_TREE_NODES[nodeId];
        if (!node || node.type === 'start') return false;
        const current = this.allocated[nodeId] || 0;
        if (current <= 0) return false;

        // Check if removing this point would break any dependent node's prerequisites
        if (current === 1) {
            // Find all nodes that require this node
            for (const [otherId, otherNode] of Object.entries(SKILL_TREE_NODES)) {
                if (otherNode.requires.includes(nodeId) && (this.allocated[otherId] || 0) > 0) {
                    return false; // can't remove - dependent node has points
                }
            }
        }

        this.allocated[nodeId] = current - 1;
        const gainSystem = this.game.skillGainSystem;
        gainSystem?.refundSP(1);
        this.save();
        gainSystem?.applyBonuses();

        this.game.events.emit('skill:nodeDeallocated', { nodeId, points: this.allocated[nodeId], node });
        return true;
    }

    /**
     * Full respec: refund all allocated points
     */
    respec() {
        let totalRefund = 0;
        for (const [nodeId, points] of Object.entries(this.allocated)) {
            if (points > 0) {
                totalRefund += points;
                this.allocated[nodeId] = 0;
            }
        }

        if (totalRefund > 0) {
            const gainSystem = this.game.skillGainSystem;
            gainSystem?.refundSP(totalRefund);
            this.save();
            gainSystem?.applyBonuses();
            this.game.ui?.showToast(`Respec complete! ${totalRefund} SP refunded`, 'level-up');
            this.game.events.emit('skill:respec', { refunded: totalRefund });
        }
    }

    /**
     * Get total bonuses from all allocated tree nodes
     * Returns { statName: totalBonus }
     */
    getAllocatedBonuses() {
        const bonuses = {};
        for (const [nodeId, points] of Object.entries(this.allocated)) {
            if (points <= 0) continue;
            const node = SKILL_TREE_NODES[nodeId];
            if (!node) continue;
            for (const [stat, perPoint] of Object.entries(node.bonuses)) {
                bonuses[stat] = (bonuses[stat] || 0) + perPoint * points;
            }
        }
        return bonuses;
    }

    /**
     * Get total SP allocated across all nodes
     */
    getTotalAllocated() {
        let total = 0;
        for (const points of Object.values(this.allocated)) {
            total += (points || 0);
        }
        return total;
    }

    /**
     * Get node info for display
     */
    getNodeInfo(nodeId) {
        const node = SKILL_TREE_NODES[nodeId];
        if (!node) return null;
        const points = this.allocated[nodeId] || 0;
        return {
            ...node,
            id: nodeId,
            points,
            canAllocate: this.canAllocate(nodeId),
            canDeallocate: points > 0 && this._canDeallocate(nodeId),
            constellation: CONSTELLATIONS[node.constellation],
        };
    }

    _canDeallocate(nodeId) {
        const current = this.allocated[nodeId] || 0;
        if (current <= 0) return false;
        const node = SKILL_TREE_NODES[nodeId];
        if (!node || node.type === 'start') return false;

        if (current === 1) {
            for (const [otherId, otherNode] of Object.entries(SKILL_TREE_NODES)) {
                if (otherNode.requires.includes(nodeId) && (this.allocated[otherId] || 0) > 0) {
                    return false;
                }
            }
        }
        return true;
    }

    save() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(this.allocated));
        } catch (e) { /* storage full */ }
    }

    load() {
        try {
            const data = localStorage.getItem(LS_KEY);
            if (data) return JSON.parse(data);
        } catch (e) { /* corrupt */ }
        return {};
    }
}
