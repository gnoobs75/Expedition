// =============================================
// Skippy Avatar - Enhanced 3D Beer Can
// Three.js beer can with spring physics, 14 expressions, admiral hat
// Default avatar mode for most expressions
// =============================================

/* global THREE */

// Expression table: eyeColor, eyeScaleX, eyeScaleY, browAngle, mouthColor, squashTarget
const EXPRESSIONS = {
    idle:             { eyeColor: 0x00ffff, eyeScaleX: 1.0, eyeScaleY: 1.0, browAngle: 0,     mouthColor: 0x00ffff, squash: 1.0 },
    talking:          { eyeColor: 0x00ffff, eyeScaleX: 1.0, eyeScaleY: 1.0, browAngle: 0,     mouthColor: 0x00ffff, squash: 1.0 },
    smug:             { eyeColor: 0x00ffaa, eyeScaleX: 0.8, eyeScaleY: 0.7, browAngle: 0.15,  mouthColor: 0x44ff88, squash: 0.97 },
    laughing:         { eyeColor: 0x44ff44, eyeScaleX: 1.2, eyeScaleY: 0.5, browAngle: 0.2,   mouthColor: 0x66ff66, squash: 0.85 },
    annoyed:          { eyeColor: 0xff8800, eyeScaleX: 0.9, eyeScaleY: 0.6, browAngle: -0.3,  mouthColor: 0xff6600, squash: 1.02 },
    excited:          { eyeColor: 0xffff00, eyeScaleX: 1.3, eyeScaleY: 1.3, browAngle: 0.25,  mouthColor: 0xffee00, squash: 1.1 },
    bored:            { eyeColor: 0x668888, eyeScaleX: 1.0, eyeScaleY: 0.5, browAngle: 0,     mouthColor: 0x556666, squash: 0.95 },
    impressed:        { eyeColor: 0x00ccff, eyeScaleX: 1.2, eyeScaleY: 1.2, browAngle: 0.2,   mouthColor: 0x00aaff, squash: 1.05 },
    disappointed:     { eyeColor: 0x888888, eyeScaleX: 0.8, eyeScaleY: 0.8, browAngle: -0.1,  mouthColor: 0x666666, squash: 0.93 },
    mildlyImpressed:  { eyeColor: 0x00ddaa, eyeScaleX: 1.1, eyeScaleY: 1.05, browAngle: 0.1, mouthColor: 0x00cc88, squash: 1.02 },
    neutral:          { eyeColor: 0x00dddd, eyeScaleX: 1.0, eyeScaleY: 1.0, browAngle: 0,     mouthColor: 0x00bbbb, squash: 1.0 },
    alarmed:          { eyeColor: 0xff3300, eyeScaleX: 1.4, eyeScaleY: 1.4, browAngle: -0.35, mouthColor: 0xff2200, squash: 1.15 },
    concerned:        { eyeColor: 0xffaa00, eyeScaleX: 1.1, eyeScaleY: 1.1, browAngle: -0.2,  mouthColor: 0xff8800, squash: 1.03 },
    lecturing:        { eyeColor: 0x8888ff, eyeScaleX: 0.9, eyeScaleY: 0.9, browAngle: -0.15, mouthColor: 0x7777ff, squash: 1.0 },
};

export class SkippyAvatarBeerCan {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.animFrameId = null;
        this.disposed = false;
        this.paused = false;

        // State
        this.expression = 'idle';
        this.isTalking = false;
        this.talkTimer = 0;
        this.gameState = {
            inCombat: false,
            shieldPct: 1,
            isWarping: false,
            isDocked: false,
            isSpeaking: false,
        };

        // Animation
        this.time = 0;
        this.lastFrame = 0;

        // Spring physics for squash & stretch
        this.squashCurrent = 1.0;
        this.squashVelocity = 0.0;
        this.squashTarget = 1.0;
        this.squashStiffness = 120;
        this.squashDamping = 0.7;

        // Wobble spring (rotation)
        this.wobbleX = 0;
        this.wobbleZ = 0;
        this.wobbleVelX = 0;
        this.wobbleVelZ = 0;
        this.wobbleStiffness = 80;
        this.wobbleDamping = 0.6;

        // Expression lerp state
        this.lerpState = {
            eyeColor: new THREE.Color(0x00ffff),
            eyeScaleX: 1, eyeScaleY: 1,
            browAngle: 0,
            mouthColor: new THREE.Color(0x00ffff),
        };

