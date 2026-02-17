// =============================================
// Tactical Pause Manager
// FTL/Baldur's Gate style combat pause with
// battlefield intelligence and fleet commands
// =============================================

import { EQUIPMENT_DATABASE } from '../data/equipmentDatabase.js';
import { CONFIG } from '../config.js';

function getModuleConfig(moduleId) {
    return EQUIPMENT_DATABASE[moduleId] || CONFIG.MODULES[moduleId] || null;
}

export class TacticalPauseManager {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.commandQueue = [];
        this.cooldownTimer = 0;
        this.COOLDOWN = 0.5; // seconds between toggles
        this.HOSTILE_RANGE = 2000;

        // Three.js overlay objects
        this.overlayObjects = [];

        // DOM refs (lazy-init)
        this.overlay = null;
        this.forcePanel = null;
        this.commandWheel = null;
        this.commandWheelTarget = null;

        // Bind methods
        this._onRightClick = this._onRightClick.bind(this);
        this._onWheelClick = this._onWheelClick.bind(this);
        this._onKeyDuringPause = this._onKeyDuringPause.bind(this);
    }

    // ---- Toggle / Activate / Deactivate ----

    toggle() {
        if (this.active) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    activate() {
        if (this.active) return;
        if (this.game.dockedAt) return; // can't pause while docked
        if (this.game.player?.isWarping) return;

        this.active = true;
        this.game.tacticalPaused = true;
        this.game.paused = true;
        this.commandQueue = [];

        // Show overlay
        this._ensureDOM();
        this.overlay.classList.remove('hidden');
        document.getElementById('game-container')?.classList.add('tactical-pause-active');

        // Build force comparison
        this._updateForcePanel();

        // Build battlefield overlays in Three.js scene
        this._createBattlefieldOverlays();

        // Attach listeners
        document.addEventListener('contextmenu', this._onRightClick);
        document.addEventListener('keydown', this._onKeyDuringPause);

        // EventBus
        this.game.events?.emit('tactical:paused');

        // Skippy comment
        this._skippyComment();

        // Audio cue
        this.game.audio?.play('ui-click');
    }

    deactivate() {
        if (!this.active) return;

        this.active = false;
        this.game.tacticalPaused = false;
        this.game.paused = false;
        this.cooldownTimer = this.COOLDOWN;

        // Hide overlay
        if (this.overlay) this.overlay.classList.add('hidden');
        document.getElementById('game-container')?.classList.remove('tactical-pause-active');
        this._hideCommandWheel();
        if (this.forcePanel) this.forcePanel.classList.add('hidden');

        // Remove battlefield overlays
        this._removeBattlefieldOverlays();

        // Execute queued commands
        this._executeCommandQueue();

        // Detach listeners
        document.removeEventListener('contextmenu', this._onRightClick);
        document.removeEventListener('keydown', this._onKeyDuringPause);

        // EventBus
        this.game.events?.emit('tactical:resumed');

        this.game.audio?.play('ui-click');
    }

    /** Called from Game.update - only ticks when NOT paused */
    updateCooldown(dt) {
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
        }
    }

    /** Check if hostiles are nearby */
    hasNearbyHostiles() {
        const player = this.game.player;
        if (!player) return false;
        const entities = this.game.currentSector?.entities || [];
        for (const e of entities) {
            if (!e.alive) continue;
            if (e.type !== 'enemy' && e.type !== 'ship') continue;
            if (e === player) continue;
            if (e.isPlayer) continue;
            // Check if hostile
            if (e.type === 'enemy' || (e.faction && e.faction !== player.faction)) {
                const dx = e.x - player.x;
                const dy = e.y - player.y;
                if (dx * dx + dy * dy < this.HOSTILE_RANGE * this.HOSTILE_RANGE) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Can we toggle right now? */
    canToggle() {
        return this.cooldownTimer <= 0 && !this.game.dockedAt;
    }

    // ---- Force Comparison Panel ----

    _updateForcePanel() {
        if (!this.forcePanel) return;
        this.forcePanel.classList.remove('hidden');

        const player = this.game.player;
        const entities = this.game.currentSector?.entities || [];
        const fleetShips = this.game.fleet?.ships || [];

        let friendlyCount = 1; // player
        let friendlyDPS = this._estimateDPS(player);
        let friendlyEHP = this._estimateEHP(player);
        let enemyCount = 0;
        let enemyDPS = 0;
        let enemyEHP = 0;

        const enemyList = [];
        const friendlyList = [];
        friendlyList.push({ name: player.heroName || 'Commander', ship: player });

        for (const e of entities) {
            if (!e.alive) continue;
            if (e === player) continue;

            if (e.type === 'enemy') {
                enemyCount++;
                enemyDPS += this._estimateDPS(e);
                enemyEHP += this._estimateEHP(e);
                enemyList.push({ name: e.name || e.shipClass || 'Unknown', ship: e });
            }
        }

        for (const s of fleetShips) {
            if (s.alive) {
                friendlyCount++;
                friendlyDPS += this._estimateDPS(s);
                friendlyEHP += this._estimateEHP(s);
                friendlyList.push({ name: s.pilotName || s.shipClass || 'Fleet', ship: s });
            }
        }

        // Threat assessment
        const ratio = enemyCount === 0 ? 10 : (friendlyDPS * friendlyEHP) / Math.max(1, enemyDPS * enemyEHP);
        let threat, threatClass;
        if (ratio > 3) { threat = 'FAVORABLE'; threatClass = 'favorable'; }
        else if (ratio > 1) { threat = 'EVEN'; threatClass = 'even'; }
        else if (ratio > 0.4) { threat = 'DANGEROUS'; threatClass = 'dangerous'; }
        else { threat = 'RETREAT!'; threatClass = 'retreat'; }

        this.forcePanel.innerHTML = `
            <div class="tp-force-header">FORCE ANALYSIS</div>
            <div class="tp-force-section tp-friendly">
                <div class="tp-force-label">FRIENDLY</div>
                <div class="tp-force-stat"><span>${friendlyCount}</span> ships</div>
                <div class="tp-force-stat"><span>${Math.round(friendlyDPS)}</span> DPS</div>
                <div class="tp-force-stat"><span>${this._formatHP(friendlyEHP)}</span> EHP</div>
                <div class="tp-force-ships">${friendlyList.map(f => this._shipCard(f, true)).join('')}</div>
            </div>
            <div class="tp-force-divider"></div>
            <div class="tp-force-section tp-enemy">
                <div class="tp-force-label">HOSTILE</div>
                <div class="tp-force-stat"><span>${enemyCount}</span> ships</div>
                <div class="tp-force-stat"><span>${Math.round(enemyDPS)}</span> DPS</div>
                <div class="tp-force-stat"><span>${this._formatHP(enemyEHP)}</span> EHP</div>
                <div class="tp-force-ships">${enemyList.map(f => this._shipCard(f, false)).join('')}</div>
            </div>
            <div class="tp-threat-assessment ${threatClass}">${threat}</div>
        `;
    }

    _shipCard(info, friendly) {
        const s = info.ship;
        const hpPct = s.maxShield > 0 ? ((s.shield + s.armor + s.hull) / (s.maxShield + s.maxArmor + s.maxHull)) * 100 : 0;
        const color = friendly ? '#4af' : '#f44';
        return `<div class="tp-ship-card">
            <span class="tp-ship-name" style="color:${color}">${info.name}</span>
            <div class="tp-ship-hp-bar">
                <div class="tp-ship-hp-fill" style="width:${hpPct}%;background:${color}"></div>
            </div>
        </div>`;
    }

    _formatHP(val) {
        if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
        return Math.round(val).toString();
    }

    _estimateDPS(ship) {
        if (!ship || !ship.modules) return 0;
        let dps = 0;
        const highSlots = ship.modules.high || [];
        for (const modId of highSlots) {
            if (!modId) continue;
            const cfg = getModuleConfig(modId);
            if (cfg && cfg.damage && cfg.cycleTime) {
                dps += cfg.damage / cfg.cycleTime;
            }
        }
        // Fallback: use ship's base DPS if we can't calc from modules
        if (dps === 0 && ship.dps) dps = ship.dps;
        if (dps === 0 && ship.damage) dps = ship.damage / 2; // rough estimate
        return dps;
    }

    _estimateEHP(ship) {
        if (!ship) return 0;
        return (ship.shield || 0) + (ship.armor || 0) + (ship.hull || 0);
    }

    // ---- Command Wheel ----

    _onRightClick(e) {
        if (!this.active) return;
        e.preventDefault();
        e.stopPropagation();

        // Find entity under cursor
        const target = this._entityAtScreen(e.clientX, e.clientY);

        this._showCommandWheel(e.clientX, e.clientY, target);
    }

    _showCommandWheel(x, y, target) {
        if (!this.commandWheel) return;
        this.commandWheelTarget = target;

        const commands = [
            { id: 'attacking', label: 'ATTACK', icon: '\u2694' },
            { id: 'orbiting', label: 'ORBIT', icon: '\u25CE' },
            { id: 'following', label: 'FOLLOW', icon: '\u27A4' },
            { id: 'holding', label: 'HOLD', icon: '\u2693' },
            { id: 'mining', label: 'MINE', icon: '\u26CF' },
            { id: 'recall', label: 'RECALL', icon: '\u21B6' },
            { id: 'defending', label: 'DEFEND', icon: '\u26E8' },
            { id: 'scatter', label: 'SCATTER', icon: '\u2727' },
        ];

        const radius = 80;
        let html = '';
        commands.forEach((cmd, i) => {
            const angle = (i / commands.length) * Math.PI * 2 - Math.PI / 2;
            const cx = Math.cos(angle) * radius;
            const cy = Math.sin(angle) * radius;
            html += `<div class="tp-wheel-item" data-cmd="${cmd.id}"
                style="transform: translate(${cx}px, ${cy}px)">
                <span class="tp-wheel-icon">${cmd.icon}</span>
                <span class="tp-wheel-label">${cmd.label}</span>
            </div>`;
        });

        // Center dot
        html += `<div class="tp-wheel-center">${target ? target.name || target.shipClass || 'Target' : 'Area'}</div>`;

        this.commandWheel.innerHTML = html;
        this.commandWheel.style.left = x + 'px';
        this.commandWheel.style.top = y + 'px';
        this.commandWheel.classList.remove('hidden');

        // Attach click handlers
        this.commandWheel.querySelectorAll('.tp-wheel-item').forEach(el => {
            el.addEventListener('click', this._onWheelClick);
        });
    }

    _hideCommandWheel() {
        if (this.commandWheel) {
            this.commandWheel.classList.add('hidden');
            this.commandWheel.innerHTML = '';
        }
        this.commandWheelTarget = null;
    }

    _onWheelClick(e) {
        const cmd = e.currentTarget.dataset.cmd;
        if (!cmd) return;

        this.commandQueue.push({
            command: cmd,
            target: this.commandWheelTarget,
        });

        // Visual feedback
        const label = e.currentTarget.querySelector('.tp-wheel-label');
        if (label) label.style.color = '#0ff';

        this.game.ui?.log(`Queued: ${cmd.toUpperCase()}${this.commandWheelTarget ? ' on ' + (this.commandWheelTarget.name || 'target') : ''}`, 'system');
        this.game.audio?.play('ui-click');

        setTimeout(() => this._hideCommandWheel(), 200);
    }

    _executeCommandQueue() {
        const fleet = this.game.fleetSystem;
        if (!fleet) return;

        for (const entry of this.commandQueue) {
            // Validate target still exists
            if (entry.target && !entry.target.alive) continue;

            if (entry.command === 'recall') {
                fleet.commandAll('following', this.game.player);
            } else if (entry.command === 'scatter') {
                // Scatter: each ship picks a random nearby point
                for (const ship of (this.game.fleet?.ships || [])) {
                    if (ship.alive) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = 500 + Math.random() * 500;
                        const fakeTarget = {
                            x: ship.x + Math.cos(angle) * dist,
                            y: ship.y + Math.sin(angle) * dist,
                            alive: true,
                        };
                        ship.setCommand('following', fakeTarget);
                    }
                }
            } else {
                fleet.commandAll(entry.command, entry.target || this.game.player);
            }
        }

        if (this.commandQueue.length > 0) {
            this.game.ui?.log(`Executed ${this.commandQueue.length} fleet command(s)`, 'system');
        }
        this.commandQueue = [];
    }

    // ---- Keyboard during pause ----

    _onKeyDuringPause(e) {
        // Allow Tab for target cycling, Escape to unpause
        if (e.code === 'Escape') {
            e.preventDefault();
            this.deactivate();
        }
    }

    // ---- Entity at screen position (simplified raycast) ----

    _entityAtScreen(screenX, screenY) {
        const renderer = this.game.renderer;
        if (!renderer) return null;

        const camera = renderer.camera;
        if (!camera) return null;

        // Convert screen to world coords
        const rect = renderer.renderer.domElement.getBoundingClientRect();
        const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;

        // For orthographic camera: convert NDC to Three.js world coords
        const threeX = camera.position.x + ndcX * (camera.right - camera.left) / 2;
        const threeY = camera.position.y + ndcY * (camera.top - camera.bottom) / 2;
        // Camera Y is inverted: game Y = -threeY
        const worldX = threeX;
        const worldY = -threeY;

        // Find nearest entity within 50 world units
        let closest = null;
        let closestDist = 2500; // 50^2
        const entities = this.game.currentSector?.entities || [];
        for (const e of entities) {
            if (!e.alive || e === this.game.player) continue;
            const dx = e.x - worldX;
            const dy = e.y - worldY;
            const d2 = dx * dx + dy * dy;
            if (d2 < closestDist) {
                closestDist = d2;
                closest = e;
            }
        }
        return closest;
    }

    // ---- Battlefield Overlays (Three.js) ----

    _createBattlefieldOverlays() {
        this._removeBattlefieldOverlays();

        const scene = this.game.renderer?.scene;
        const uiGroup = this.game.renderer?.uiGroup;
        if (!scene || !uiGroup) return;

        const player = this.game.player;
        const entities = this.game.currentSector?.entities || [];

        for (const e of entities) {
            if (!e.alive || e === player) continue;

            if (e.type === 'enemy') {
                // Threat line: red dashed from hostile to their target
                const target = e.lockedTarget || e.lockedTargets?.[0];
                if (target && target.alive) {
                    this._addThreatLine(uiGroup, e, target);
                }

                // Weapon range circle
                const range = this._getWeaponRange(e);
                if (range > 0) {
                    this._addRangeCircle(uiGroup, e, range);
                }
            }

            // Velocity vector for all ships
            if ((e.type === 'enemy' || e.type === 'ship' || e.isFleet) && (e.vx || e.vy)) {
                this._addVelocityVector(uiGroup, e);
                this._addPredictionDot(uiGroup, e);
            }
        }

        // Player velocity vector
        if (player && (player.vx || player.vy)) {
            this._addVelocityVector(uiGroup, player, 0x00ffff);
            this._addPredictionDot(uiGroup, player, 0x00ffff);
        }

        // Fleet velocity vectors
        for (const s of (this.game.fleet?.ships || [])) {
            if (s.alive && (s.vx || s.vy)) {
                this._addVelocityVector(uiGroup, s, 0x44aaff);
                this._addPredictionDot(uiGroup, s, 0x44aaff);
            }
        }
    }

    _addThreatLine(group, from, to) {
        const points = [
            new THREE.Vector3(from.x, -from.y, 5),
            new THREE.Vector3(to.x, -to.y, 5),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.5,
            dashSize: 20,
            gapSize: 15,
            depthWrite: false,
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        group.add(line);
        this.overlayObjects.push(line);
    }

    _addRangeCircle(group, entity, range) {
        const segments = 64;
        const geometry = new THREE.RingGeometry(range * 0.98, range, segments);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.08,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(entity.x, -entity.y, 2);
        group.add(mesh);
        this.overlayObjects.push(mesh);

        // Outer ring edge
        const edgeGeo = new THREE.RingGeometry(range - 2, range, segments);
        const edgeMat = new THREE.MeshBasicMaterial({
            color: 0xff6644,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.position.set(entity.x, -entity.y, 2.1);
        group.add(edge);
        this.overlayObjects.push(edge);
    }

    _addVelocityVector(group, entity, color = 0xff6644) {
        const speed = Math.sqrt((entity.vx || 0) ** 2 + (entity.vy || 0) ** 2);
        if (speed < 5) return;

        const scale = Math.min(speed * 0.5, 200); // cap visual length
        const endX = entity.x + (entity.vx / speed) * scale;
        const endY = entity.y + (entity.vy / speed) * scale;

        const points = [
            new THREE.Vector3(entity.x, -entity.y, 5),
            new THREE.Vector3(endX, -endY, 5),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
        });
        const line = new THREE.Line(geometry, material);
        group.add(line);
        this.overlayObjects.push(line);
    }

    _addPredictionDot(group, entity, color = 0xff8844) {
        const predTime = 3; // seconds
        const px = entity.x + (entity.vx || 0) * predTime;
        const py = entity.y + (entity.vy || 0) * predTime;

        const geometry = new THREE.CircleGeometry(6, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(px, -py, 5);
        group.add(mesh);
        this.overlayObjects.push(mesh);
    }

    _getWeaponRange(ship) {
        if (!ship.modules) return 0;
        let maxRange = 0;
        const highSlots = ship.modules.high || [];
        for (const modId of highSlots) {
            if (!modId) continue;
            const cfg = getModuleConfig(modId);
            if (cfg && cfg.optimalRange) {
                const total = cfg.optimalRange + (cfg.falloffRange || 0);
                if (total > maxRange) maxRange = total;
            }
        }
        // Fallback for NPC enemies that may not have module arrays
        if (maxRange === 0 && ship.weaponRange) maxRange = ship.weaponRange;
        if (maxRange === 0 && ship.optimalRange) maxRange = ship.optimalRange;
        return maxRange;
    }

    _removeBattlefieldOverlays() {
        const uiGroup = this.game.renderer?.uiGroup;
        for (const obj of this.overlayObjects) {
            if (uiGroup) uiGroup.remove(obj);
            obj.geometry?.dispose();
            obj.material?.dispose();
        }
        this.overlayObjects = [];
    }

    // ---- Skippy tactical commentary ----

    _skippyComment() {
        const skippy = this.game.skippy;
        if (!skippy) return;

        const entities = this.game.currentSector?.entities || [];
        const hostiles = entities.filter(e => e.alive && e.type === 'enemy');
        const friendlies = (this.game.fleet?.ships || []).filter(s => s.alive);

        let msg;
        if (hostiles.length === 0) {
            msg = "Tactical pause... but I don't see any threats. False alarm?";
        } else if (hostiles.length > friendlies.length + 2) {
            msg = `I count ${hostiles.length} hostiles against our ${friendlies.length + 1}. We might want to reconsider this engagement, Captain.`;
        } else if (hostiles.length <= 2) {
            msg = `Only ${hostiles.length} hostile${hostiles.length > 1 ? 's' : ''}. We've got this.`;
        } else {
            msg = `${hostiles.length} contacts. Let's make this count.`;
        }

        skippy.triggerDialogue?.('tactical', msg);
    }

    // ---- DOM setup ----

    _ensureDOM() {
        if (this.overlay) return;

        // Main overlay
        this.overlay = document.getElementById('tactical-pause-overlay');
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'tactical-pause-overlay';
            this.overlay.className = 'hidden';
            this.overlay.innerHTML = `
                <div class="tp-banner">
                    <div class="tp-banner-text">TACTICAL PAUSE</div>
                    <div class="tp-banner-sub">Right-click to issue fleet commands \u2022 Space to resume</div>
                </div>
            `;
            document.getElementById('ui-overlay')?.appendChild(this.overlay);
        }

        // Force panel
        this.forcePanel = document.getElementById('tactical-force-panel');
        if (!this.forcePanel) {
            this.forcePanel = document.createElement('div');
            this.forcePanel.id = 'tactical-force-panel';
            this.forcePanel.className = 'hidden';
            document.getElementById('ui-overlay')?.appendChild(this.forcePanel);
        }

        // Command wheel
        this.commandWheel = document.getElementById('tactical-command-wheel');
        if (!this.commandWheel) {
            this.commandWheel = document.createElement('div');
            this.commandWheel.id = 'tactical-command-wheel';
            this.commandWheel.className = 'hidden';
            document.getElementById('ui-overlay')?.appendChild(this.commandWheel);
        }
    }

    // ---- Cleanup ----

    destroy() {
        this.deactivate();
        this.overlay = null;
        this.forcePanel = null;
        this.commandWheel = null;
    }
}
