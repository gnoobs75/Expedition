// =============================================
// Seeded Random Number Generator
// Uses mulberry32 algorithm for fast, reproducible results
// =============================================

export class SeededRandom {
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.state = seed;
    }

    /**
     * Reset to original seed
     */
    reset() {
        this.state = this.seed;
    }

    /**
     * Set new seed
     */
    setSeed(seed) {
        this.seed = seed;
        this.state = seed;
    }

    /**
     * Get next random number [0, 1)
     */
    next() {
        this.state |= 0;
        this.state = (this.state + 0x6D2B79F5) | 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /**
     * Get random float in range [min, max)
     */
    float(min = 0, max = 1) {
        return min + this.next() * (max - min);
    }

    /**
     * Get random integer in range [min, max]
     */
    int(min, max) {
        return Math.floor(this.float(min, max + 1));
    }

    /**
     * Get random boolean with probability
     */
    bool(probability = 0.5) {
        return this.next() < probability;
    }

    /**
     * Pick random element from array
     */
    pick(array) {
        if (!array || array.length === 0) return undefined;
        return array[this.int(0, array.length - 1)];
    }

    /**
     * Shuffle array in place
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Get random angle in radians
     */
    angle() {
        return this.float(0, Math.PI * 2);
    }

    /**
     * Get random point in circle
     */
    pointInCircle(radius) {
        const r = Math.sqrt(this.next()) * radius;
        const theta = this.angle();
        return {
            x: r * Math.cos(theta),
            y: r * Math.sin(theta),
        };
    }

    /**
     * Get random point on circle edge
     */
    pointOnCircle(radius) {
        const theta = this.angle();
        return {
            x: radius * Math.cos(theta),
            y: radius * Math.sin(theta),
        };
    }

    /**
     * Get random point in rectangle
     */
    pointInRect(width, height) {
        return {
            x: this.float(0, width),
            y: this.float(0, height),
        };
    }

    /**
     * Gaussian (normal) distribution
     * Uses Box-Muller transform
     */
    gaussian(mean = 0, stddev = 1) {
        const u1 = this.next();
        const u2 = this.next();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * stddev;
    }

    /**
     * Weighted random selection
     * @param items Array of { value, weight }
     */
    weighted(items) {
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        let r = this.float(0, totalWeight);

        for (const item of items) {
            r -= item.weight;
            if (r <= 0) return item.value;
        }

        return items[items.length - 1].value;
    }

    /**
     * Generate unique ID based on seed
     */
    id(prefix = '') {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = prefix;
        for (let i = 0; i < 8; i++) {
            id += chars[this.int(0, chars.length - 1)];
        }
        return id;
    }
}

// Global instance with random seed
export const random = new SeededRandom();

/**
 * Create seed from string (for sector names, etc.)
 */
export function stringToSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Combine multiple seeds into one
 */
export function combineSeeds(...seeds) {
    let combined = 0;
    for (const seed of seeds) {
        combined = ((combined << 5) - combined) + seed;
        combined = combined & combined;
    }
    return Math.abs(combined);
}
