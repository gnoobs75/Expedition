// =============================================
// Model Editor Manager
// In-game GLB model editor with dual viewports
// Allows adjusting rotation/scale and saving orientations
// =============================================

import { SHIP_DATABASE } from '../data/shipDatabase.js';
import { shipMeshFactory } from '../graphics/ShipMeshFactory.js';

export class ModelEditorManager {
    constructor(game) {
        this.game = game;

        // State
        this.visible = false;
        this.initialized = false;
        this.currentPath = null;
        this.currentModel3D = null;
        this.currentModelTopDown = null;

        // Orientation values
        this.rx = 0;
        this.ry = 0;
        this.rz = 0;
        this.scale = 1.0;

        // Brightness (tone mapping exposure)
        this.brightness = 2.5;

        // 3D perspective viewer
        this.scene3D = null;
        this.camera3D = null;
        this.renderer3D = null;
        this.lights3D = [];

        // Top-down viewer
        this.sceneTopDown = null;
        this.cameraTopDown = null;
        this.rendererTopDown = null;
        this.lightsTopDown = [];
        this.topDownZoom = 60;

        // Mouse drag state for 3D viewport
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.cameraAngle = { theta: Math.PI / 4, phi: Math.PI / 3 };
        this.cameraDistance = 80;

        // Animation
        this.animationId = null;

        // Engine jet indicator meshes (in top-down scene)
        this.jetIndicators = [];

        // DOM elements
        this.modal = document.getElementById('model-editor-modal');
        this.canvas3D = document.getElementById('model-editor-3d-canvas');
        this.canvasTopDown = document.getElementById('model-editor-topdown-canvas');

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.modal) return;

        // Close button
        document.getElementById('model-editor-close')?.addEventListener('click', () => this.hide());

        // Load button
        document.getElementById('editor-load-btn')?.addEventListener('click', () => {
            const path = document.getElementById('editor-model-path')?.value;
            if (path) this.loadModel(path);
        });

        // Enter key in path input
        document.getElementById('editor-model-path')?.addEventListener('keydown', (e) => {
            if (e.code === 'Enter') {
                const path = e.target.value;
                if (path) this.loadModel(path);
            }
        });

        // Rotation sliders
        const sliderHandler = (id, axis) => {
            const slider = document.getElementById(id);
            const valEl = document.getElementById(`${id}-val`);
            slider?.addEventListener('input', () => {
                const val = parseInt(slider.value);
                this[axis] = val;
                if (valEl) valEl.textContent = val;
                this.updateOrientation();
            });
        };
        sliderHandler('editor-rx', 'rx');
        sliderHandler('editor-ry', 'ry');
        sliderHandler('editor-rz', 'rz');

        // Scale slider
        const scaleSlider = document.getElementById('editor-scale');
        const scaleVal = document.getElementById('editor-scale-val');
        scaleSlider?.addEventListener('input', () => {
            this.scale = parseFloat(scaleSlider.value);
            if (scaleVal) scaleVal.textContent = this.scale.toFixed(1);
            this.updateOrientation();
        });

        // Brightness slider
        const brightSlider = document.getElementById('editor-brightness');
        const brightVal = document.getElementById('editor-brightness-val');
        brightSlider?.addEventListener('input', () => {
            this.brightness = parseFloat(brightSlider.value);
            if (brightVal) brightVal.textContent = this.brightness.toFixed(1);
            this.applyBrightness();
        });

        // Save button
        document.getElementById('editor-save-btn')?.addEventListener('click', () => this.saveOrientation());

        // Assign to ship button
        document.getElementById('editor-assign-btn')?.addEventListener('click', () => this.assignToShip());

