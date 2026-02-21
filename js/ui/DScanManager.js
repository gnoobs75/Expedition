// =============================================
// D-Scan Manager
// Extracted from UIManager - handles directional scanning
// =============================================

import { formatDistance } from '../utils/math.js';

export class DScanManager {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;

        this.dscanAngle = 60;
        this.dscanRange = 10000;
    }

    /**
     * Toggle D-Scan panel
     */
    toggle() {
        this.ui.elements.dscanPanel.classList.toggle('hidden');
        this.ui.panelDragManager?.savePanelVisibility();
    }

    /**
     * Perform directional scan
     */
    performScan() {
        const range = this.dscanRange;
        const angle = this.dscanAngle;

        const player = this.game.player;
        if (!player) return;

        // Button flash animation
        const scanBtn = document.getElementById('dscan-scan');
        if (scanBtn) {
            scanBtn.classList.remove('scanning');
            void scanBtn.offsetWidth; // Force reflow
            scanBtn.classList.add('scanning');
        }

        // Play scan sound
        this.game.audio?.play('scan');

        // Get all entities in range
        const entities = this.game.currentSector.getEntitiesInRadius(player.x, player.y, range);

        // Filter by directional cone angle
        const halfAngle = (angle / 2) * (Math.PI / 180);
        const playerHeading = player.rotation;

        const results = entities.filter(e => {
            if (e === player) return false;
            if (!e.alive) return false;

            // 360 degree scan includes everything
            if (angle >= 360) return true;

            // Calculate angle from player to entity
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            const angleToEntity = Math.atan2(dy, dx);

            // Angular difference (shortest path)
            let diff = angleToEntity - playerHeading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            return Math.abs(diff) <= halfAngle;
        });

        // Sort by distance
        results.sort((a, b) => player.distanceTo(a) - player.distanceTo(b));

        // Count by type
        const counts = {};
        for (const e of results) {
            const t = e.type === 'npc' ? 'ship' : e.type;
            counts[t] = (counts[t] || 0) + 1;
        }

        // Update summary
        const summaryEl = document.getElementById('dscan-summary');
        if (summaryEl) {
            const parts = Object.entries(counts).map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`);
            summaryEl.textContent = results.length > 0
                ? `${results.length} results: ${parts.join(', ')}`
                : 'No objects detected';
        }

        // Build results table
        const html = results.map(e => {
            const dist = formatDistance(player.distanceTo(e));
            const icon = this.ui.getEntityIcon(e);
            const type = e.type === 'npc' ? e.role : e.type;
            const hostClass = e.hostility === 'hostile' ? 'dscan-hostile' :
                e.hostility === 'friendly' ? 'dscan-friendly' : '';

            return `<tr class="${hostClass}" data-entity-id="${e.id}">
                <td class="dscan-icon">${icon}</td>
                <td class="dscan-name">${e.name}</td>
                <td class="dscan-type">${type}</td>
                <td class="dscan-dist">${dist}</td>
            </tr>`;
        }).join('');

        const resultsEl = document.getElementById('dscan-results');
        if (resultsEl) {
            if (html) {
                resultsEl.innerHTML = html;
            } else {
                resultsEl.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">\u{1F4E1}</div><div class="empty-state-title">No Objects Detected</div><div class="empty-state-hint">Try a wider scan angle or range</div></div></td></tr>';
            }
        }

        // Make rows clickable to select entities
        resultsEl?.querySelectorAll('tr[data-entity-id]').forEach(row => {
            row.addEventListener('click', () => {
                const entity = this.ui.findEntityById(row.dataset.entityId);
                if (entity) this.game.selectTarget(entity);
            });
        });

        // Trigger minimap scan pulse
        if (this.ui.minimapRenderer) {
            this.ui.minimapRenderer.scanPulse = {
                startTime: performance.now(),
                duration: 1500,
                range: range,
                entityPositions: results.map(e => ({
                    dx: e.x - player.x,
                    dy: e.y - player.y,
                    type: e.type,
                    hostile: e.hostility === 'hostile' || e.type === 'enemy',
                })),
                counts,
            };
        }

        // Spawn visual cone effect
        this.spawnCone(range, angle, player);

        // Expanding scan probe rings in 3D
        const effects = this.game.renderer?.effects;
        if (effects) {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    effects.spawn('explosion', player.x, player.y, {
                        count: 16,
                        color: 0x00ddff,
                        speed: 200 + i * 100,
                        size: 2,
                        life: 0.6,
                    });
                }, i * 150);
            }
        }
    }

    /**
     * Spawn a visual D-Scan cone in the game world
     */
    spawnCone(range, angleDeg, player) {
        if (!this.game.renderer?.effects) return;

        // Use the effects system to create a temporary cone
        const effects = this.game.renderer.effects;
        const heading = player.rotation;
        const halfAngle = (angleDeg / 2) * (Math.PI / 180);

        if (angleDeg >= 360) {
            // Full circle scan ring
            const ringGeo = new THREE.RingGeometry(range * 0.98, range, 64);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.15,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(player.x, player.y, 2);
            effects.group.add(ring);

            // Fade out over 1.5s
            const startTime = performance.now();
            const cleanup = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > 1.5) {
                    effects.group.remove(ring);
                    ring.geometry.dispose();
                    ring.material.dispose();
                    return;
                }
                ring.material.opacity = 0.15 * (1 - elapsed / 1.5);
                ring.position.set(player.x, player.y, 2);
                requestAnimationFrame(cleanup);
            };
            requestAnimationFrame(cleanup);
        } else {
            // Directional cone
            const segments = 32;
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);

            for (let i = 0; i <= segments; i++) {
                const a = heading - halfAngle + (halfAngle * 2 * i / segments);
                shape.lineTo(Math.cos(a) * range, Math.sin(a) * range);
            }
            shape.lineTo(0, 0);

            const coneGeo = new THREE.ShapeGeometry(shape);
            const coneMat = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.set(player.x, player.y, 2);

            // Cone edge lines
            const edgePoints = [
                new THREE.Vector3(0, 0, 2),
                new THREE.Vector3(Math.cos(heading - halfAngle) * range, Math.sin(heading - halfAngle) * range, 2),
            ];
            const edgePoints2 = [
                new THREE.Vector3(0, 0, 2),
                new THREE.Vector3(Math.cos(heading + halfAngle) * range, Math.sin(heading + halfAngle) * range, 2),
            ];
            const edgeMat = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.25,
                depthWrite: false,
            });
            const edge1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePoints), edgeMat);
            const edge2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePoints2), edgeMat.clone());
            edge1.position.set(player.x, player.y, 0);
            edge2.position.set(player.x, player.y, 0);

            effects.group.add(cone);
            effects.group.add(edge1);
            effects.group.add(edge2);

            // Fade out
            const startTime = performance.now();
            const cleanup = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > 1.5) {
                    effects.group.remove(cone);
                    effects.group.remove(edge1);
                    effects.group.remove(edge2);
                    cone.geometry.dispose();
                    cone.material.dispose();
                    edge1.geometry.dispose();
                    edge1.material.dispose();
                    edge2.geometry.dispose();
                    edge2.material.dispose();
                    return;
                }
                const fade = 1 - elapsed / 1.5;
                cone.material.opacity = 0.08 * fade;
                edge1.material.opacity = 0.25 * fade;
                edge2.material.opacity = 0.25 * fade;
                requestAnimationFrame(cleanup);
            };
            requestAnimationFrame(cleanup);
        }
    }
}
