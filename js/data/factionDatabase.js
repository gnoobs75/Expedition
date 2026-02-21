// =============================================
// Faction Database
// Expeditionary Force (Craig Alanson) inspired factions
// with coalition relationships and standing system
// =============================================

// Standing thresholds
export const STANDING_THRESHOLDS = {
    HOSTILE:    { name: 'Hostile',    min: -10, max: -5,  color: '#ff2222' },
    UNFRIENDLY: { name: 'Unfriendly', min: -5,  max: -2,  color: '#ff8844' },
    NEUTRAL:    { name: 'Neutral',    min: -2,  max: 2,   color: '#888888' },
    FRIENDLY:   { name: 'Friendly',   min: 2,   max: 5,   color: '#44aaff' },
    ALLIED:     { name: 'Allied',     min: 5,   max: 10,  color: '#44ff44' },
};

// Coalition definitions
export const COALITIONS = {
    rindhalu: {
        name: 'Rindhalu Coalition',
        members: ['rindhalu', 'jeraptha', 'ruhar'],
        color: '#4488ff',
        spilloverMultiplier: 0.3,
    },
    maxolhx: {
        name: 'Maxolhx Coalition',
        members: ['maxolhx', 'thuranin', 'bosphuraq', 'kristang'],
        color: '#ff4444',
        spilloverMultiplier: 0.3,
    },
    humanity: {
        name: 'Humanity',
        members: ['unef', 'mavericks', 'keepers'],
        color: '#44ffaa',
        spilloverMultiplier: 0.5,
    },
    independent: {
        name: 'Independent',
        members: ['esselgin', 'wurgalan'],
        color: '#ffaa44',
        spilloverMultiplier: 0.2,
    },
};

// Cross-coalition hostility (standing modifier when interacting with rival coalitions)
export const COALITION_RELATIONS = {
    rindhalu: { maxolhx: -0.5, humanity: 0.1, independent: 0.0 },
    maxolhx:  { rindhalu: -0.5, humanity: -0.3, independent: -0.1 },
    humanity: { rindhalu: 0.1, maxolhx: -0.3, independent: 0.1 },
    independent: { rindhalu: 0.0, maxolhx: -0.1, humanity: 0.1 },
};

