// =============================================
// Splash / Title Screen
// Three.js combat background + Skippy + menu
// =============================================

import { SkippyAvatar } from './SkippyAvatar.js';
import { SaveManager } from '../core/SaveManager.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';

export class SplashScreen {
    constructor() {
        this.container = document.getElementById('splash-screen');
        this.canvas = document.getElementById('splash-bg-canvas');
        this.menuEl = document.getElementById('splash-menu');
        this.subScreen = document.getElementById('splash-sub-screen');
        this.speechEl = document.getElementById('splash-skippy-speech');

        // Three.js background scene
        this.bgScene = null;
        this.bgCamera = null;
        this.bgRenderer = null;
        this.bgShips = [];
        this.bgLasers = [];
        this.bgParticles = [];
        this.bgAnimId = null;
        this.bgTime = 0;

        // Skippy
        this.avatar = null;
        this.synth = window.speechSynthesis || null;

        // Save manager (standalone, no game ref needed for listing)
        this.saveManager = new SaveManager(null);

        // Resolve callback
        this._resolve = null;
    }

    /**
     * Show the splash screen. Returns a promise that resolves when the user picks an action.
     * @returns {Promise<{action: string, slotData?: object, tutorial?: boolean}>}
     */
    show() {
        this.container.style.display = '';
        this.container.classList.remove('fade-out');

        this.initBackground();
        this.initSkippy();
        this.initMenu();

        return new Promise((resolve) => {
            this._resolve = resolve;
        });
    }

    /**
     * Hide splash with fade-out transition
     */
    hide() {
        return new Promise((resolve) => {
            this.container.classList.add('fade-out');
            setTimeout(() => {
                this.destroy();
                resolve();
            }, 700);
        });
    }

    // ==========================================
    // Background Scene
    // ==========================================

    initBackground() {
        if (typeof THREE === 'undefined') return;

        const w = window.innerWidth;
        const h = window.innerHeight;

        this.bgScene = new THREE.Scene();
        this.bgScene.background = new THREE.Color(0x000510);

        // Orthographic camera (same style as game)
        const aspect = w / h;
        const viewSize = 600;
        this.bgCamera = new THREE.OrthographicCamera(
            -viewSize * aspect / 2, viewSize * aspect / 2,
            viewSize / 2, -viewSize / 2,
            -500, 500
        );
        this.bgCamera.position.set(0, 0, 100);

        this.bgRenderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.bgRenderer.setSize(w, h);
        this.bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Lights
        const ambient = new THREE.AmbientLight(0x334466, 0.6);
        this.bgScene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0x6688cc, 1.0);
        dirLight.position.set(100, -50, 200);
        this.bgScene.add(dirLight);

        const pointLight = new THREE.PointLight(0x00ffff, 0.5, 800);
        pointLight.position.set(0, 0, 50);
        this.bgScene.add(pointLight);

        // Nebula background plane
        this.createNebula();

        // Stars
        this.createStars();

        // Spawn demo ships
        this.createDemoShips();