        // Reset button
        document.getElementById('editor-reset-btn')?.addEventListener('click', () => this.resetOrientation());

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.visible) {
                e.stopPropagation();
                this.hide();
            }
        });

        // Mouse drag on 3D canvas
        this.canvas3D?.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
        });
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            this.cameraAngle.theta += dx * 0.01;
            this.cameraAngle.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.cameraAngle.phi - dy * 0.01));
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.updateCameraPosition();
        });
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Mouse wheel zoom on 3D canvas
        this.canvas3D?.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraDistance = Math.max(20, Math.min(300, this.cameraDistance + e.deltaY * 0.1));
            this.updateCameraPosition();
        });

        // Mouse wheel zoom on top-down canvas
        this.canvasTopDown?.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.topDownZoom = Math.max(10, Math.min(150, this.topDownZoom + e.deltaY * 0.05));
            this.updateTopDownCamera();
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            if (this.visible) this.resizeViewports();
        });
    }

    /**
     * Resize canvases to match their actual CSS display size
     */
    resizeViewports() {
        if (this.canvas3D && this.renderer3D) {
            const rect = this.canvas3D.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.canvas3D.width = rect.width;
                this.canvas3D.height = rect.height;
                this.renderer3D.setSize(rect.width, rect.height);
                this.camera3D.aspect = rect.width / rect.height;
                this.camera3D.updateProjectionMatrix();
            }
        }

        if (this.canvasTopDown && this.rendererTopDown) {
            const rect = this.canvasTopDown.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.canvasTopDown.width = rect.width;
                this.canvasTopDown.height = rect.height;
                this.rendererTopDown.setSize(rect.width, rect.height);
                this.topDownAspect = rect.width / rect.height;
                this.updateTopDownCamera();
            }
        }
    }

    /**
     * Initialize the 3D perspective viewer
     */
    init3DViewer() {
        if (!this.canvas3D) return;

        const rect = this.canvas3D.getBoundingClientRect();
        const width = rect.width || 700;
        const height = rect.height || 380;
        this.canvas3D.width = width;
        this.canvas3D.height = height;

        this.scene3D = new THREE.Scene();
        this.scene3D.background = new THREE.Color(0x0a1520);

        this.camera3D = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.updateCameraPosition();

        this.renderer3D = new THREE.WebGLRenderer({ canvas: this.canvas3D, antialias: true });
        this.renderer3D.setSize(width, height);
        this.renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Proper PBR rendering
        this.renderer3D.outputEncoding = THREE.sRGBEncoding;
        this.renderer3D.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer3D.toneMappingExposure = this.brightness;

        // Strong lighting for GLB/PBR models
        this.lights3D = [];

        const ambient = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene3D.add(ambient);
        this.lights3D.push(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
        keyLight.position.set(5, 10, 7);
        this.scene3D.add(keyLight);
        this.lights3D.push(keyLight);

        const fillLight = new THREE.DirectionalLight(0x88bbff, 1.5);
        fillLight.position.set(-5, 3, -4);
        this.scene3D.add(fillLight);
        this.lights3D.push(fillLight);

        const rimLight = new THREE.DirectionalLight(0x00ccff, 1.0);
        rimLight.position.set(0, -3, -6);
        this.scene3D.add(rimLight);
        this.lights3D.push(rimLight);

        const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
        topLight.position.set(0, 15, 0);
        this.scene3D.add(topLight);
        this.lights3D.push(topLight);

        // Grid
        const grid = new THREE.GridHelper(200, 20, 0x003344, 0x001122);
        grid.position.y = -30;
        this.scene3D.add(grid);

        // Axes helper
        const axes = new THREE.AxesHelper(15);
        this.scene3D.add(axes);
    }

    /**
     * Initialize the top-down orthographic viewer (matches game camera)
     */
    initTopDownViewer() {
        if (!this.canvasTopDown) return;

        const rect = this.canvasTopDown.getBoundingClientRect();
        const width = rect.width || 700;
        const height = rect.height || 380;
        this.canvasTopDown.width = width;
        this.canvasTopDown.height = height;

        this.sceneTopDown = new THREE.Scene();
        this.sceneTopDown.background = new THREE.Color(0x0a1520);

        // Orthographic camera looking down -Z (matches game camera)
        this.topDownAspect = width / height;
        this.cameraTopDown = new THREE.OrthographicCamera(
            -this.topDownZoom * this.topDownAspect, this.topDownZoom * this.topDownAspect,
            this.topDownZoom, -this.topDownZoom,
            0.1, 1000
        );
        this.cameraTopDown.position.set(0, 0, 100);
        this.cameraTopDown.lookAt(0, 0, 0);

        this.rendererTopDown = new THREE.WebGLRenderer({ canvas: this.canvasTopDown, antialias: true });
        this.rendererTopDown.setSize(width, height);
        this.rendererTopDown.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Proper PBR rendering
        this.rendererTopDown.outputEncoding = THREE.sRGBEncoding;
        this.rendererTopDown.toneMapping = THREE.ACESFilmicToneMapping;
        this.rendererTopDown.toneMappingExposure = this.brightness;

        // Strong lighting for GLB/PBR models
        this.lightsTopDown = [];

        const ambient = new THREE.AmbientLight(0xffffff, 1.5);
        this.sceneTopDown.add(ambient);
        this.lightsTopDown.push(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(0, 0, 100);
        this.sceneTopDown.add(dirLight);
        this.lightsTopDown.push(dirLight);

        const fillLight = new THREE.DirectionalLight(0x88aacc, 1.0);
        fillLight.position.set(0, 0, -50);
        this.sceneTopDown.add(fillLight);
        this.lightsTopDown.push(fillLight);

        const sideLight = new THREE.DirectionalLight(0xffffff, 0.8);
        sideLight.position.set(50, 50, 50);
        this.sceneTopDown.add(sideLight);
        this.lightsTopDown.push(sideLight);

        // Subtle grid for reference
        const gridSize = 100;
        const gridMat = new THREE.LineBasicMaterial({ color: 0x002233, transparent: true, opacity: 0.3 });
        for (let i = -gridSize; i <= gridSize; i += 20) {
            const geoH = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-gridSize, i, 0),
                new THREE.Vector3(gridSize, i, 0)
            ]);
            const geoV = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(i, -gridSize, 0),
                new THREE.Vector3(i, gridSize, 0)
            ]);
            this.sceneTopDown.add(new THREE.Line(geoH, gridMat));
            this.sceneTopDown.add(new THREE.Line(geoV, gridMat));
        }

        // Forward direction arrow (+X = game forward) - green dashed line with arrowhead
        const fwdMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.6 });
        const fwdGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0.5),
            new THREE.Vector3(55, 0, 0.5)
        ]);
        this.sceneTopDown.add(new THREE.Line(fwdGeo, fwdMat));
        // Arrowhead
        const arrowHeadGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(55, 0, 0.5),
            new THREE.Vector3(48, 4, 0.5),
            new THREE.Vector3(55, 0, 0.5),
            new THREE.Vector3(48, -4, 0.5),
        ]);
        this.sceneTopDown.add(new THREE.LineSegments(arrowHeadGeo, fwdMat));

        // "FWD" label at the tip (using a small sprite)
        this.addTextLabel(this.sceneTopDown, 'FWD', 60, 0, 1, 0x00ff88);

        // Engine jet indicators (behind the ship, -X direction)
        this.createJetIndicators();
    }

    /**
     * Create engine jet indicators in the top-down scene
     * Shows where engine exhaust flames would appear (-X = behind ship)
     */
    createJetIndicators() {
        // Remove old indicators
        for (const obj of this.jetIndicators) {
            this.sceneTopDown.remove(obj);
            obj.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
        }
        this.jetIndicators = [];

        // Engine exhaust cone shapes at -X (behind ship)
        const jetPositions = [
            { x: -25, y: 5 },
            { x: -25, y: -5 },
        ];

        for (const pos of jetPositions) {
            // Flame triangle pointing backward (-X)
            const flameShape = new THREE.Shape();
            flameShape.moveTo(0, -2.5);
            flameShape.lineTo(-14, 0);
            flameShape.lineTo(0, 2.5);
            flameShape.closePath();
            const flameGeo = new THREE.ShapeGeometry(flameShape);
            const flameMat = new THREE.MeshBasicMaterial({
                color: 0xff6622,
                transparent: true,
                opacity: 0.5,
            });
            const flame = new THREE.Mesh(flameGeo, flameMat);
            flame.position.set(pos.x, pos.y, 0.3);
            flame.name = 'jet-indicator';
            this.sceneTopDown.add(flame);
            this.jetIndicators.push(flame);

            // Inner bright core
            const coreShape = new THREE.Shape();
            coreShape.moveTo(0, -1.2);
            coreShape.lineTo(-8, 0);
            coreShape.lineTo(0, 1.2);
            coreShape.closePath();
            const coreGeo = new THREE.ShapeGeometry(coreShape);
            const coreMat = new THREE.MeshBasicMaterial({
                color: 0xffcc44,
                transparent: true,
                opacity: 0.7,
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.set(pos.x, pos.y, 0.4);
            core.name = 'jet-indicator';
            this.sceneTopDown.add(core);
            this.jetIndicators.push(core);
        }

        // "ENGINES" label behind jets
        const label = this.addTextLabel(this.sceneTopDown, 'ENGINES', -48, 0, 1, 0xff6622);
        if (label) {
            label.name = 'jet-indicator';
            this.jetIndicators.push(label);
        }
    }

    /**
     * Add a small text label as a canvas sprite
     */
    addTextLabel(scene, text, x, y, z, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 18px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const hex = '#' + new THREE.Color(color).getHexString();
        ctx.fillStyle = hex;
        ctx.globalAlpha = 0.7;
        ctx.fillText(text, 64, 16);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(x, y, z);
        sprite.scale.set(20, 5, 1);
        scene.add(sprite);
        return sprite;
    }

    /**
     * Update the top-down ortho camera zoom
     */
    updateTopDownCamera() {
        if (!this.cameraTopDown || !this.canvasTopDown) return;
        const aspect = this.canvasTopDown.width / this.canvasTopDown.height;
        this.cameraTopDown.left = -this.topDownZoom * aspect;
        this.cameraTopDown.right = this.topDownZoom * aspect;
        this.cameraTopDown.top = this.topDownZoom;
        this.cameraTopDown.bottom = -this.topDownZoom;
        this.cameraTopDown.updateProjectionMatrix();
    }

    /**
     * Update the 3D camera position based on spherical coordinates
     */
    updateCameraPosition() {
        if (!this.camera3D) return;
        const r = this.cameraDistance;
        const theta = this.cameraAngle.theta;
        const phi = this.cameraAngle.phi;
        this.camera3D.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
        this.camera3D.lookAt(0, 0, 0);
    }

    /**
     * Apply brightness to both renderers and lights
     */
    applyBrightness() {
        if (this.renderer3D) {
            this.renderer3D.toneMappingExposure = this.brightness;
        }
        if (this.rendererTopDown) {
            this.rendererTopDown.toneMappingExposure = this.brightness;
        }
    }

    /**
     * Load a GLB model by path
     */
    async loadModel(path) {
        if (!path) return;

        this.currentPath = path;
        document.getElementById('editor-model-path').value = path;

        // Highlight active model in list
        document.querySelectorAll('.editor-model-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.path === path);
        });

        // Load saved orientation for this path
        const saved = shipMeshFactory.getModelOrientation(path);
        if (saved) {
            this.rx = saved.rx || 0;
            this.ry = saved.ry || 0;
            this.rz = saved.rz || 0;
            this.scale = saved.scale || 1.0;
        } else {
            this.rx = 0;
            this.ry = 0;
            this.rz = 0;
            this.scale = 1.0;
        }
        this.syncSlidersFromState();

        // Load model for 3D viewport (raw, no orientation applied)
        const model3D = await shipMeshFactory.loadModelByPath(path, 40);
        if (!model3D) {
            this.showStatus('Failed to load model', false);
            return;
        }

        // Load model for top-down viewport
        const modelTopDown = await shipMeshFactory.loadModelByPath(path, 40);

        // Set 3D model
        this.removeModel(this.scene3D, 'currentModel3D');
        this.currentModel3D = model3D;
        this.scene3D.add(this.currentModel3D);

        // Set top-down model
        this.removeModel(this.sceneTopDown, 'currentModelTopDown');
        this.currentModelTopDown = modelTopDown;
        this.sceneTopDown.add(this.currentModelTopDown);

        // Apply current orientation
        this.updateOrientation();
        this.showStatus(`Loaded: ${path.split('/').pop()}`, true);
    }

    /**
     * Remove a model from a scene and dispose resources
     */
    removeModel(scene, modelKey) {
        const model = this[modelKey];
        if (model && scene) {
            scene.remove(model);
            model.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this[modelKey] = null;
        }
    }

    /**
     * Update orientation on both models based on slider values
     */
    updateOrientation() {
        const rxRad = this.rx * Math.PI / 180;
        const ryRad = this.ry * Math.PI / 180;
        const rzRad = this.rz * Math.PI / 180;

        if (this.currentModel3D) {
            this.applyOrientationToModel(this.currentModel3D, rxRad, ryRad, rzRad, this.scale);
        }
        if (this.currentModelTopDown) {
            this.applyOrientationToModel(this.currentModelTopDown, rxRad, ryRad, rzRad, this.scale);
        }
    }

    /**
     * Apply orientation to a model by managing its wrapper group
     */
    applyOrientationToModel(model, rxRad, ryRad, rzRad, scale) {
        // Find or create the orientation wrapper
        let wrapper = model.children.find(c => c.name === 'editor-orient');
        if (!wrapper) {
            // Wrap existing children
            wrapper = new THREE.Group();
            wrapper.name = 'editor-orient';
            while (model.children.length > 0) {
                wrapper.add(model.children[0]);
            }
            model.add(wrapper);
        }

        wrapper.rotation.set(rxRad, ryRad, rzRad);
        wrapper.scale.set(scale, scale, scale);
    }

    /**
     * Sync slider DOM elements from current state
     */
    syncSlidersFromState() {
        const setSlider = (id, value) => {
            const el = document.getElementById(id);
            const valEl = document.getElementById(`${id}-val`);
            if (el) el.value = value;
            if (valEl) valEl.textContent = id === 'editor-scale' ? this.scale.toFixed(1) : value;
        };
        setSlider('editor-rx', this.rx);
        setSlider('editor-ry', this.ry);
        setSlider('editor-rz', this.rz);
        setSlider('editor-scale', this.scale);
    }

    /**
     * Save the current orientation to localStorage
     */
    saveOrientation() {
        if (!this.currentPath) {
            this.showStatus('No model loaded', false);
            return;
        }

        shipMeshFactory.saveModelOrientation(this.currentPath, {
            rx: this.rx,
            ry: this.ry,
            rz: this.rz,
            scale: this.scale,
        });

        this.showStatus('Orientation saved!', true);
        this.game.audio?.play('click');
    }

    /**
     * Assign the current model path to a ship in the database
     */
    assignToShip() {
        const select = document.getElementById('editor-ship-select');
        const shipId = select?.value;
        if (!shipId || !this.currentPath) {
            this.showStatus('Select a ship and load a model first', false);
            return;
        }

        const shipConfig = SHIP_DATABASE[shipId];
        if (shipConfig) {
            shipConfig.modelPath = this.currentPath;
            this.showStatus(`Assigned to ${shipConfig.name}`, true);
            this.game.audio?.play('click');
        }
    }

    /**
     * Reset orientation to defaults
     */
    resetOrientation() {
        this.rx = 0;
        this.ry = 0;
        this.rz = 0;
        this.scale = 1.0;
        this.syncSlidersFromState();
        this.updateOrientation();
        this.game.audio?.play('click');
    }

    /**
     * Show a status message briefly
     */
    showStatus(message, success) {
        this.game.ui?.toast(message, success ? 'success' : 'warning');
    }

    /**
     * Populate the known model paths list from SHIP_DATABASE
     */
    populateModelList() {
        const container = document.getElementById('editor-model-list');
        if (!container) return;

        // Collect unique model paths from ship database
        const paths = new Set();
        for (const ship of Object.values(SHIP_DATABASE)) {
            if (ship.modelPath) paths.add(ship.modelPath);
        }

        container.innerHTML = '';
        for (const path of paths) {
            const btn = document.createElement('button');
            btn.className = 'editor-model-btn';
            btn.dataset.path = path;
            btn.textContent = path;
            btn.addEventListener('click', () => this.loadModel(path));
            container.appendChild(btn);
        }
    }

    /**
     * Populate ship assignment dropdown
     */
    populateShipSelect() {
        const select = document.getElementById('editor-ship-select');
        if (!select) return;

        select.innerHTML = '<option value="">-- Select Ship --</option>';
        for (const [id, ship] of Object.entries(SHIP_DATABASE)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${ship.name} (${ship.role} ${ship.size})`;
            select.appendChild(opt);
        }
    }

    /**
     * Animation loop - renders both viewports
     */
    animate() {
        if (!this.visible) {
            this.animationId = null;
            return;
        }

        const time = Date.now() * 0.003;

        // Animate jet indicators (flicker effect)
        for (const jet of this.jetIndicators) {
            if (jet.isMesh && jet.material) {
                jet.material.opacity = 0.3 + Math.sin(time + jet.position.y) * 0.2;
            }
        }

        // Render 3D perspective view
        if (this.renderer3D && this.scene3D && this.camera3D) {
            this.renderer3D.render(this.scene3D, this.camera3D);
        }

        // Render top-down view
        if (this.rendererTopDown && this.sceneTopDown && this.cameraTopDown) {
            this.rendererTopDown.render(this.sceneTopDown, this.cameraTopDown);
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Show the editor
     */
    show() {
        if (!this.modal) return;

        // Show modal FIRST so canvas getBoundingClientRect works
        this.modal.classList.remove('hidden');
        this.visible = true;

        if (!this.initialized) {
            // Defer init to next frame so CSS layout has been computed
            requestAnimationFrame(() => {
                this.init3DViewer();
                this.initTopDownViewer();
                this.initialized = true;

                this.populateModelList();
                this.populateShipSelect();
                this.animate();
            });
        } else {
            // Already initialized - just resize to current dimensions and start rendering
            this.resizeViewports();
            this.populateModelList();
            this.populateShipSelect();
            this.animate();
        }

        this.game.audio?.play('click');
    }

    /**
     * Hide the editor
     */
    hide() {
        if (!this.modal) return;

        this.modal.classList.add('hidden');
        this.visible = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Toggle visibility
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
}