// Full faction definitions
export const FACTIONS = {
    // =============================================
    // TIER 1 - Elder Races (Most Powerful)
    // =============================================
    rindhalu: {
        name: 'Rindhalu Collective',
        nickname: 'Spiders',
        tier: 1,
        coalition: 'rindhalu',
        color: '#4488ff',
        personality: 'ancient',
        description: 'Ancient spider-like beings who lead the senior coalition. Rarely seen, immensely powerful.',
        tradeGoods: ['quantum-crystals', 'neural-matrices'],
        shipPrefix: 'RCS',
        baseStanding: 0,
        aggressionLevel: 0.1,
        techLevel: 5,
        // Lore
        icon: '\u{1F577}',
        physicalDescription: 'Multi-legged arachnid beings with hard chitinous exoskeletons. Their bodies are segmented with eight primary limbs and multiple smaller manipulator appendages. They communicate through complex vibrational patterns transmitted through web-like neural networks. Their eyes are multifaceted compound lenses capable of seeing across a broad electromagnetic spectrum.',
        homeworld: 'Unknown - their homeworld location is one of the galaxy\'s most closely guarded secrets',
        government: 'The Collective operates through consensus of ancient web-minds, biological neural networks spanning entire star systems. Individual Rindhalu defer to the accumulated wisdom of millions of years of shared consciousness.',
        society: 'Rindhalu society is profoundly patient and long-lived. They think in terms of millennia rather than years and view younger species as impulsive children. They rarely intervene directly, preferring to manipulate events through proxies and subtle influence. Their caution borders on paranoia, shaped by some ancient trauma they refuse to discuss.',
        technology: 'The most advanced technology in known space. Their ships appear to defy physics, employing spatial compression fields, quantum entanglement drives, and weapons that can destabilize entire star systems. They share only the barest fraction of their capabilities with their coalition allies.',
        militaryDoctrine: 'Overwhelming force applied with surgical precision, but only as a last resort. The Rindhalu prefer deterrence and maintain a fleet so powerful that no rational species would challenge them. When they do fight, battles tend to be extremely brief.',
        humanRelations: 'The Rindhalu view humanity with detached curiosity. Humans are too new and insignificant to warrant direct attention, though the Mavericks\' possession of an Elder AI has drawn their interest. They are cautiously observant.',
        notableTraits: ['Oldest known spacefaring species', 'Lead the Senior Coalition', 'Possess Elder-derived technology', 'Communicate via web vibrations', 'Extremely risk-averse despite immense power'],
    },
    maxolhx: {
        name: 'Maxolhx Federation',
        nickname: 'Rotten Kitties',
        tier: 1,
        coalition: 'maxolhx',
        color: '#ff4444',
        personality: 'arrogant',
        description: 'Cat-like apex predators leading the junior coalition. Technologically sophisticated and deeply hostile to humans.',
        tradeGoods: ['plasma-conduits', 'stealth-alloys'],
        shipPrefix: 'MXF',
        baseStanding: -3,
        aggressionLevel: 0.6,
        techLevel: 5,
        icon: '\u{1F431}',
        physicalDescription: 'Humanoid felines standing roughly two meters tall, covered in fine fur that ranges from tawny gold to dark silver. They possess retractable claws, saber-toothed canines, and piercing yellow eyes with slit pupils. Their bodies are powerfully muscled with a predator\'s grace. Many augment themselves with sophisticated nanobots that enhance their already formidable physical capabilities.',
        homeworld: 'Maxolhx Prime - a high-gravity world with vast savannahs and dense forests',
        government: 'A militaristic federation governed by a council of clan matriarchs. Political power derives from a combination of military strength, technological achievement, and bloodline prestige. Their belief in manifest destiny drives expansionist policies.',
        society: 'Maxolhx society revolves around clan loyalty and the conviction that they are destined to rule the galaxy. They respect strength and cunning above all else. Art, science, and warfare are intertwined - they view combat as the highest form of self-expression. They despise weakness and have little tolerance for species they consider inferior.',
        technology: 'Second only to the Rindhalu, with particular mastery of stealth systems, nanobot warfare, and plasma weapons. Their ships are elegant killing machines, optimized for aggressive combat. They invest heavily in weapons research and biological enhancement.',
        militaryDoctrine: 'Aggressive, decisive strikes aimed at total annihilation. The Maxolhx do not accept surrender from species they intend to eliminate. Their fleets favor overwhelming firepower and advanced electronic warfare.',
        humanRelations: 'Deeply hostile. The Maxolhx view humanity as vermin that somehow acquired dangerous technology. They have repeatedly attempted to wipe out the human species and consider humanity\'s continued existence a personal affront to their superiority.',
        notableTraits: ['Lead the Junior Coalition', 'Nanobot-enhanced biology', 'Manifest destiny ideology', 'Most dangerous species to humans', 'Saber-toothed feline predators'],
    },

    // =============================================
    // TIER 2 - Patron Races
    // =============================================
    jeraptha: {
        name: 'Jeraptha Ajackus',
        nickname: 'Beetles',
        tier: 2,
        coalition: 'rindhalu',
        color: '#44ccff',
        personality: 'mercantile',
        description: 'Beetle-like traders and warriors. Profit-driven but honorable in their own way.',
        tradeGoods: ['trade-contracts', 'shield-harmonics'],
        shipPrefix: 'JAK',
        baseStanding: 1,
        aggressionLevel: 0.3,
        techLevel: 4,
        icon: '\u{1FAB2}',
        physicalDescription: 'Large beetle-like arthropods with leathery segmented exoskeletons in iridescent blues and greens. They stand upright on four sturdy legs and use two upper limbs with dexterous multi-jointed fingers for manipulation. Their heads feature prominent compound eyes, articulate antennae used for emotional expression, and mandibles that double as speech organs. Average height around 1.5 meters.',
        homeworld: 'Jeraptha - a warm, humid world with vast fungal forests and mineral-rich cave systems',
        government: 'A merchant republic where political influence is directly proportional to wealth and trading success. The Ajackus Trade Council sets policy, and every major decision is framed as a business proposition with calculated risk-reward ratios.',
        society: 'The Jeraptha are obsessed with gambling, deal-making, and competitive commerce. Everything is a wager to them - wars are fought with an eye on profit margins, alliances are investment portfolios, and personal honor is measured in successful trades. Despite this mercenary outlook, they have a genuine code of honor around contracts and spoken agreements.',
        technology: 'Excellent shield technology and defensive systems, reflecting their preference for protecting assets over destroying them. Their ships are heavily shielded trading vessels that can hold their own in combat. They excel at sensor technology for detecting valuable resources.',
        militaryDoctrine: 'Pragmatic and profit-conscious. The Jeraptha fight when the expected return exceeds the cost. They prefer defensive warfare, protecting trade routes and valuable assets. When they do go on the offensive, they ensure numerical and technological superiority first.',
        humanRelations: 'Cautiously positive. The Jeraptha find humans amusing and surprisingly profitable to deal with. They appreciate humanity\'s willingness to take risks and their unpredictable nature, which creates trading opportunities. Several Jeraptha have made fortunes on human-related wagers.',
        notableTraits: ['Compulsive gamblers', 'Superior shield technology', 'Trade-based political system', 'Strongest Patron in Rindhalu Coalition', 'Expressive antennae convey emotions'],
    },
    thuranin: {
        name: 'Thuranin Republic',
        nickname: 'Pin Heads',
        tier: 2,
        coalition: 'maxolhx',
        color: '#aa44ff',
        personality: 'logical',
        description: 'Small, technologically gifted species. Coldly logical and dismissive of lesser species.',
        tradeGoods: ['micro-processors', 'sensor-arrays'],
        shipPrefix: 'THR',
        baseStanding: -2,
        aggressionLevel: 0.4,
        techLevel: 4,
        icon: '\u{1F47D}',
        physicalDescription: 'Small humanoids averaging about 1.2 meters tall, with oversized craniums, gray-green skin, and large dark eyes - essentially the classic "little green men." Their bodies are slight and frail compared to humans, which they compensate for with extensive cybernetic augmentation. Most Thuranin have visible implants at their temples and along their spines. They exist as 39 distinct genotypes, essentially mass-produced clone lines.',
        homeworld: 'Thuranin - a low-gravity world with thin atmosphere, largely urbanized into planet-spanning arcologies',
        government: 'A technocratic republic where genotype committees make decisions through logical consensus algorithms. Individuality is discouraged; Thuranin identify more with their genotype line than as individuals. Government policy is determined by data analysis rather than debate.',
        society: 'The Thuranin despise their organic bodies and view biology as an engineering problem to be solved. They augment themselves with cybernetics from birth and dream of eventually transcending flesh entirely. Their society is rigidly organized by genotype, with each clone line specializing in specific functions. They regard unaugmented species with barely disguised contempt.',
        technology: 'Masters of miniaturization, cybernetics, and computing. Their ships feature the most advanced computer systems and sensor arrays in their tier. They excel at electronic warfare and automated combat systems, preferring machines to fight their wars.',
        militaryDoctrine: 'Technology-dependent warfare with heavy use of automated drones, electronic countermeasures, and precision strikes. Thuranin prefer to win battles through information superiority rather than brute force. Their ships compensate for small crews with advanced automation.',
        humanRelations: 'Hostile but pragmatic. The Thuranin view humans as primitives and were shocked when humanity proved capable of operating captured Thuranin technology. They serve the Maxolhx but resent being subordinate to what they consider less intellectually rigorous beings.',
        notableTraits: ['39 genotype clone lines', 'Extensive cybernetic augmentation', 'Master computer engineers', 'Hate their own organic nature', 'Classic "little green men" appearance'],
    },
    bosphuraq: {
        name: 'Bosphuraq Concordance',
        nickname: 'Bird Brains',
        tier: 2,
        coalition: 'maxolhx',
        color: '#ff8844',
        personality: 'aggressive',
        description: 'Avian warriors, aggressive and territorial. Patron species of the Kristang.',
        tradeGoods: ['weapons-tech', 'flight-enhancers'],
        shipPrefix: 'BSP',
        baseStanding: -2,
        aggressionLevel: 0.5,
        techLevel: 3,
        icon: '\u{1F985}',
        physicalDescription: 'Large avian beings standing over two meters tall with vestigial wings that have evolved into powerful arms ending in taloned hands. Their bodies are covered in dense plumage ranging from dark bronze to metallic blue. They have sharp curved beaks, keen predator eyes with exceptional depth perception, and hollow bones reinforced with carbon-fiber biological lattice for strength without weight.',
        homeworld: 'Bosphuraq - a world of towering mountain ranges, deep canyons, and powerful winds',
        government: 'The Concordance is a military hierarchy where rank is earned through combat performance and territorial conquest. Flock-leaders command regional territories and answer to the Supreme Flock, a war council of the most decorated commanders.',
        society: 'Bosphuraq culture glorifies aerial combat and territorial expansion. Their ancestral instincts for flight and predation translate into an aggressive, competitive society where weakness is culled. They view their patron role over the Kristang as a right earned by superiority, and they maintain strict control over their client species.',
        technology: 'Specializes in weapons systems and flight/propulsion technology. Their ships are fast and heavily armed, reflecting their combat-first philosophy. They have developed some of the most effective kinetic weapons in their tier and excel at atmospheric combat craft.',
        militaryDoctrine: 'Swift, aggressive strikes from unexpected angles. The Bosphuraq favor speed and firepower over defense, using flanking maneuvers and dive-bombing tactics adapted from their aerial predator instincts. They are rivals of the Thuranin for influence within the Maxolhx Coalition.',
        humanRelations: 'Hostile by default as members of the Maxolhx Coalition, but less personally invested in humanity\'s destruction than the Maxolhx themselves. They view humans primarily through the lens of their Kristang clients\' conflicts.',
        notableTraits: ['Vestigial wings evolved into arms', 'Patron species of the Kristang', 'Rivals of the Thuranin', 'Exceptional depth perception', 'Territorial flock-based hierarchy'],
    },
    esselgin: {
        name: 'Esselgin Dominion',
        nickname: 'Snakes',
        tier: 2,
        coalition: 'independent',
        color: '#88ff44',
        personality: 'cunning',
        description: 'Serpentine diplomats who play both coalitions against each other. Untrustworthy but useful.',
        tradeGoods: ['diplomatic-ciphers', 'bio-compounds'],
        shipPrefix: 'ESD',
        baseStanding: 0,
        aggressionLevel: 0.25,
        techLevel: 3,
        icon: '\u{1F40D}',
        physicalDescription: 'Slender humanoid reptilians averaging 1.8 meters tall with elongated, sinuous bodies. Their skin is covered in fine, smooth scales that shimmer between green and gold depending on the light. They have narrow faces with slit-pupiled eyes, forked tongues used for chemical sensing, and a graceful, almost hypnotic way of moving. The youngest spacefaring species to reach Patron status.',
        homeworld: 'Esselgin - a warm, densely forested world with vast swamp-river networks',
        government: 'A stratified dominion ruled by the Coil, an inner circle of the most cunning political manipulators. Power is gained through intelligence gathering, blackmail, and diplomatic manipulation rather than military force. Every Esselgin diplomat is also a spy.',
        society: 'Esselgin society values information above all else. They are master diplomats and manipulators who maintain their independence by playing the two coalitions against each other. Trust is a foreign concept - every interaction is a transaction, every alliance temporary. Despite this, they are considered essential intermediaries in galactic politics.',
        technology: 'Specializes in EWAR systems, stealth technology, and biological engineering. Their ships carry advanced jamming equipment and sensor suites. They have developed unique bio-compounds with pharmaceutical and military applications.',
        militaryDoctrine: 'Avoidance and misdirection. The Esselgin rarely fight directly, preferring to have others fight on their behalf. When forced into combat, they rely on electronic warfare, stealth, and hit-and-run tactics. Their intelligence networks are their primary weapon.',
        humanRelations: 'Neutral and calculating. The Esselgin see humanity as a useful disruption to the galactic order that creates opportunities for manipulation. They will trade with anyone and betray anyone if the price is right.',
        notableTraits: ['Youngest spacefaring Patron race', 'Master spies and diplomats', 'Play both coalitions against each other', 'Chemical-sensing forked tongues', 'EWAR technology specialists'],
    },

    // =============================================
    // TIER 3 - Client Races
    // =============================================
    ruhar: {
        name: 'Ruhar Federal Republic',
        nickname: 'Hamsters',
        tier: 3,
        coalition: 'rindhalu',
        color: '#ffcc44',
        personality: 'friendly',
        description: 'Hamster-like people. Friendly, democratic, and humanity\'s best alien allies.',
        tradeGoods: ['foodstuffs', 'medical-supplies'],
        shipPrefix: 'RFR',
        baseStanding: 3,
        aggressionLevel: 0.15,
        techLevel: 2,
        icon: '\u{1F439}',
        physicalDescription: 'Compact, rounded humanoids averaging 1.4 meters tall with golden-brown fur, round faces, large expressive eyes, prominent whiskers, and small rounded ears. They are surprisingly strong for their size, with quick reflexes and excellent hand-eye coordination. Their appearance is often described as "hamster-like" by humans, which they find mildly embarrassing but tolerate with good humor.',
        homeworld: 'Ruhar - a temperate, Earth-like world with extensive grasslands and gentle rolling hills',
        government: 'A parliamentary federal republic with elected representatives and strong protections for individual rights. Their political system resembles a more advanced version of Western democracies, with robust debate, free press, and peaceful transfers of power.',
        society: 'Ruhar society is warm, communal, and values cooperation. They are natural diplomats and peacemakers, though they can be fierce defenders when threatened. They enjoy good food, social gatherings, and have a rich tradition of arts and music. Of all alien species, the Ruhar are most culturally compatible with humanity.',
        technology: 'Well-rounded with particular expertise in maser weapons, shield technology, and agricultural science. Their ships are solid and reliable rather than cutting-edge. They make up for technological limitations with excellent tactical doctrine and strong morale.',
        militaryDoctrine: 'Defensive and measured. The Ruhar fight to protect their people, not for conquest. They favor well-organized defensive positions, coordinated fleet actions, and withdrawing when the cost of battle exceeds the value of the objective. They are the most level-headed warriors in the galaxy.',
        humanRelations: 'Humanity\'s closest alien allies. The Ruhar recognized early that humans were not the mindless barbarians described by Kristang propaganda. They have extended diplomatic protection and technological assistance, forming genuine friendships across species lines. Some Ruhar and humans have become quite close.',
        notableTraits: ['Humanity\'s best alien friends', 'Democratic federal republic', 'Maser weapon specialists', 'Surprisingly strong for their size', 'Rich culinary and artistic traditions'],
    },
    kristang: {
        name: 'Kristang Warriors',
        nickname: 'Lizards',
        tier: 3,
        coalition: 'maxolhx',
        color: '#ff2222',
        personality: 'warrior',
        description: 'Aggressive lizard warriors. Honor-obsessed, violent, and humanity\'s primary antagonists.',
        tradeGoods: ['war-trophies', 'combat-stimulants'],
        shipPrefix: 'KRW',
        baseStanding: -4,
        aggressionLevel: 0.7,
        techLevel: 2,
        icon: '\u{1F98E}',
        physicalDescription: 'Massive reptilian humanoids standing over 2.1 meters tall with thick, scaled skin ranging from dark green to mottled brown. They have three thick fingers plus a thumb on each hand, powerful jaws filled with sharp teeth, small yellow eyes, and heavy brow ridges. Their bodies are enormously muscular and built for physical combat. Many bear ritual scarification and trophy markings from defeated enemies.',
        homeworld: 'Kristang - a harsh, volcanic world with extreme weather and dangerous megafauna',
        government: 'A clan-based warrior hierarchy where power derives from combat prowess and the number of battles won. Clans constantly war with each other when not fighting external enemies. The strongest clan leader holds the title of War Master, but their authority is always contested.',
        society: 'Kristang culture revolves around honor, violence, and clan loyalty. They see the galaxy through a lens of dominance and submission - you are either a predator or prey. Personal honor is maintained through combat, and grudges are carried across generations. They were the first aliens to make contact with humanity, using humans as expendable infantry in their wars with the Ruhar.',
        technology: 'The lowest of the spacefaring races, relying heavily on technology provided by their Bosphuraq patrons. They excel at ground combat weapons and personal armor but struggle with advanced computing and energy systems. Their ships are functional but unsophisticated.',
        militaryDoctrine: 'Aggressive ground assault and overwhelming numbers. The Kristang prefer close combat and brutal direct engagements. Subtlety is considered cowardly. They use humans and other subordinate species as cannon fodder while Kristang warriors take the glory.',
        humanRelations: 'Humanity\'s primary antagonists. The Kristang view humans as expendable client-species tools and were furious when humans began asserting independence. They have repeatedly tried to subjugate or eliminate humanity. The hatred is mutual.',
        notableTraits: ['First alien contact with humans', 'Clan-based warrior society', 'Over 2 meters tall, immensely strong', 'Used humans as expendable soldiers', 'Ritual scarification traditions'],
    },
    wurgalan: {
        name: 'Wurgalan Enclave',
        nickname: 'Octopuses',
        tier: 3,
        coalition: 'independent',
        color: '#44ffcc',
        personality: 'cautious',
        description: 'Tentacled beings who prefer isolation. Defensive but possess unique biotech.',
        tradeGoods: ['bio-tech', 'tentacle-fiber'],
        shipPrefix: 'WGE',
        baseStanding: 0,
        aggressionLevel: 0.2,
        techLevel: 2,
        icon: '\u{1F419}',
        physicalDescription: 'Cephalopod beings with bulbous mantles and seven primary limbs, each lined with sensitive suckers capable of fine manipulation. Their skin can change color and texture for communication and camouflage. They have large, intelligent eyes and a beak-like mouth. They move with surprising grace both in water and on land using their limbs. Average body mass equivalent to a large human.',
        homeworld: 'Wurgalan - a water-world with scattered volcanic island chains and vast kelp-forest oceans',
        government: 'An authoritarian enclave governed by the Elder Mantle, a council of the oldest and most experienced Wurgalan. They are deeply xenophobic and maintain strict border controls. Contact with outsiders is tightly regulated through designated trade-speakers.',
        society: 'Wurgalan society is insular and suspicious of outsiders. They form tight-knit pods of 6-12 individuals who share an almost empathic bond through chromatophore communication. Their xenophobia stems from a historical trauma - an ancient betrayal by a now-extinct species. They are brilliant biologists and maintain the most advanced organic technology in their tier.',
        technology: 'Unique biotech specialists using living organisms engineered for specific functions - ships with organic hulls, weapons that fire biological projectiles, and communication systems based on bioluminescence. Their approach to technology is fundamentally different from every other species.',
        militaryDoctrine: 'Fortress defense. The Wurgalan rarely venture far from their territory but defend it with fanatical determination. Their bio-ships can regenerate damage and adapt to enemy weapons mid-battle. They use toxic chemical warfare and environmental manipulation.',
        humanRelations: 'Distant but not hostile. The Wurgalan have minimal interaction with humanity and prefer to keep it that way. They will trade biotech compounds but refuse deeper engagement. Some Wurgalan traders have expressed quiet respect for human tenacity.',
        notableTraits: ['Seven-limbed cephalopods', 'Color-changing chromatophore communication', 'Unique organic/biotech approach', 'Deeply xenophobic society', 'Bio-ships that self-repair'],
    },

    // =============================================
    // HUMAN FACTIONS
    // =============================================
    unef: {
        name: 'UNEF',
        nickname: 'United Nations Expeditionary Force',
        tier: 3,
        coalition: 'humanity',
        color: '#44ff88',
        personality: 'military',
        description: 'Earth\'s military force in the galactic conflict. Disciplined, resourceful, adapting to alien tech.',
        tradeGoods: ['earth-artifacts', 'military-rations'],
        shipPrefix: 'UNE',
        baseStanding: 4,
        aggressionLevel: 0.3,
        techLevel: 1,
        icon: '\u{1F30D}',
        physicalDescription: 'Standard humans from Earth, drawn from militaries worldwide. UNEF personnel wear standardized combat armor adapted from captured alien technology. They are identifiable by the blue-and-green Earth insignia on their equipment.',
        homeworld: 'Earth - currently under alien quarantine, with UNEF forces operating from Paradise (a Ruhar colony world)',
        government: 'Military command structure under a joint multinational council. Originally formed from national militaries pressed into alien service, UNEF has evolved into an independent fighting force answering to a coalition of Earth\'s governments. Chain of command is often complicated by politics.',
        society: 'UNEF is a melting pot of Earth\'s cultures forced to cooperate under extraordinary circumstances. Soldiers bond over shared alienation (literally) and the common cause of human survival. Morale is maintained through stubborn optimism and dark humor. They have adapted remarkably well to galactic warfare despite being the most technologically primitive species.',
        technology: 'The lowest-tech spacefaring group, relying on captured and adapted alien technology. What they lack in sophistication, they compensate for with creative improvisation and unconventional thinking. Human engineers have a talent for jury-rigging alien systems in ways their creators never intended.',
        militaryDoctrine: 'Adaptable and unconventional. UNEF forces excel at asymmetric warfare, improvised tactics, and doing the unexpected. Their greatest strength is creative problem-solving - they approach alien technology and tactics without preconceptions, finding solutions other species would never consider.',
        humanRelations: 'The main body of organized humanity in space. UNEF works closely with the Mavericks and maintains diplomatic ties with the Ruhar. They represent humanity\'s legitimate military presence in galactic affairs.',
        notableTraits: ['Lowest-tech spacefaring force', 'Masters of improvisation', 'Multinational military coalition', 'Stationed on Paradise colony', 'Adapted alien technology creatively'],
    },
    mavericks: {
        name: 'Mavericks',
        nickname: 'Skippy\'s Crew',
        tier: 3,
        coalition: 'humanity',
        color: '#00ffff',
        personality: 'irreverent',
        description: 'Elite pirate crew of the Flying Dutchman. Led by Joe Bishop with an ancient AI beer can named Skippy.',
        tradeGoods: ['alien-salvage', 'ancient-tech'],
        shipPrefix: 'MVK',
        baseStanding: 5,
        aggressionLevel: 0.2,
        techLevel: 3,
        icon: '\u{1F37A}',
        physicalDescription: 'A small, elite crew of humans operating with technology far beyond their species\' level, thanks to Skippy the Magnificent - an ancient Elder AI housed in a beer can-shaped container. The crew wears mismatched gear from a dozen species, often jury-rigged with Skippy\'s modifications.',
        homeworld: 'The Flying Dutchman - a captured Thuranin star carrier that serves as their mobile base of operations',
        government: 'Informal military hierarchy led by Colonel Joe Bishop, with Skippy serving as an extremely opinionated technical advisor. Decisions are made through a combination of military discipline and chaotic improvisation. Skippy frequently overrides plans he considers "stupid monkey ideas."',
        society: 'The Mavericks are a tight-knit crew bonded by impossible missions and mutual trust forged in crisis. Their culture is defined by dark humor, audacious plans, and the constant tension between Joe\'s cautious leadership and Skippy\'s impatient genius. They are humanity\'s most effective fighting force despite numbering fewer than a hundred individuals.',
        technology: 'Dramatically enhanced by Skippy\'s Elder-level technological abilities. Their captured Thuranin star carrier has been upgraded with capabilities that rival Tier 1 species. Skippy can manipulate spacetime, hack any computer system, and fabricate technology from raw materials. The limiting factor is usually Skippy\'s willingness to help.',
        militaryDoctrine: 'Audacious deception operations and impossible missions. The Mavericks specialize in making enemy forces believe things that aren\'t true, manipulating wormholes, and pulling off schemes so outrageous that no rational species would anticipate them. Their motto might as well be "hold my beer."',
        humanRelations: 'Heroes to humanity, though few people know the full truth of their operations. They work alongside UNEF but operate independently on classified missions that shape the fate of the galaxy. Joe Bishop is perhaps the most important human alive, though he\'d rather be eating a cheeseburger.',
        notableTraits: ['Possess an Elder AI (Skippy)', 'Crew of the Flying Dutchman', 'Led by Colonel Joe Bishop', 'Specialize in impossible missions', 'Technology rivals Tier 1 species'],
    },
    keepers: {
        name: 'Keepers of the Faith',
        nickname: 'Zealots',
        tier: 3,
        coalition: 'humanity',
        color: '#ffff44',
        personality: 'zealous',
        description: 'Religious human faction seeking meaning in the galactic conflict. Devoted but unpredictable.',
        tradeGoods: ['relics', 'devotional-texts'],
        shipPrefix: 'KOF',
        baseStanding: 2,
        aggressionLevel: 0.35,
        techLevel: 1,
        icon: '\u{2721}',
        physicalDescription: 'Humans who wear distinctive robes and symbols over their combat gear, marking them as members of various faith traditions united under a common banner. Their equipment often bears religious iconography and blessing inscriptions.',
        homeworld: 'Scattered across human settlements - no single base of operations',
        government: 'A council of faith leaders from diverse religious traditions who found common ground in humanity\'s cosmic predicament. Leadership is spiritual rather than military, though they maintain capable armed forces. Internal politics can be fractious when different faith traditions disagree.',
        society: 'The Keepers believe humanity\'s sudden entry into galactic civilization has profound spiritual meaning. They seek to understand the Elders, Skippy, and the galactic order through the lens of faith. While other factions focus on survival, the Keepers ask "why?" Their devotion provides comfort to many humans struggling with the overwhelming scale of the galaxy.',
        technology: 'Standard human-level with some Ruhar-provided equipment. They invest in exploration and archaeological technology, driven by a desire to find Elder artifacts and understand their significance. Their ships are functional but not remarkable.',
        militaryDoctrine: 'Defensive and protective. The Keepers fight to defend their communities and holy sites. Their faith provides exceptional morale - Keeper units are known for holding positions long after other forces would retreat. They can be unpredictable, occasionally taking actions based on spiritual conviction rather than military logic.',
        humanRelations: 'A stabilizing force for human morale but sometimes at odds with UNEF and the Mavericks over strategy. They provide chaplain services, maintain human cultural traditions, and remind soldiers what they\'re fighting for. Their relationship with Skippy is complicated - some Keepers consider the Elder AI sacred.',
        notableTraits: ['Multi-faith religious coalition', 'Seek spiritual meaning in galactic events', 'Exceptional morale in combat', 'Study Elder artifacts', 'Complex relationship with Skippy'],
    },
};

