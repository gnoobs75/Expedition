// =============================================
// Dynamic Light Pool
// Reusable pool of PointLights for weapon fire,
// explosions, and shield hit illumination
// =============================================

export class LightPool {
    constructor(scene) {
        this.scene = scene;
        this.lights = [];
        this.activeLights = [];

        // Create 6 pooled point lights
        for (let i = 0; i < 6; i++) {
            const light = new THREE.PointLight(0xffffff, 0, 500);
            light.visible = false;
            this.scene.add(light);
            this.lights.push(light);
        }
    }

    /**
     * Spawn a dynamic light at position
     * @param {number} x - World X position
     * @param {number} y - World Y position
     * @param {number} color - Hex color
     * @param {number} intensity - Light intensity (0-3)
     * @param {number} duration - Fade duration in seconds
     * @param {number} distance - Light falloff distance
     */
    spawn(x, y, color, intensity, duration, distance = 400) {
        const light = this.lights.find(l => !l.visible);
        if (!light) return null;

        light.position.set(x, y, 15);
        light.color.setHex(color);
        light.intensity = intensity;
        light.distance = distance;
        light.visible = true;

        this.activeLights.push({
            light,
            life: 0,
            maxLife: duration,
            startIntensity: intensity,
        });

        return light;
    }

    /**
     * Update active lights (fade and recycle)
     */
    update(dt) {
        for (let i = this.activeLights.length - 1; i >= 0; i--) {
            const active = this.activeLights[i];
            active.life += dt;

            if (active.life >= active.maxLife) {
                active.light.visible = false;
                active.light.intensity = 0;
                this.activeLights.splice(i, 1);
            } else {
                // Smooth quadratic fade-out
                const t = active.life / active.maxLife;
                active.light.intensity = active.startIntensity * (1 - t * t);
            }
        }
    }

    /**
     * Clear all active lights
     */
    clear() {
        for (const active of this.activeLights) {
            active.light.visible = false;
            active.light.intensity = 0;
        }
        this.activeLights = [];
    }
}
