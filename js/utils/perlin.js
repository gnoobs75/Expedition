// =============================================
// Perlin Noise Implementation
// For procedural nebulae, terrain, and effects
// =============================================

export class PerlinNoise {
    constructor(seed = 0) {
        this.seed = seed;
        this.permutation = this.generatePermutation(seed);
        this.p = new Array(512);

        // Duplicate permutation for overflow handling
        for (let i = 0; i < 512; i++) {
            this.p[i] = this.permutation[i & 255];
        }
    }

    /**
     * Generate permutation table from seed
     */
    generatePermutation(seed) {
        const perm = [];
        for (let i = 0; i < 256; i++) {
            perm[i] = i;
        }

        // Fisher-Yates shuffle with seeded random
        let state = seed;
        for (let i = 255; i > 0; i--) {
            state = ((state * 1103515245) + 12345) & 0x7fffffff;
            const j = state % (i + 1);
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }

        return perm;
    }

    /**
     * Fade function for smooth interpolation
     */
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + t * (b - a);
    }

    /**
     * Gradient function
     */
    grad(hash, x, y) {
        const h = hash & 7;
        const u = h < 4 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
    }

    /**
     * 3D gradient function
     */
    grad3D(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }

    /**
     * 3D Perlin noise
     * @returns Value in range [-1, 1]
     */
    noise3D(x, y, z) {
        // Find unit grid cell
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        // Get relative position in cell
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        // Hash coordinates of cube corners
        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;

        // Blend results from corners
        return this.lerp(
            this.lerp(
                this.lerp(
                    this.grad3D(this.p[AA], x, y, z),
                    this.grad3D(this.p[BA], x - 1, y, z),
                    u
                ),
                this.lerp(
                    this.grad3D(this.p[AB], x, y - 1, z),
                    this.grad3D(this.p[BB], x - 1, y - 1, z),
                    u
                ),
                v
            ),
            this.lerp(
                this.lerp(
                    this.grad3D(this.p[AA + 1], x, y, z - 1),
                    this.grad3D(this.p[BA + 1], x - 1, y, z - 1),
                    u
                ),
                this.lerp(
                    this.grad3D(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad3D(this.p[BB + 1], x - 1, y - 1, z - 1),
                    u
                ),
                v
            ),
            w
        );
    }

    /**
     * 2D Perlin noise
     * @returns Value in range [-1, 1]
     */
    noise2D(x, y) {
        // Find unit grid cell
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        // Get relative position in cell
        x -= Math.floor(x);
        y -= Math.floor(y);

        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(y);

        // Hash coordinates of cube corners
        const A = this.p[X] + Y;
        const AA = this.p[A];
        const AB = this.p[A + 1];
        const B = this.p[X + 1] + Y;
        const BA = this.p[B];
        const BB = this.p[B + 1];

        // Blend results from corners
        return this.lerp(
            this.lerp(
                this.grad(this.p[AA], x, y),
                this.grad(this.p[BA], x - 1, y),
                u
            ),
            this.lerp(
                this.grad(this.p[AB], x, y - 1),
                this.grad(this.p[BB], x - 1, y - 1),
                u
            ),
            v
        );
    }

    /**
     * Fractal Brownian Motion (layered noise)
     * Creates more complex, natural-looking patterns
     */
    fbm(x, y, octaves = 4, lacunarity = 2, persistence = 0.5) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * this.noise2D(x * frequency, y * frequency);
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue;
    }

    /**
     * Turbulence (absolute value of noise)
     * Good for cloud-like effects
     */
    turbulence(x, y, octaves = 4) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * Math.abs(this.noise2D(x * frequency, y * frequency));
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return value / maxValue;
    }

    /**
     * Ridge noise (inverted turbulence)
     * Good for mountain-like features
     */
    ridged(x, y, octaves = 4) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            const n = 1 - Math.abs(this.noise2D(x * frequency, y * frequency));
            value += amplitude * n * n;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return value / maxValue;
    }

    /**
     * Domain warping for more organic patterns
     */
    warpedNoise(x, y, warpStrength = 0.5, octaves = 4) {
        // First pass to create warp offsets
        const warpX = this.fbm(x, y, 2) * warpStrength;
        const warpY = this.fbm(x + 5.2, y + 1.3, 2) * warpStrength;

        // Apply warp and generate final noise
        return this.fbm(x + warpX, y + warpY, octaves);
    }

    /**
     * Normalized noise [0, 1]
     */
    noise2DNormalized(x, y) {
        return (this.noise2D(x, y) + 1) * 0.5;
    }

    /**
     * Generate noise map as Float32Array
     */
    generateNoiseMap(width, height, scale = 0.01, offsetX = 0, offsetY = 0) {
        const data = new Float32Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const nx = (x + offsetX) * scale;
                const ny = (y + offsetY) * scale;
                data[y * width + x] = this.noise2DNormalized(nx, ny);
            }
        }

        return data;
    }
}

// Pre-create a default noise instance
export const perlin = new PerlinNoise(12345);

/**
 * Simplex-like gradient for smoother results
 */
export function simplexGradient(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

/**
 * Create a nebula color from noise value
 * @param value Noise value [0, 1]
 * @param color1 Base color (hex)
 * @param color2 Secondary color (hex)
 */
export function nebulaColor(value, color1, color2) {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;

    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.floor(r1 + (r2 - r1) * value);
    const g = Math.floor(g1 + (g2 - g1) * value);
    const b = Math.floor(b1 + (b2 - b1) * value);

    return (r << 16) | (g << 8) | b;
}