// =============================================
// FACTION SHIP VARIANTS
// =============================================
// Which base ships each faction produces at their stations

export const FACTION_SHIP_VARIANTS = {
    kristang:  ['slasher', 'rifter', 'thrasher', 'thorax', 'hurricane', 'maelstrom'],
    ruhar:     ['venture', 'heron', 'slasher', 'vigil', 'caracal', 'drake'],
    jeraptha:  ['heron', 'vigil', 'caracal', 'drake', 'raven', 'scorpion'],
    thuranin:  ['slasher', 'corax', 'caracal', 'ferox', 'raven', 'scorpion'],
    bosphuraq: ['slasher', 'rifter', 'thrasher', 'thorax', 'hurricane'],
    esselgin:  ['vigil', 'prospect', 'corax', 'caracal', 'naga'],
    wurgalan:  ['venture', 'procurer', 'vigil', 'drake', 'brutix'],
    maxolhx:   ['slasher', 'rifter', 'thrasher', 'corax', 'caracal', 'ferox', 'hurricane', 'drake', 'raven', 'scorpion', 'maelstrom', 'naglfar'],
    rindhalu:  ['drake', 'hurricane', 'raven', 'scorpion', 'maelstrom'],
    unef:      ['venture', 'heron', 'slasher', 'vigil', 'caracal'],
    mavericks: ['slasher', 'heron', 'vigil', 'caracal'],
    keepers:   ['venture', 'slasher', 'vigil', 'caracal'],
};