        // Start animation loop
        this.animateBackground();
    }

    createNebula() {
        const geo = new THREE.PlaneGeometry(2000, 2000);
        const mat = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform float uTime;
                // Simple pseudo-noise
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                float noise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));
                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }
                void main() {
                    vec2 uv = vUv * 3.0 + uTime * 0.02;
                    float n = noise(uv) * 0.5 + noise(uv * 2.0) * 0.3 + noise(uv * 4.0) * 0.2;
                    vec3 col1 = vec3(0.0, 0.05, 0.15);
                    vec3 col2 = vec3(0.02, 0.0, 0.1);
                    vec3 color = mix(col1, col2, n);
                    gl_FragColor = vec4(color, 0.8);
                }
            `,
        });
        const plane = new THREE.Mesh(geo, mat);
        plane.position.z = -200;
        this.bgScene.add(plane);
        this._nebulaMat = mat;
    }

    createStars() {
        const count = 200;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 1600;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 1200;
            positions[i * 3 + 2] = -100 + Math.random() * 50;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.6 });
        this.bgScene.add(new THREE.Points(geo, mat));
    }

    createDemoShips() {
        const roles = ['military', 'pirate', 'mercenary', 'police', 'mining', 'hauler'];
        const colors = [0x00ccff, 0xff4444, 0xffaa00, 0x44ff44, 0x8888ff, 0xaaaaff];

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const radius = 120 + Math.random() * 80;
            const speed = 0.15 + Math.random() * 0.15;
            const size = 12 + Math.random() * 10;

            // Simple ship mesh (box + triangle bow)
            const group = new THREE.Group();

            // Hull
            const hullGeo = new THREE.BoxGeometry(size, size * 0.6, 4);
            const hullMat = new THREE.MeshStandardMaterial({
                color: colors[i],
                metalness: 0.7,
                roughness: 0.3,
                emissive: colors[i],
                emissiveIntensity: 0.15,
            });
            const hull = new THREE.Mesh(hullGeo, hullMat);
            group.add(hull);

            // Bow (triangle)
            const bowShape = new THREE.Shape();
            bowShape.moveTo(0, size * 0.35);
            bowShape.lineTo(size * 0.5, 0);
            bowShape.lineTo(0, -size * 0.35);
            bowShape.lineTo(0, size * 0.35);
            const bowGeo = new THREE.ExtrudeGeometry(bowShape, { depth: 3, bevelEnabled: false });
            const bow = new THREE.Mesh(bowGeo, hullMat);
            bow.position.x = size * 0.5;
            bow.position.z = -1.5;
            group.add(bow);

            // Engine glow
            const engineGeo = new THREE.SphereGeometry(size * 0.15, 8, 8);
            const engineMat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.8 });
            const engine = new THREE.Mesh(engineGeo, engineMat);
            engine.position.x = -size * 0.5;
            group.add(engine);

            group.position.x = Math.cos(angle) * radius;
            group.position.y = Math.sin(angle) * radius;

            this.bgScene.add(group);
            this.bgShips.push({
                mesh: group,
                angle,
                radius,
                speed,
                orbitDir: i < 3 ? 1 : -1,
                team: i < 3 ? 'a' : 'b',
                fireTimer: Math.random() * 3,
                fireCooldown: 1.5 + Math.random() * 2,
                engine,
            });
        }
    }

    createLaser(from, to, color) {
        const points = [
            new THREE.Vector3(from.x, from.y, 10),
            new THREE.Vector3(to.x, to.y, 10),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            linewidth: 1,
        });
        const line = new THREE.Line(geo, mat);
        this.bgScene.add(line);

        // Glow line (wider, dimmer)
        const glowMat = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.3,
            linewidth: 1,
        });
        const glowLine = new THREE.Line(geo.clone(), glowMat);
        this.bgScene.add(glowLine);

        this.bgLasers.push({ line, glowLine, life: 0.3 });
    }

    animateBackground() {
        if (!this.bgRenderer) return;

        const dt = 0.016;
        this.bgTime += dt;

        // Update nebula
        if (this._nebulaMat) {
            this._nebulaMat.uniforms.uTime.value = this.bgTime;
        }

        // Update ships
        for (const ship of this.bgShips) {
            ship.angle += ship.speed * ship.orbitDir * dt;
            ship.mesh.position.x = Math.cos(ship.angle) * ship.radius;
            ship.mesh.position.y = Math.sin(ship.angle) * ship.radius;

            // Face direction of travel
            const faceAngle = ship.angle + (ship.orbitDir > 0 ? Math.PI / 2 : -Math.PI / 2);
            ship.mesh.rotation.z = faceAngle;

            // Engine pulse
            if (ship.engine) {
                ship.engine.material.opacity = 0.5 + Math.sin(this.bgTime * 4 + ship.angle) * 0.3;
            }

            // Fire at opposing team ships
            ship.fireTimer -= dt;
            if (ship.fireTimer <= 0) {
                ship.fireTimer = ship.fireCooldown;
                // Find closest enemy
                let closest = null;
                let closestDist = Infinity;
                for (const other of this.bgShips) {
                    if (other.team === ship.team) continue;
                    const dx = other.mesh.position.x - ship.mesh.position.x;
                    const dy = other.mesh.position.y - ship.mesh.position.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < closestDist) {
                        closestDist = d;
                        closest = other;
                    }
                }
                if (closest && closestDist < 400) {
                    const color = ship.team === 'a' ? 0x00ffff : 0xff4444;
                    this.createLaser(ship.mesh.position, closest.mesh.position, color);
                }
            }
        }

        // Update lasers
        for (let i = this.bgLasers.length - 1; i >= 0; i--) {
            const laser = this.bgLasers[i];
            laser.life -= dt;
            const alpha = Math.max(0, laser.life / 0.3);
            laser.line.material.opacity = alpha * 0.9;
            laser.glowLine.material.opacity = alpha * 0.3;
            if (laser.life <= 0) {
                this.bgScene.remove(laser.line);
                this.bgScene.remove(laser.glowLine);
                laser.line.geometry.dispose();
                laser.glowLine.geometry.dispose();
                laser.line.material.dispose();
                laser.glowLine.material.dispose();
                this.bgLasers.splice(i, 1);
            }
        }

        // Slow camera drift
        if (this.bgCamera) {
            this.bgCamera.position.x = Math.sin(this.bgTime * 0.05) * 20;
            this.bgCamera.position.y = Math.cos(this.bgTime * 0.03) * 15;
        }

        this.bgRenderer.render(this.bgScene, this.bgCamera);
        this.bgAnimId = requestAnimationFrame(() => this.animateBackground());
    }

    // ==========================================
    // Skippy Avatar
    // ==========================================

    initSkippy() {
        const container = document.getElementById('splash-skippy-container');
        if (!container) return;

        try {
            this.avatar = new SkippyAvatar(container);
            this.avatar.init();
            this.avatar.setExpression('smug');

            // Speak welcome line
            setTimeout(() => this.skippySpeak(this.getWelcomeLine()), 800);
        } catch (e) {
            console.warn('Skippy avatar init failed:', e);
        }
    }

    getWelcomeLine() {
        const lines = [
            "Welcome back, Commander!",
            "Ready for another expedition?",
            "Ah, you've returned. The universe trembles.",
            "Systems online. What are we blowing up today?",
            "I hope you brought snacks. Space is boring without them.",
            "Engines warming up. Where to, boss?",
        ];
        return lines[Math.floor(Math.random() * lines.length)];
    }

    skippySpeak(text) {
        if (this.speechEl) {
            this.speechEl.textContent = text;
        }
        if (this.avatar) {
            this.avatar.setExpression('talking');
            setTimeout(() => this.avatar?.setExpression('smug'), 3000);
        }

        // TTS
        if (this.synth && this.synth.getVoices) {
            try {
                const utter = new SpeechSynthesisUtterance(text);
                utter.rate = 1.1;
                utter.pitch = 0.9;
                // Try to pick a male voice
                const voices = this.synth.getVoices();
                const preferred = voices.find(v => /david|daniel|james|mark/i.test(v.name));
                if (preferred) utter.voice = preferred;
                this.synth.speak(utter);
            } catch {
                // TTS not available
            }
        }
    }

    // ==========================================
    // Menu
    // ==========================================

    initMenu() {
        const buttons = [
            { label: 'NEW EXPEDITION', action: 'new' },
            { label: 'LOAD EXPEDITION', action: 'load' },
            { label: 'OPTIONS', action: 'options' },
            { label: 'KEY MAP', action: 'keys' },
            { label: 'TUTORIAL', action: 'tutorial' },
        ];

        this.menuEl.innerHTML = '';
        for (const btn of buttons) {
            const el = document.createElement('button');
            el.className = 'splash-btn';
            el.textContent = btn.label;
            el.dataset.action = btn.action;
            el.addEventListener('click', () => this.handleMenuAction(btn.action));
            this.menuEl.appendChild(el);
        }
    }

    handleMenuAction(action) {
        switch (action) {
            case 'new':
                this.showFactionNaming(false);
                break;
            case 'load':
                this.showLoadScreen();
                break;
            case 'options':
                this.showOptionsScreen();
                break;
            case 'keys':
                this.showKeyMapScreen();
                break;
            case 'tutorial':
                this.showFactionNaming(true);
                break;
        }
    }

    // ==========================================
    // Faction Naming Screen
    // ==========================================

    showFactionNaming(tutorial = false) {
        this.subScreen.classList.remove('hidden');

        const factionColors = [
            { name: 'Cyan', hex: '#00ccff' },
            { name: 'Gold', hex: '#ffaa00' },
            { name: 'Green', hex: '#44ff88' },
            { name: 'Red', hex: '#ff4466' },
            { name: 'Purple', hex: '#aa66ff' },
        ];

        const colorSwatches = factionColors.map((c, i) =>
            `<button class="faction-color-swatch ${i === 0 ? 'selected' : ''}" data-color="${c.hex}" style="background:${c.hex}" title="${c.name}"></button>`
        ).join('');

        this.subScreen.innerHTML = `<div class="splash-sub-panel faction-naming-panel">
            <div class="splash-sub-header">
                <h2>ESTABLISH YOUR FACTION</h2>
                <button class="splash-back-btn" id="faction-back">BACK</button>
            </div>
            <div class="faction-naming-body">
                <div class="faction-skippy-line">Every empire starts with a name. Choose wisely, Commander.</div>
                <div class="faction-input-row">
                    <label class="faction-label">FACTION NAME</label>
                    <input type="text" id="faction-name-input" class="faction-name-input" placeholder="Enter faction name..." maxlength="24" autocomplete="off" spellcheck="false">
                </div>
                <div class="faction-input-row">
                    <label class="faction-label">FACTION COLOR</label>
                    <div class="faction-color-picker">${colorSwatches}</div>
                </div>
                <div class="faction-preview">
                    <div class="faction-preview-banner" id="faction-preview-banner">
                        <span class="faction-preview-star">&#9733;</span>
                        <span id="faction-preview-name">YOUR FACTION</span>
                    </div>
                </div>
                <button class="splash-btn faction-launch-btn" id="faction-launch-btn">LAUNCH EXPEDITION</button>
            </div>
        </div>`;

        const nameInput = this.subScreen.querySelector('#faction-name-input');
        const previewName = this.subScreen.querySelector('#faction-preview-name');
        const previewBanner = this.subScreen.querySelector('#faction-preview-banner');
        let selectedColor = factionColors[0].hex;

        // Live preview
        nameInput.addEventListener('input', () => {
            const val = nameInput.value.trim();
            previewName.textContent = val || 'YOUR FACTION';
        });

        // Color selection
        this.subScreen.querySelectorAll('.faction-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                this.subScreen.querySelectorAll('.faction-color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                selectedColor = swatch.dataset.color;
                previewBanner.style.borderColor = selectedColor;
                previewName.style.color = selectedColor;
            });
        });

        // Back
        this.subScreen.querySelector('#faction-back').addEventListener('click', () => {
            this.subScreen.classList.add('hidden');
        });

        // Launch
        this.subScreen.querySelector('#faction-launch-btn').addEventListener('click', () => {
            const factionName = nameInput.value.trim() || 'Unnamed Faction';
            this._resolve?.({
                action: 'new',
                tutorial: tutorial,
                faction: { name: factionName, color: selectedColor, treasury: 0 }
            });
        });

        // Focus the input
        requestAnimationFrame(() => nameInput.focus());

        // Skippy speaks
        this.skippySpeak("Every empire starts with a name. Choose wisely, Commander.");
    }

    // ==========================================
    // Load Screen (Save Slots)
    // ==========================================

    showLoadScreen() {
        const slots = this.saveManager.listSlots();
        this.subScreen.classList.remove('hidden');

        let html = `<div class="splash-sub-panel">
            <div class="splash-sub-header">
                <h2>LOAD EXPEDITION</h2>
                <button class="splash-back-btn" id="splash-load-back">BACK</button>
            </div>
            <div class="save-slot-cards">`;

        for (const slot of slots) {
            if (slot.empty) {
                html += `
                <div class="save-slot-card empty">
                    <div class="slot-icon">&#9744;</div>
                    <div class="slot-info">
                        <div class="slot-empty-text">Empty Slot</div>
                    </div>
                    <div class="slot-actions">
                        <button class="slot-action-btn" disabled>LOAD</button>
                    </div>
                </div>`;
            } else {
                const timeAgo = this.formatTimeAgo(slot.timestamp);
                const playtime = this.formatPlaytime(slot.playtime);
                const shipName = (slot.shipClass || 'frigate').toUpperCase();
                const credits = this.formatNumber(slot.credits);
                const isAuto = slot.key === 'auto';

                html += `
                <div class="save-slot-card" data-slot="${slot.key}">
                    <div class="slot-icon">${isAuto ? '&#9881;' : '&#9650;'}</div>
                    <div class="slot-info">
                        <div class="slot-name">
                            ${isAuto ? slot.name : `<input type="text" value="${this.escapeHtml(slot.name)}" data-rename="${slot.key}" maxlength="24">`}
                        </div>
                        <div class="slot-detail">
                            ${slot.factionName ? `<span style="color:#ffaa00">&#9733; ${this.escapeHtml(slot.factionName)}</span>` : ''}
                            <span>${shipName}</span>
                            <span>${credits} ISK</span>
                            <span>${slot.sectorId}</span>
                            <span>${playtime}</span>
                        </div>
                        <div class="slot-timestamp">${timeAgo}</div>
                    </div>
                    <div class="slot-actions">
                        <button class="slot-action-btn" data-load="${slot.key}">LOAD</button>
                        <button class="slot-action-btn" data-export="${slot.key}">EXPORT</button>
                        ${!isAuto ? `<button class="slot-action-btn danger" data-delete="${slot.key}">DEL</button>` : ''}
                    </div>
                </div>`;
            }
        }

        html += `</div>
            <div class="save-import-row">
                <button class="splash-btn" id="splash-import-btn">IMPORT FROM FILE</button>
                <input type="file" id="splash-import-file" accept=".expedition,.json" style="display:none">
            </div>
        </div>`;

        this.subScreen.innerHTML = html;

        // Wire events
        this.subScreen.querySelector('#splash-load-back').addEventListener('click', () => {
            this.subScreen.classList.add('hidden');
        });

        // Load buttons
        this.subScreen.querySelectorAll('[data-load]').forEach(btn => {
            btn.addEventListener('click', () => {
                const slotKey = btn.dataset.load;
                const data = this.saveManager.load(slotKey);
                if (data) {
                    this._resolve?.({ action: 'load', slotData: data });
                }
            });
        });

        // Export buttons
        this.subScreen.querySelectorAll('[data-export]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.saveManager.exportToFile(btn.dataset.export);
            });
        });

        // Delete buttons
        this.subScreen.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.confirmAction(`Delete save "${btn.dataset.delete}"?`, () => {
                    this.saveManager.delete(btn.dataset.delete);
                    this.showLoadScreen(); // Refresh
                });
            });
        });

        // Rename inputs
        this.subScreen.querySelectorAll('[data-rename]').forEach(input => {
            input.addEventListener('change', () => {
                this.saveManager.renameSlot(input.dataset.rename, input.value.trim());
            });
        });

        // Import
        const importBtn = this.subScreen.querySelector('#splash-import-btn');
        const importFile = this.subScreen.querySelector('#splash-import-file');
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', async () => {
            const file = importFile.files[0];
            if (!file) return;
            try {
                const data = await this.saveManager.importFromFile(file);
                // Find an empty slot or use slot-3
                const slots = this.saveManager.listSlots();
                const emptySlot = slots.find(s => s.empty && s.key !== 'auto');
                const targetSlot = emptySlot ? emptySlot.key : 'slot-3';
                this.saveManager.importToSlot(data, targetSlot);
                this.showLoadScreen(); // Refresh
            } catch (err) {
                alert('Import failed: ' + err.message);
            }
        });
    }

    // ==========================================
    // Options Screen
    // ==========================================

    showOptionsScreen() {
        this.subScreen.classList.remove('hidden');

        // Read current audio settings from localStorage
        let audioSettings = { masterVolume: 50, sfxEnabled: true, musicVolume: 12, musicEnabled: true };
        try {
            const saved = localStorage.getItem('expedition-audio');
            if (saved) audioSettings = { ...audioSettings, ...JSON.parse(saved) };
        } catch { /* ignore */ }

        this.subScreen.innerHTML = `<div class="splash-sub-panel">
            <div class="splash-sub-header">
                <h2>OPTIONS</h2>
                <button class="splash-back-btn" id="splash-options-back">BACK</button>
            </div>
            <div style="font-family: 'Courier New', monospace; color: rgba(0,255,255,0.7); font-size: 12px;">
                <div style="margin-bottom: 12px;">
                    <label style="display:flex;align-items:center;gap:10px;">
                        Master Volume
                        <input type="range" id="splash-master-vol" min="0" max="100" value="${audioSettings.masterVolume}" style="flex:1">
                        <span id="splash-vol-val">${audioSettings.masterVolume}%</span>
                    </label>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display:flex;align-items:center;gap:10px;">
                        Music Volume
                        <input type="range" id="splash-music-vol" min="0" max="100" value="${audioSettings.musicVolume}" style="flex:1">
                        <span id="splash-music-val">${audioSettings.musicVolume}%</span>
                    </label>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display:flex;align-items:center;gap:10px;">
                        <input type="checkbox" id="splash-sfx" ${audioSettings.sfxEnabled ? 'checked' : ''}>
                        Sound Effects
                    </label>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display:flex;align-items:center;gap:10px;">
                        <input type="checkbox" id="splash-music" ${audioSettings.musicEnabled ? 'checked' : ''}>
                        Music Enabled
                    </label>
                </div>
            </div>
        </div>`;

        this.subScreen.querySelector('#splash-options-back').addEventListener('click', () => {
            // Save settings
            const settings = {
                masterVolume: parseInt(this.subScreen.querySelector('#splash-master-vol').value),
                sfxEnabled: this.subScreen.querySelector('#splash-sfx').checked,
                musicVolume: parseInt(this.subScreen.querySelector('#splash-music-vol').value),
                musicEnabled: this.subScreen.querySelector('#splash-music').checked,
            };
            try {
                localStorage.setItem('expedition-audio', JSON.stringify(settings));
            } catch { /* ignore */ }
            this.subScreen.classList.add('hidden');
        });

        // Live value displays
        const volSlider = this.subScreen.querySelector('#splash-master-vol');
        const volVal = this.subScreen.querySelector('#splash-vol-val');
        volSlider.addEventListener('input', () => { volVal.textContent = volSlider.value + '%'; });

        const musicSlider = this.subScreen.querySelector('#splash-music-vol');
        const musicVal = this.subScreen.querySelector('#splash-music-val');
        musicSlider.addEventListener('input', () => { musicVal.textContent = musicSlider.value + '%'; });
    }

    // ==========================================
    // Key Map Screen
    // ==========================================

    showKeyMapScreen() {
        this.subScreen.classList.remove('hidden');

        const keybinds = [
            ['W / Up', 'Thrust forward'],
            ['A / Left', 'Turn left'],
            ['D / Right', 'Turn right'],
            ['S / Down', 'Brake / reverse'],
            ['Shift', 'Afterburner boost'],
            ['Tab', 'Toggle warp'],
            ['Space', 'Fire weapons'],
            ['T', 'Lock target'],
            ['Ctrl+T', 'Unlock target'],
            ['Q', 'Orbit target'],
            ['E', 'Approach target'],
            ['R', 'Keep at range'],
            ['F', 'Toggle fleet panel'],
            ['M', 'Open sector map'],
            ['V', 'D-Scan'],
            ['B / Ctrl+B', 'Bookmarks / Add bookmark'],
            ['I', 'Ship info menu'],
            ['J', 'Quest tracker'],
            ['K', 'Statistics'],
            ['L', 'Ship log'],
            ['X', 'Tactical overlay'],
            ['Ctrl+D', 'Auto-target nearest hostile'],
            ['F1', 'Keyboard shortcuts'],
            ['Esc', 'Close panel / Settings'],
        ];

        let gridHtml = '';
        for (const [key, desc] of keybinds) {
            gridHtml += `<div class="kb-row"><span class="kb-key">${key}</span><span>${desc}</span></div>`;
        }

        this.subScreen.innerHTML = `<div class="splash-sub-panel">
            <div class="splash-sub-header">
                <h2>KEY MAP</h2>
                <button class="splash-back-btn" id="splash-keys-back">BACK</button>
            </div>
            <div class="splash-keybinds-grid">${gridHtml}</div>
        </div>`;

        this.subScreen.querySelector('#splash-keys-back').addEventListener('click', () => {
            this.subScreen.classList.add('hidden');
        });
    }

    // ==========================================
    // Confirm Dialog
    // ==========================================

    confirmAction(message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'splash-confirm-overlay';
        overlay.innerHTML = `
            <div class="splash-confirm-dialog">
                <p>${message}</p>
                <div class="confirm-btns">
                    <button class="splash-btn" id="splash-confirm-yes">YES</button>
                    <button class="splash-btn" id="splash-confirm-no">CANCEL</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#splash-confirm-yes').addEventListener('click', () => {
            document.body.removeChild(overlay);
            onConfirm();
        });
        overlay.querySelector('#splash-confirm-no').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });
    }

    // ==========================================
    // Utilities
    // ==========================================

    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    formatPlaytime(seconds) {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n || 0);
    }

    escapeHtml(str) {
        const el = document.createElement('span');
        el.textContent = str || '';
        return el.innerHTML;
    }

    // ==========================================
    // Cleanup
    // ==========================================

    destroy() {
        // Stop animation
        if (this.bgAnimId) {
            cancelAnimationFrame(this.bgAnimId);
            this.bgAnimId = null;
        }

        // Dispose Three.js
        if (this.bgScene) {
            this.bgScene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
        if (this.bgRenderer) {
            this.bgRenderer.dispose();
            this.bgRenderer = null;
        }
        this.bgScene = null;
        this.bgCamera = null;

        // Dispose Skippy avatar
        if (this.avatar) {
            this.avatar.dispose();
            this.avatar = null;
        }

        // Cancel TTS
        if (this.synth) {
            try { this.synth.cancel(); } catch { /* ignore */ }
        }

        // Remove DOM
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
}