        // Mesh refs
        this.canGroup = null;
        this.eyes = { left: null, right: null };
        this.brows = { left: null, right: null };
        this.mouth = null;
        this.hat = null;
        this.antenna = null;
        this.beacon = null;
        this.runningLights = [];
        this.engineGlows = [];
        this.scanLine = null;
        this.holoShell = null;
        this.labelBand = null;

        // Previous state for wobble impulse
        this._prevCombat = false;
        this._prevDocked = false;
        this._prevWarping = false;
    }

    init() {
        const width = this.container.clientWidth || 208;
        const height = this.container.clientHeight || 180;

        // Renderer
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'skippy-beercan-canvas';
        this.container.appendChild(this.canvas);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
        this.camera.position.set(0, 2, 22);
        this.camera.lookAt(0, 1, 0);

        // Lighting
        const ambient = new THREE.AmbientLight(0x334455, 0.6);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xccddff, 0.8);
        keyLight.position.set(3, 5, 5);
        this.scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(0x00ffff, 0.3);
        rimLight.position.set(-3, 2, -3);
        this.scene.add(rimLight);

        this.faceLight = new THREE.PointLight(0x00ffff, 0.4, 15);
        this.faceLight.position.set(0, 2, 6);
        this.scene.add(this.faceLight);

        // Background
        this._createBackground();

        // Build the beer can
        this.canGroup = new THREE.Group();
        this.scene.add(this.canGroup);

        this._createCanBody();
        this._createLabelBand();
        this._createFace();
        this._createHat();
        this._createAntenna();
        this._createRunningLights();
        this._createEngineGlow();
        this._createScanLine();
        this._createHoloShell();
        this._createTab();

        this.lastFrame = performance.now();
        this.animate();
    }

    _createBackground() {
        // Dark radial backdrop plane
        const bgGeo = new THREE.PlaneGeometry(40, 30);
        const bgMat = new THREE.MeshBasicMaterial({
            color: 0x000a14,
            transparent: true,
            opacity: 0.95,
        });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.z = -10;
        this.scene.add(bg);
    }

    _createCanBody() {
        // Main cylinder
        const bodyGeo = new THREE.CylinderGeometry(3, 3, 10, 24);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x334466,
            metalness: 0.8,
            roughness: 0.3,
            emissive: 0x001122,
            emissiveIntensity: 0.2,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.name = 'canBody';
        this.canGroup.add(body);

        // Top rim
        const rimGeo = new THREE.TorusGeometry(3, 0.25, 8, 24);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0x889aaa,
            metalness: 0.9,
            roughness: 0.2,
        });
        const topRim = new THREE.Mesh(rimGeo, rimMat);
        topRim.rotation.x = Math.PI / 2;
        topRim.position.y = 5;
        this.canGroup.add(topRim);

        // Bottom rim
        const bottomRim = new THREE.Mesh(rimGeo, rimMat.clone());
        bottomRim.rotation.x = Math.PI / 2;
        bottomRim.position.y = -5;
        this.canGroup.add(bottomRim);

        // Top cap
        const capGeo = new THREE.CircleGeometry(3, 24);
        const capMat = new THREE.MeshStandardMaterial({
            color: 0x778899,
            metalness: 0.85,
            roughness: 0.25,
        });
        const topCap = new THREE.Mesh(capGeo, capMat);
        topCap.rotation.x = -Math.PI / 2;
        topCap.position.y = 5;
        this.canGroup.add(topCap);
    }

    _createLabelBand() {
        // Slightly larger open cylinder around middle of can
        const labelGeo = new THREE.CylinderGeometry(3.15, 3.15, 5, 24, 1, true);
        const labelMat = new THREE.MeshStandardMaterial({
            color: 0x1a3355,
            metalness: 0.3,
            roughness: 0.6,
            emissive: 0x0a1833,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide,
        });
        this.labelBand = new THREE.Mesh(labelGeo, labelMat);
        this.labelBand.position.y = -0.5;
        this.canGroup.add(this.labelBand);
    }

    _createFace() {
        // Face background - dark plane on front
        const faceBgGeo = new THREE.PlaneGeometry(4.5, 4);
        const faceBgMat = new THREE.MeshBasicMaterial({
            color: 0x001122,
            transparent: true,
            opacity: 0.7,
        });
        const faceBg = new THREE.Mesh(faceBgGeo, faceBgMat);
        faceBg.position.set(0, 0.5, 3.1);
        this.canGroup.add(faceBg);

        // Eyes
        const eyeGeo = new THREE.PlaneGeometry(0.8, 0.8);
        const eyeMatL = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.95 });
        const eyeMatR = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.95 });

        this.eyes.left = new THREE.Mesh(eyeGeo, eyeMatL);
        this.eyes.left.position.set(-1.0, 1.5, 3.15);
        this.canGroup.add(this.eyes.left);

        this.eyes.right = new THREE.Mesh(eyeGeo, eyeMatR);
        this.eyes.right.position.set(1.0, 1.5, 3.15);
        this.canGroup.add(this.eyes.right);

        // Brows - thin boxes
        const browGeo = new THREE.BoxGeometry(1.0, 0.12, 0.05);
        const browMat = new THREE.MeshBasicMaterial({ color: 0x00dddd });

        this.brows.left = new THREE.Mesh(browGeo, browMat.clone());
        this.brows.left.position.set(-1.0, 2.1, 3.2);
        this.canGroup.add(this.brows.left);

        this.brows.right = new THREE.Mesh(browGeo, browMat.clone());
        this.brows.right.position.set(1.0, 2.1, 3.2);
        this.canGroup.add(this.brows.right);

        // Mouth
        const mouthGeo = new THREE.PlaneGeometry(1.4, 0.3);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.85 });
        this.mouth = new THREE.Mesh(mouthGeo, mouthMat);
        this.mouth.position.set(0, -0.3, 3.15);
        this.canGroup.add(this.mouth);
    }

    _createHat() {
        // Admiral bicorne hat
        this.hat = new THREE.Group();

        // Brim - flattened cylinder
        const brimGeo = new THREE.CylinderGeometry(3.8, 3.5, 0.4, 16);
        const brimMat = new THREE.MeshStandardMaterial({
            color: 0x111122,
            metalness: 0.3,
            roughness: 0.7,
        });
        const brim = new THREE.Mesh(brimGeo, brimMat);
        this.hat.add(brim);

        // Crown - box shape
        const crownGeo = new THREE.BoxGeometry(2.5, 2.5, 3.5);
        const crownMat = new THREE.MeshStandardMaterial({
            color: 0x0a0a1a,
            metalness: 0.2,
            roughness: 0.8,
        });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.y = 1.4;
        this.hat.add(crown);

        // Gold band - emissive ring
        const bandGeo = new THREE.BoxGeometry(2.7, 0.35, 3.7);
        const bandMat = new THREE.MeshStandardMaterial({
            color: 0xddaa22,
            emissive: 0xaa8811,
            emissiveIntensity: 0.6,
            metalness: 0.9,
            roughness: 0.2,
        });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.y = 0.5;
        this.hat.add(band);

        this.hat.position.y = 5.8;
        this.hat.scale.set(0.7, 0.7, 0.7);
        this.canGroup.add(this.hat);
    }

    _createAntenna() {
        // Antenna rod
        const antGeo = new THREE.CylinderGeometry(0.08, 0.06, 2.5, 6);
        const antMat = new THREE.MeshStandardMaterial({
            color: 0x667788,
            metalness: 0.8,
            roughness: 0.3,
        });
        this.antenna = new THREE.Mesh(antGeo, antMat);
        this.antenna.position.set(1.5, 7.5, 0);
        this.canGroup.add(this.antenna);

        // Beacon sphere
        const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.9,
        });
        this.beacon = new THREE.Mesh(beaconGeo, beaconMat);
        this.beacon.position.set(1.5, 8.8, 0);
        this.canGroup.add(this.beacon);
    }

    _createRunningLights() {
        const lightGeo = new THREE.CircleGeometry(0.15, 8);

        // Port (red) - left side
        const portPositions = [
            [-3.05, 2, 0], [-3.05, 0, 0], [-3.05, -2, 0],
        ];
        for (const pos of portPositions) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.8 });
            const light = new THREE.Mesh(lightGeo, mat);
            light.position.set(...pos);
            light.rotation.y = -Math.PI / 2;
            this.canGroup.add(light);
            this.runningLights.push({ mesh: light, type: 'port' });
        }

        // Starboard (green) - right side
        const stbdPositions = [
            [3.05, 2, 0], [3.05, 0, 0], [3.05, -2, 0],
        ];
        for (const pos of stbdPositions) {
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ff22, transparent: true, opacity: 0.8 });
            const light = new THREE.Mesh(lightGeo, mat);
            light.position.set(...pos);
            light.rotation.y = Math.PI / 2;
            this.canGroup.add(light);
            this.runningLights.push({ mesh: light, type: 'starboard' });
        }
    }

    _createEngineGlow() {
        // 3-layer engine glow at bottom
        const layers = [
            { radius: 1.5, color: 0x00ffff, opacity: 0.9, y: -5.5, name: 'core' },
            { radius: 2.2, color: 0x0088cc, opacity: 0.4, y: -5.6, name: 'outer' },
            { radius: 3.0, color: 0x004488, opacity: 0.15, y: -5.7, name: 'bloom' },
        ];
        for (const l of layers) {
            const geo = new THREE.CircleGeometry(l.radius, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: l.color,
                transparent: true,
                opacity: l.opacity,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, l.y, 0);
            mesh.rotation.x = Math.PI / 2;
            this.canGroup.add(mesh);
            this.engineGlows.push({ mesh, baseOpacity: l.opacity, name: l.name });
        }
    }

    _createScanLine() {
        // Thin emissive plane that sweeps vertically
        const geo = new THREE.PlaneGeometry(6.5, 0.15);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.25,
        });
        this.scanLine = new THREE.Mesh(geo, mat);
        this.scanLine.position.set(0, 0, 3.2);
        this.canGroup.add(this.scanLine);
    }

    _createHoloShell() {
        // Semi-transparent outer cylinder
        const shellGeo = new THREE.CylinderGeometry(3.5, 3.5, 11, 24, 1, true);
        const shellMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.03,
            side: THREE.DoubleSide,
            wireframe: false,
        });
        this.holoShell = new THREE.Mesh(shellGeo, shellMat);
        this.canGroup.add(this.holoShell);
    }

    _createTab() {
        // Pull tab on top
        const tabGeo = new THREE.BoxGeometry(0.8, 0.08, 1.8);
        const tabMat = new THREE.MeshStandardMaterial({
            color: 0x99aabb,
            metalness: 0.9,
            roughness: 0.2,
        });
        const tab = new THREE.Mesh(tabGeo, tabMat);
        tab.position.set(-0.8, 5.2, 0);
        tab.rotation.z = 0.1;
        this.canGroup.add(tab);

        // Tab rivet
        const rivetGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8);
        const rivet = new THREE.Mesh(rivetGeo, tabMat.clone());
        rivet.position.set(-0.3, 5.15, 0);
        this.canGroup.add(rivet);
    }

    show() {
        if (this.canvas) this.canvas.style.display = 'block';
    }

    hide() {
        if (this.canvas) this.canvas.style.display = 'none';
    }

    pause() {
        this.paused = true;
    }

    resume() {
        if (!this.paused) return;
        this.paused = false;
        this.lastFrame = performance.now();
        if (!this.animFrameId && !this.disposed) {
            this.animate();
        }
    }

    setExpression(type) {
        const prev = this.expression;
        this.expression = type;

        // Add spring impulse on expression change
        if (prev !== type && EXPRESSIONS[type]) {
            const target = EXPRESSIONS[type].squash;
            this.squashTarget = target;
            // Impulse in the opposite direction for bounce
            this.squashVelocity += (target > 1 ? 2.5 : -2.5);

            // Wobble impulse
            this.wobbleVelX += (Math.random() - 0.5) * 1.5;
            this.wobbleVelZ += (Math.random() - 0.5) * 1.5;
        }
    }

    startTalking() {
        this.isTalking = true;
        this.talkTimer = 0;
    }

    stopTalking() {
        this.isTalking = false;
    }

    updateGameState(state) {
        if (!state) return;
        const prev = { ...this.gameState };
        Object.assign(this.gameState, state);

        // Add wobble impulse on state transitions
        if (state.inCombat !== undefined && state.inCombat !== this._prevCombat) {
            this.wobbleVelX += (Math.random() - 0.5) * 3;
            this.wobbleVelZ += (Math.random() - 0.5) * 2;
            this._prevCombat = state.inCombat;
        }
        if (state.isDocked !== undefined && state.isDocked !== this._prevDocked) {
            this.wobbleVelX += (Math.random() - 0.5) * 2;
            this._prevDocked = state.isDocked;
        }
        if (state.isWarping !== undefined && state.isWarping !== this._prevWarping) {
            this.squashVelocity += 3;
            this._prevWarping = state.isWarping;
        }
    }

    animate = () => {
        if (this.disposed) return;
        if (this.paused) {
            this.animFrameId = null;
            return;
        }
        this.animFrameId = requestAnimationFrame(this.animate);

        const now = performance.now();
        const rawDt = (now - this.lastFrame) / 1000;
        const dt = Math.min(rawDt, 0.05); // Cap at 50ms
        this.lastFrame = now;
        this.time += dt;
        if (this.isTalking) this.talkTimer += dt;

        const t = this.time;
        const combat = this.gameState.inCombat;

        // ---- Spring physics: Squash & Stretch ----
        const expr = EXPRESSIONS[this.expression] || EXPRESSIONS.idle;
        this.squashTarget = expr.squash;

        const squashForce = -this.squashStiffness * (this.squashCurrent - this.squashTarget);
        const squashDamp = -this.squashDamping * this.squashVelocity * this.squashStiffness;
        this.squashVelocity += (squashForce + squashDamp) * dt;
        this.squashCurrent += this.squashVelocity * dt;

        // Volume-preserving: X/Z = 1/sqrt(scaleY)
        const scaleY = this.squashCurrent;
        const scaleXZ = 1.0 / Math.sqrt(Math.max(0.5, scaleY));

        this.canGroup.scale.set(scaleXZ, scaleY, scaleXZ);

        // ---- Spring physics: Wobble ----
        const wobbleForceX = -this.wobbleStiffness * this.wobbleX;
        const wobbleDampX = -this.wobbleDamping * this.wobbleVelX * this.wobbleStiffness;
        this.wobbleVelX += (wobbleForceX + wobbleDampX) * dt;
        this.wobbleX += this.wobbleVelX * dt;

        const wobbleForceZ = -this.wobbleStiffness * this.wobbleZ;
        const wobbleDampZ = -this.wobbleDamping * this.wobbleVelZ * this.wobbleStiffness;
        this.wobbleVelZ += (wobbleForceZ + wobbleDampZ) * dt;
        this.wobbleZ += this.wobbleVelZ * dt;

        this.canGroup.rotation.x = this.wobbleX * 0.05;
        this.canGroup.rotation.z = this.wobbleZ * 0.05;

        // ---- Bob ----
        const bobSpeed = combat ? 3.0 : (this.gameState.isDocked ? 0.8 : 1.5);
        const bobAmp = combat ? 0.4 : (this.gameState.isDocked ? 0.15 : 0.25);
        this.canGroup.position.y = Math.sin(t * bobSpeed) * bobAmp;

        // Erratic rotation in combat
        if (combat) {
            this.canGroup.rotation.y = Math.sin(t * 1.7) * 0.08;
        } else {
            this.canGroup.rotation.y = Math.sin(t * 0.3) * 0.03;
        }

        // ---- Lerp expression params ----
        const lerpSpeed = 5 * dt;
        const targetEyeColor = new THREE.Color(expr.eyeColor);
        const targetMouthColor = new THREE.Color(expr.mouthColor);

        this.lerpState.eyeColor.lerp(targetEyeColor, lerpSpeed);
        this.lerpState.mouthColor.lerp(targetMouthColor, lerpSpeed);
        this.lerpState.eyeScaleX += (expr.eyeScaleX - this.lerpState.eyeScaleX) * lerpSpeed;
        this.lerpState.eyeScaleY += (expr.eyeScaleY - this.lerpState.eyeScaleY) * lerpSpeed;
        this.lerpState.browAngle += (expr.browAngle - this.lerpState.browAngle) * lerpSpeed;

        // Apply to eye meshes
        if (this.eyes.left) {
            this.eyes.left.material.color.copy(this.lerpState.eyeColor);
            this.eyes.left.scale.set(this.lerpState.eyeScaleX, this.lerpState.eyeScaleY, 1);
            this.eyes.right.material.color.copy(this.lerpState.eyeColor);
            this.eyes.right.scale.set(this.lerpState.eyeScaleX, this.lerpState.eyeScaleY, 1);
        }

        // Apply to brows
        if (this.brows.left) {
            this.brows.left.rotation.z = this.lerpState.browAngle;
            this.brows.right.rotation.z = -this.lerpState.browAngle;
        }

        // Apply to mouth
        if (this.mouth) {
            this.mouth.material.color.copy(this.lerpState.mouthColor);

            // Talking animation: sinusoidal Y + X scale
            if (this.isTalking) {
                const talkFreq = 8;
                const mouthOpenY = 0.3 + Math.abs(Math.sin(this.talkTimer * talkFreq)) * 0.5;
                const mouthScaleX = 1.0 + Math.sin(this.talkTimer * talkFreq * 0.7) * 0.15;
                this.mouth.scale.set(mouthScaleX, mouthOpenY / 0.3, 1);
            } else {
                // Subtle idle mouth movement
                this.mouth.scale.set(1, 1, 1);
            }
        }

        // ---- Face light color follows expression ----
        if (this.faceLight) {
            this.faceLight.color.copy(this.lerpState.eyeColor);
            this.faceLight.intensity = this.isTalking ? 0.6 : 0.4;
        }

        // ---- Hat tracks top through squash ----
        if (this.hat) {
            this.hat.position.y = 5.8 * scaleY / scaleXZ;
        }

        // ---- Running lights blink ----
        for (const rl of this.runningLights) {
            if (rl.type === 'port') {
                rl.mesh.material.opacity = 0.5 + Math.sin(t * 2) * 0.4;
            } else {
                rl.mesh.material.opacity = 0.5 + Math.cos(t * 2) * 0.4;
            }
        }

        // ---- Beacon ----
        if (this.beacon) {
            if (combat) {
                // Red rapid blink in combat
                this.beacon.material.color.setHex(0xff2200);
                this.beacon.material.opacity = Math.sin(t * 8) > 0 ? 0.95 : 0.2;
            } else {
                this.beacon.material.color.setHex(0x00ff88);
                this.beacon.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.4;
            }
        }

        // ---- Engine glow pulse ----
        for (const eg of this.engineGlows) {
            const pulse = 1.0 + Math.sin(t * (combat ? 4 : 2)) * 0.3;
            eg.mesh.material.opacity = eg.baseOpacity * pulse;
            if (combat) {
                eg.mesh.material.color.setHex(eg.name === 'core' ? 0xff4400 : eg.name === 'outer' ? 0xcc2200 : 0x881100);
            } else {
                eg.mesh.material.color.setHex(eg.name === 'core' ? 0x00ffff : eg.name === 'outer' ? 0x0088cc : 0x004488);
            }
        }

        // ---- Scan line sweep ----
        if (this.scanLine) {
            const sweepCycle = combat ? 1.5 : 3.0;
            const sweepY = -5 + ((t % sweepCycle) / sweepCycle) * 12;
            this.scanLine.position.y = sweepY;
            this.scanLine.material.opacity = 0.15 + Math.sin(t * 6) * 0.1;
            this.scanLine.material.color.setHex(combat ? 0xff4444 : 0x00ffff);
        }

        // ---- Holographic shell pulse ----
        if (this.holoShell) {
            this.holoShell.material.opacity = 0.02 + Math.sin(t * 1.5) * 0.015;
            this.holoShell.material.color.setHex(combat ? 0xff4444 : 0x00ffff);
        }

        // ---- Label band glow ----
        if (this.labelBand) {
            const glowIntensity = 0.2 + Math.sin(t * 1.2) * 0.1;
            this.labelBand.material.emissiveIntensity = glowIntensity;
        }

        // ---- Low shield face flash ----
        if (this.gameState.shieldPct < 0.25) {
            const flash = Math.sin(t * 12) > 0.5;
            if (this.eyes.left) {
                this.eyes.left.material.opacity = flash ? 0.4 : 0.95;
                this.eyes.right.material.opacity = flash ? 0.4 : 0.95;
            }
        } else {
            if (this.eyes.left) {
                this.eyes.left.material.opacity = 0.95;
                this.eyes.right.material.opacity = 0.95;
            }
        }

        // Render
        this.renderer.render(this.scene, this.camera);
    };

    dispose() {
        this.disposed = true;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
        }

        // Dispose Three.js resources
        if (this.scene) {
            this.scene.traverse(obj => {
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

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.remove();
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }
}