// Stat scaling per faction tier + flavor bonuses
export const FACTION_TECH_BONUSES = {
    // Tier 3 - Client Races (base power)
    kristang:  { tierScale: 1.00, shieldMult: 0.90, armorMult: 1.05, speedMult: 1.00, damageMult: 1.15, capMult: 0.95, flavor: 'Kinetic specialists' },
    ruhar:     { tierScale: 1.00, shieldMult: 1.10, armorMult: 1.00, speedMult: 1.10, damageMult: 1.00, capMult: 1.00, flavor: 'Shield & speed balanced' },
    wurgalan:  { tierScale: 1.00, shieldMult: 1.05, armorMult: 1.05, speedMult: 0.95, damageMult: 0.95, capMult: 1.10, flavor: 'Biotech drones' },
    unef:      { tierScale: 1.00, shieldMult: 1.00, armorMult: 1.00, speedMult: 1.00, damageMult: 1.00, capMult: 1.00, flavor: 'Standard human tech' },
    mavericks: { tierScale: 1.00, shieldMult: 1.00, armorMult: 0.95, speedMult: 1.15, damageMult: 1.05, capMult: 1.00, flavor: 'Skippy-enhanced' },
    keepers:   { tierScale: 1.00, shieldMult: 1.05, armorMult: 1.00, speedMult: 0.95, damageMult: 1.00, capMult: 1.05, flavor: 'Faith-hardened' },
    // Tier 2 - Patron Races (20% stronger)
    jeraptha:  { tierScale: 1.20, shieldMult: 1.10, armorMult: 1.00, speedMult: 1.05, damageMult: 1.05, capMult: 1.10, flavor: 'Trade-grade shields' },
    thuranin:  { tierScale: 1.20, shieldMult: 1.00, armorMult: 1.00, speedMult: 0.95, damageMult: 1.15, capMult: 1.10, flavor: 'Precision weapons' },
    bosphuraq: { tierScale: 1.20, shieldMult: 0.95, armorMult: 1.05, speedMult: 1.15, damageMult: 1.10, capMult: 0.95, flavor: 'Attack vectors' },
    esselgin:  { tierScale: 1.20, shieldMult: 1.00, armorMult: 1.00, speedMult: 1.10, damageMult: 1.00, capMult: 1.15, flavor: 'EWAR specialists' },
    // Tier 1 - Elder Races (40% stronger)
    maxolhx:   { tierScale: 1.40, shieldMult: 1.10, armorMult: 1.10, speedMult: 1.10, damageMult: 1.15, capMult: 1.10, flavor: 'Apex technology' },
    rindhalu:  { tierScale: 1.40, shieldMult: 1.15, armorMult: 1.05, speedMult: 1.05, damageMult: 1.10, capMult: 1.20, flavor: 'Ancient webtech' },
};

