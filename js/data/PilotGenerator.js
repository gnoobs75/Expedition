// =============================================
// Pilot Generator
// Generates random pilots with skills and traits
// =============================================

const FIRST_NAMES = [
    'Arik', 'Bren', 'Cael', 'Dax', 'Eran', 'Finn', 'Gael', 'Hvar', 'Iris', 'Jace',
    'Kael', 'Luna', 'Mira', 'Nyx', 'Orin', 'Pike', 'Quinn', 'Reva', 'Sela', 'Tarn',
    'Ulia', 'Vera', 'Wren', 'Xara', 'Yael', 'Zira', 'Asha', 'Bael', 'Cyra', 'Dren',
    'Elis', 'Fael', 'Grit', 'Haze', 'Ixen', 'Jori', 'Kira', 'Lux', 'Mael', 'Nova',
    'Onyx', 'Pax', 'Rook', 'Sage', 'Trix', 'Vale', 'Wynn', 'Xen', 'Yara', 'Zeph',
];

const LAST_NAMES = [
    'Volkov', 'Ashford', 'Blackburn', 'Corsair', 'Drake', 'Ember', 'Frost', 'Gale', 'Hawk', 'Irons',
    'Jade', 'Kestrel', 'Lark', 'Mercer', 'North', 'Orion', 'Pryde', 'Quill', 'Raze', 'Storm',
    'Thorn', 'Umbra', 'Vex', 'Ward', 'Xenon', 'Yield', 'Zenith', 'Anvil', 'Blaze', 'Crane',
    'Drift', 'Edge', 'Flint', 'Grieve', 'Holt', 'Ire', 'Jinx', 'Knox', 'Lynx', 'Mace',
    'Nash', 'Opal', 'Pike', 'Rend', 'Shard', 'Torque', 'Umber', 'Voss', 'Weld', 'Zane',
];

const TRAIT_POOL = [
    { id: 'aggressive', name: 'Aggressive', description: '1.5x aggro range', color: '#ff6644' },
    { id: 'cautious', name: 'Cautious', description: 'Flees at 40% hull', color: '#44aaff' },
    { id: 'efficient', name: 'Efficient', description: '0.9x mining cycle time', color: '#44ff88' },
    { id: 'lucky', name: 'Lucky', description: '1.15x mining yield', color: '#ffcc44' },
    { id: 'hotshot', name: 'Hotshot', description: '1.1x max speed', color: '#ff8844' },
    { id: 'steady', name: 'Steady', description: '1.1x hit chance', color: '#88aaff' },
];

let pilotIdCounter = 0;

export class PilotGenerator {
    /**
     * Generate a batch of random pilots
     * @param {number} count - Number of pilots to generate
     * @param {number} [minSkill=5] - Minimum skill level
     * @param {number} [maxSkill=80] - Maximum skill level
     * @returns {Array} Array of pilot objects
     */
    static generate(count = 8, minSkill = 5, maxSkill = 80) {
        const pilots = [];
        for (let i = 0; i < count; i++) {
            pilots.push(PilotGenerator.generateOne(minSkill, maxSkill));
        }
        return pilots;
    }

    /**
     * Generate a single random pilot
     */
    static generateOne(minSkill = 5, maxSkill = 80) {
        const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const name = `${firstName} ${lastName}`;

        // Generate skills
        const skills = {
            combat: PilotGenerator.randomSkill(minSkill, maxSkill),
            mining: PilotGenerator.randomSkill(minSkill, maxSkill),
            navigation: PilotGenerator.randomSkill(minSkill, maxSkill),
        };

        // Generate 1-2 random traits (no duplicates)
        const traitCount = Math.random() < 0.4 ? 2 : 1;
        const shuffled = [...TRAIT_POOL].sort(() => Math.random() - 0.5);
        const traits = shuffled.slice(0, traitCount).map(t => t.id);

        // Calculate salary and hire cost
        const avgSkill = (skills.combat + skills.mining + skills.navigation) / 3;
        const salary = Math.round(50 + avgSkill * 8); // 50-690 ISK/day
        const hireCost = salary * 3;

        return {
            id: ++pilotIdCounter,
            name,
            firstName,
            lastName,
            skills,
            traits,
            salary,
            hireCost,
            assignedShipId: null,
        };
    }

    /**
     * Generate a random skill value with slight clustering
     */
    static randomSkill(min, max) {
        // Use two rolls for slight bell-curve distribution
        const r1 = Math.random();
        const r2 = Math.random();
        const value = (r1 + r2) / 2;
        return Math.round(min + value * (max - min));
    }

    /**
     * Get trait info by ID
     */
    static getTraitInfo(traitId) {
        return TRAIT_POOL.find(t => t.id === traitId) || { id: traitId, name: traitId, description: '', color: '#888' };
    }

    /**
     * Get all available traits
     */
    static getTraits() {
        return TRAIT_POOL;
    }

    /**
     * Calculate skill multiplier for a given skill level
     * skill 0 = 0.5x, skill 50 = 1.0x, skill 100 = 1.5x
     */
    static skillMultiplier(skillLevel) {
        return 0.5 + (skillLevel / 100) * 1.0;
    }
}