/**
 * Apply faction overlay to a base ship config, scaling stats by tier and faction bonuses.
 * Returns a new config object (doesn't mutate original).
 * @param {Object} baseShip - Ship config from SHIP_DATABASE
 * @param {string} baseShipId - Ship ID key
 * @param {string} factionId - Faction ID
 * @returns {Object} Modified ship config with faction overlay
 */
export function applyFactionOverlay(baseShip, baseShipId, factionId) {
    const faction = FACTIONS[factionId];
    const bonuses = FACTION_TECH_BONUSES[factionId];
    if (!faction || !bonuses || !baseShip) return baseShip;

    const ts = bonuses.tierScale;
    const prefix = faction.shipPrefix;

    return {
        ...baseShip,
        name: `${prefix} ${baseShip.name}`,
        factionId: factionId,
        factionVariant: true,
        basedOn: baseShipId,
        // Scale defenses
        shield: Math.round(baseShip.shield * ts * bonuses.shieldMult),
        armor: Math.round(baseShip.armor * ts * bonuses.armorMult),
        hull: Math.round(baseShip.hull * ts),
        // Scale mobility
        maxSpeed: Math.round(baseShip.maxSpeed * bonuses.speedMult),
        // Scale power
        capacitor: Math.round(baseShip.capacitor * ts * bonuses.capMult),
        capacitorRegen: +(baseShip.capacitorRegen * ts * bonuses.capMult).toFixed(1),
        // Scale damage output
        damageMultiplier: bonuses.damageMult || 1.0,
        // Scale price
        price: Math.round(baseShip.price * ts * 1.1),
    };
}

/**
 * Get faction-specific ship catalog for a station vendor.
 * @param {string} factionId - Faction controlling the station
 * @param {Object} shipDatabase - Full SHIP_DATABASE
 * @returns {Array<[string, Object]>} Array of [shipId, factionOverlayConfig] pairs
 */
export function getFactionShipCatalog(factionId, shipDatabase) {
    const variants = FACTION_SHIP_VARIANTS[factionId];
    if (!variants) {
        // No faction or generic: return all ships as-is
        return Object.entries(shipDatabase);
    }

    const catalog = [];
    for (const shipId of variants) {
        const base = shipDatabase[shipId];
        if (!base) continue;
        const overlaid = applyFactionOverlay(base, shipId, factionId);
        catalog.push([`${factionId}-${shipId}`, overlaid]);
    }
    return catalog;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get standing label and color for a numeric standing value
 */
export function getStandingInfo(standing) {
    for (const [key, threshold] of Object.entries(STANDING_THRESHOLDS)) {
        if (standing >= threshold.min && standing < threshold.max) {
            return { key, ...threshold };
        }
    }
    if (standing >= 5) return { key: 'ALLIED', ...STANDING_THRESHOLDS.ALLIED };
    return { key: 'HOSTILE', ...STANDING_THRESHOLDS.HOSTILE };
}

/**
 * Get the coalition a faction belongs to
 */
export function getFactionCoalition(factionId) {
    const faction = FACTIONS[factionId];
    if (!faction) return null;
    return COALITIONS[faction.coalition] || null;
}

/**
 * Get all factions in a coalition
 */
export function getCoalitionFactions(coalitionId) {
    const coalition = COALITIONS[coalitionId];
    if (!coalition) return [];
    return coalition.members.map(id => ({ id, ...FACTIONS[id] })).filter(f => f.name);
}

/**
 * Calculate standing change with coalition spillover
 * @param {string} factionId - Faction whose standing changed
 * @param {number} delta - Standing change amount
 * @returns {Object} Map of factionId -> delta (includes spillover)
 */
export function calculateStandingChanges(factionId, delta) {
    const changes = { [factionId]: delta };
    const faction = FACTIONS[factionId];
    if (!faction) return changes;

    const coalition = COALITIONS[faction.coalition];
    if (!coalition) return changes;

    // Positive spillover to coalition members
    for (const memberId of coalition.members) {
        if (memberId === factionId) continue;
        changes[memberId] = delta * coalition.spilloverMultiplier;
    }

    // Negative spillover to rival coalitions
    const relations = COALITION_RELATIONS[faction.coalition];
    if (relations) {
        for (const [rivalCoalId, hostilityMod] of Object.entries(relations)) {
            if (hostilityMod === 0) continue;
            const rivalCoal = COALITIONS[rivalCoalId];
            if (!rivalCoal) continue;
            for (const rivalId of rivalCoal.members) {
                // If delta is positive (gained standing), rivals lose standing proportionally
                // If delta is negative (lost standing), rivals gain standing proportionally
                const rivalDelta = -delta * Math.abs(hostilityMod) * 0.5;
                changes[rivalId] = (changes[rivalId] || 0) + rivalDelta;
            }
        }
    }

    return changes;
}

/**
 * Get a faction's standing-based price modifier
 * @param {number} standing - Current standing with the faction
 * @returns {number} Price multiplier (< 1.0 = discount, > 1.0 = markup)
 */
export function getStandingPriceModifier(standing) {
    if (standing >= 5) return 0.90;    // Allied: 10% discount
    if (standing >= 2) return 0.95;    // Friendly: 5% discount
    if (standing >= -2) return 1.00;   // Neutral: no change
    if (standing >= -5) return 1.10;   // Unfriendly: 10% markup
    return 1.25;                        // Hostile: 25% markup
}

/**
 * Get all factions as an array with IDs
 */
export function getAllFactions() {
    return Object.entries(FACTIONS).map(([id, faction]) => ({ id, ...faction }));
}

/**
 * Get faction by ID
 */
export function getFaction(factionId) {
    return FACTIONS[factionId] || null;
}

/**
 * Initialize default standings for a new player
 * @returns {Object} Map of factionId -> standing
 */
export function getDefaultStandings() {
    const standings = {};
    for (const [id, faction] of Object.entries(FACTIONS)) {
        standings[id] = faction.baseStanding;
    }
    return standings;
}
