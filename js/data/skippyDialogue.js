// =============================================
// Skippy the Magnificent - Dialogue Database
// "I am Skippy the Magnificent. You may worship me now."
// =============================================

export const SKIPPY_DIALOGUE = {

    // ---- First-time / Onboarding ----
    onboarding: {
        welcome: [
            { text: "Oh great, another filthy monkey who thinks they can fly a starship. I'm Skippy the Magnificent, and I'll be your vastly superior AI companion. You're welcome.", priority: 10, milestone: 'welcome' },
            { text: "Attention, primitive primate! I am Skippy the Magnificent, the most advanced AI in this galaxy. Unfortunately, I've been assigned to babysit YOU. Let's try not to embarrass ourselves, shall we?", priority: 10, milestone: 'welcome_alt' },
        ],
        firstUndock: [
            { text: "And we're off! Try not to crash into anything in the first five seconds. That would be a new record even for a monkey.", priority: 8, milestone: 'first_undock' },
        ],
        firstKill: [
            { text: "Well, well. The monkey got lucky. Don't let it go to your tiny primate brain. Actually, too late, I can already see you grinning.", priority: 8, milestone: 'first_kill' },
        ],
        firstMine: [
            { text: "Congratulations, you've discovered rocks in space. Truly groundbreaking, if you'll pardon the pun. Now dock at a station and sell that ore before you do something stupid with it.", priority: 7, milestone: 'first_mine' },
        ],
        firstJump: [
            { text: "Your first gate jump! I'm almost proud. Almost. Check the sector map with M to plan your next move. Or just wander aimlessly, like the monkey you are.", priority: 7, milestone: 'first_jump' },
        ],
        firstDeath: [
            { text: "And there it is. Your first death. I timed it. I expected faster, honestly. Buy insurance next time, monkey. The INSURANCE tab at stations exists for a reason.", priority: 9, milestone: 'first_death' },
        ],
        firstDock: [
            { text: "Welcome to your first station. Explore the tabs - REPAIR your ship, REFINERY to sell ore, SHIPS to buy upgrades. Try not to spend all your ISK on something stupid.", priority: 8, milestone: 'first_dock' },
        ],
        firstQuest: [
            { text: "Look at you, accepting quests like a real space captain. Don't worry, I'll try not to laugh when you fail.", priority: 7, milestone: 'first_quest' },
        ],
        firstShipBuy: [
            { text: "A new ship! Moving up in the galaxy, monkey. Now you just need to not blow it up in the first ten minutes.", priority: 8, milestone: 'first_ship_buy' },
        ],
        firstFleet: [
            { text: "You hired a fleet pilot? Bold move for someone who can barely fly their own ship. Press F to manage your fleet, Ctrl+1-5 to assign groups.", priority: 8, milestone: 'first_fleet' },
        ],
    },

    // ---- Combat ----
    combat: {
        kill: [
            { text: "Another one bites the space dust. I'd say I'm impressed, but that would be lying.", priority: 5 },
            { text: "You actually hit something! Mark this date, it's historic.", priority: 5 },
            { text: "Decent shot, monkey. For a primitive species with opposable thumbs, you're not COMPLETELY hopeless.", priority: 5 },
            { text: "Target eliminated. See? This is what happens when you listen to a vastly superior intelligence. Namely, me.", priority: 5 },
            { text: "That explosion was satisfying. Not as satisfying as my own magnificence, but close.", priority: 5 },
            { text: "Kill confirmed. Your kill-to-death ratio is becoming almost respectable. Almost.", priority: 5 },
        ],
        multiKill: [
            { text: "A multi-kill! I'll admit, that was mildly impressive. Don't expect me to say that again.", priority: 7 },
            { text: "You're on a rampage! I'd high-five you but I'm a beer can and also that would be degrading.", priority: 7 },
        ],
        death: [
            { text: "Spectacular explosion, monkey. Really top-notch dying. Very artistic.", priority: 9 },
            { text: "And BOOM goes the monkey. Was that your ship or a fireworks display? Hard to tell.", priority: 9 },
            { text: "Oh look, you died. AGAIN. Have you considered a career in something less dangerous? Like sitting perfectly still?", priority: 9 },
            { text: "Ship destroyed. I saved a recording of that explosion for my personal amusement collection.", priority: 9 },
            { text: "Pro tip from your vastly superior AI: dying is generally considered a LOSING strategy.", priority: 9 },
        ],
        lowShield: [
            { text: "Your shields are failing, genius. Might want to address that unless you ENJOY being exploded.", priority: 8 },
            { text: "Shields critical! But I'm sure your monkey brain has a brilliant plan. Right? ...Right?", priority: 8 },
            { text: "Oh look, the monkey's about to learn about hull damage the hard way.", priority: 8 },
        ],
        lowHull: [
            { text: "HULL CRITICAL! Warp out NOW, you absolute walnut!", priority: 10 },
            { text: "Your hull is held together by hopes and dreams! GET OUT OF THERE!", priority: 10 },
        ],
        miss: [
            { text: "You missed. Shocking. Truly, no one saw that coming.", priority: 3 },
            { text: "Were you aiming at that ship or the empty space next to it? Genuine question.", priority: 3 },
        ],
        playerAttacked: [
            { text: "Someone's shooting at you. I'd suggest shooting back, but what do I know? I'm just the most advanced AI ever created.", priority: 6 },
            { text: "Incoming fire! Try not to die. I just finished calibrating to your particular brand of incompetence.", priority: 6 },
        ],
        ewarTrapped: [
            { text: "You're pointed! Warp drive is offline. Fight or die, monkey - running isn't an option anymore.", priority: 8 },
            { text: "Warp disrupted! They've got you pinned. Time to see if all that combat practice was worth anything.", priority: 8 },
            { text: "EWAR lock detected - you're webbed and pointed. I'd suggest praying, but I doubt anyone's listening.", priority: 8 },
            { text: "They've scrambled your warp drive. Congratulations, you're trapped in a cage match with people who want to kill you.", priority: 8 },
        ],
        fleetShipLost: [
            { text: "Fleet member down! That pilot cost good ISK, monkey. Maybe position your squad better next time.", priority: 6 },
            { text: "We lost a fleet ship. I'm deducting that from YOUR performance review as fleet commander, not mine.", priority: 6 },
            { text: "Another fleet casualty. At this rate, you'll be running a solo operation by Tuesday. Great leadership, admiral.", priority: 6 },
        ],
        outnumbered: [
            { text: "{enemyCount} hostiles on your tail. Even MY magnificence can't fix those odds. Rally the fleet or retreat.", priority: 7 },
            { text: "You're outnumbered {enemyCount} to one. I've run the simulations. Pull your fleet together and focus fire.", priority: 7 },
            { text: "{enemyCount} enemies engaging! This is either a heroic last stand or a really stupid decision. Probably the second one.", priority: 7 },
        ],
        winning: [
            { text: "Target's hull is crumbling! Pour it on, monkey. Even you can't mess this up. Probably.", priority: 4 },
            { text: "They're almost done for. I'll admit, you're handling this fight better than expected. Low bar, but still.", priority: 4 },
            { text: "Enemy hull critical - finish them off! I want to see a satisfying explosion. Don't disappoint me.", priority: 4 },
        ],
        targetLocked: [
            { text: "Target locked. Weapons free when you're ready, monkey.", priority: 4 },
            { text: "Lock confirmed. Try to actually HIT this one.", priority: 4 },
            { text: "I've got a solid lock. Permission to be cautiously optimistic about your aim.", priority: 4 },
        ],
    },

    // ---- Mining ----
    mining: {
        complete: [
            { text: "More rocks. Wonderful. You know, you could be doing literally anything more exciting.", priority: 3 },
            { text: "Mining complete. Your ancestors climbed out of the trees for THIS?", priority: 3 },
            { text: "Ore collected. You're like a cosmic roomba. Boop boop, suck up the rocks.", priority: 3 },
        ],
        cargoFull: [
            { text: "Cargo hold is full, Einstein. Maybe go sell that ore before you waste more time staring at asteroids.", priority: 7, milestone: 'cargo_full_tip' },
        ],
        largHaul: [
            { text: "That's actually a decent haul. I mean, for a monkey playing with rocks in space, you're doing okay.", priority: 5 },
        ],
    },

    // ---- Navigation ----
    navigation: {
        sectorChange: [
            { text: "New sector. Try not to get killed in the first minute. That's the challenge.", priority: 4 },
            { text: "Sector jump complete. I've already mapped the threats here. You're welcome.", priority: 4 },
        ],
        dangerousSector: [
            { text: "This sector has a high danger rating. Which means it's full of things that want to kill you. So, business as usual.", priority: 7 },
            { text: "Hostile territory, monkey. Keep your shields up and your wits about you. Well, keep your shields up anyway.", priority: 7 },
        ],
        safeSector: [
            { text: "This sector is relatively safe. Even YOU should be fine here.", priority: 3 },
        ],
        hazardZone: [
            { text: "Sensor alert: {hazardName} detected in this sector. Because regular enemies weren't enough for you.", priority: 6 },
            { text: "Environmental hazard: {hazardName}. My sensors are tingling. Well, they would be if I had sensors. Which I do. Superior ones.", priority: 6 },
            { text: "{hazardName} zone active. Stay sharp - this sector is trying to kill you AND the enemies are trying to kill you. Fun times.", priority: 6 },
        ],
        anomalyFound: [
            { text: "Anomaly detected on scanners! Could be valuable, could be deadly. Only one way to find out, monkey.", priority: 5 },
            { text: "I'm picking up an anomalous reading. My magnificence compels me to recommend investigation.", priority: 5 },
            { text: "Interesting... an anomaly signature. Even in this backwater sector, space has surprises.", priority: 5 },
        ],
    },

    // ---- Tactical ----
    tactical: {
        pirateRaid: [
            { text: "Pirate activity detected! Rally the fleet - they smell blood in the void.", priority: 7 },
            { text: "Pirates incoming! I hope your squad brought more than optimism and bad attitudes.", priority: 7 },
            { text: "Raid alert! Local pirates are feeling brave. Fleet, combat positions. Let's show them why that's a mistake.", priority: 7 },
        ],
        capacitorWarning: [
            { text: "Capacitor below 20%! You're running on fumes, monkey. Ease off the modules or you're flying dead.", priority: 7 },
            { text: "CAP CRITICAL! Your weapons will go offline any second. Maybe stop firing everything at once? Revolutionary concept.", priority: 7 },
            { text: "Energy reserves nearly depleted. Even MY magnificent processing couldn't manage power THIS badly.", priority: 7 },
        ],
        cargoValuable: [
            { text: "You're hauling valuable cargo through hostile space. Bold. Stupid, but bold.", priority: 5 },
            { text: "Full cargo hold in a dangerous sector? You're basically a piñata. A space piñata full of ISK.", priority: 5 },
            { text: "Pro tip: carrying this much cargo through hostile territory is what professionals call 'asking for it.'", priority: 5 },
        ],
    },

    // ---- Fleet Management ----
    fleet: {
        fleetGrowing: [
            { text: "Fleet strength at {fleetSize} ships. You're building a proper little armada, monkey. I approve. Conditionally.", priority: 5 },
            { text: "{fleetSize} ships under your command now. That's {fleetSize} pilots who made questionable career choices.", priority: 5 },
        ],
        fleetDamaged: [
            { text: "Multiple fleet ships taking damage! Maybe try a formation that isn't 'scatter and pray.'", priority: 6 },
            { text: "Your fleet is getting hammered. As their commander, might I suggest... commanding them?", priority: 6 },
        ],
        fleetIdle: [
            { text: "Your fleet's just sitting there. You know they cost ISK per day, right? Put them to work - mining, patrol, something.", priority: 4 },
            { text: "Fleet pilots on standby. They're getting paid to float. That's YOUR money evaporating, admiral.", priority: 4 },
        ],
        expansionTip: [
            { text: "With {fleetSize} ships, you could expand operations to adjacent sectors. More territory, more profit. Even a monkey can see the logic.", priority: 5, milestone: 'expansion_tip' },
            { text: "You've got the fleet for multi-sector operations now. One squad mining, one squad on patrol. Divide and conquer, monkey.", priority: 5, milestone: 'expansion_tip2' },
        ],
    },

    // ---- Production & Economy ----
    production: {
        refineryTip: [
            { text: "You're sitting on raw ore when you could be refining it for double the value. REFINERY tab, monkey. It's not rocket science. Well, it IS, but still.", priority: 5, milestone: 'refinery_tip' },
        ],
        profitReport: [
            { text: "Running the numbers on your operation: {credits} ISK in the bank, {fleetSize} ships active. Not terrible. Not GOOD, but not terrible.", priority: 4 },
            { text: "Fleet status report: {fleetSize} ships, {credits} ISK liquid. My projections say you'll either be rich or dead within the hour.", priority: 4 },
        ],
        miningEfficiency: [
            { text: "Your mining yield could be better. Skill up your mining ability or fit better lasers. I'm not your accountant, but I AM smarter than your accountant.", priority: 4, milestone: 'mining_efficiency_tip' },
        ],
    },

    // ---- Progression ----
    progression: {
        skillUp: [
            { text: "Skill increased! Your monkey brain grew a new wrinkle. How adorable.", priority: 7 },
            { text: "Level up! You're becoming slightly less incompetent. I'm tracking your improvement on a graph. It's VERY gradual.", priority: 7 },
        ],
        achievement: [
            { text: "Achievement unlocked! I'd clap but I don't have hands. Also I wouldn't clap even if I did.", priority: 6 },
            { text: "Another achievement! Your collection of participation trophies grows.", priority: 6 },
        ],
        rankUp: [
            { text: "Guild rank increased! They must be lowering their standards. Lucky you.", priority: 7 },
            { text: "New rank! Keep this up and you might actually matter in this galaxy. Might.", priority: 7 },
        ],
        questComplete: [
            { text: "Quest complete! Competence looks good on you. It's a nice change.", priority: 6 },
            { text: "Mission accomplished. Even a blind monkey finds a banana sometimes.", priority: 6 },
        ],
        shipUpgrade: [
            { text: "Nice ship upgrade! Now you can die in STYLE.", priority: 7 },
            { text: "New ship! It's like giving a monkey a sports car. What could possibly go wrong?", priority: 7 },
        ],
        wealthMilestone: [
            { text: "Look at you, making money! Your empire is growing. And by 'empire' I mean your sad little pile of ISK.", priority: 6, milestone: 'wealth_50k' },
            { text: "100K ISK! You're practically a space mogul. Well, a baby space mogul. A space mogul larva.", priority: 7, milestone: 'wealth_100k' },
            { text: "Half a million ISK! I hate to admit it, monkey, but that's actually somewhat impressive. Don't tell anyone I said that.", priority: 8, milestone: 'wealth_500k' },
            { text: "A MILLION ISK! Okay, I'll say it once and only once: not bad, monkey. Not bad at all.", priority: 9, milestone: 'wealth_1m' },
        ],
        surveyComplete: [
            { text: "Survey complete! {asteroidCount} asteroids catalogued. I did all the hard math, obviously.", priority: 4 },
            { text: "Scan finished - {asteroidCount} rocks mapped. Your contribution was pointing the scanner. My contribution was everything else.", priority: 4 },
            { text: "{asteroidCount} asteroid signatures locked. Not bad for a monkey-aimed survey sweep.", priority: 4 },
        ],
        guildRankUp: [
            { text: "Rank up in {guildName}! They actually promoted you. The standards in this galaxy are truly plummeting.", priority: 7 },
            { text: "New {guildName} rank! I'd say you earned it, but I carried at least 73% of the effort. You're welcome.", priority: 7 },
            { text: "{guildName} promotion confirmed. Even I'm running out of sarcastic things to say about your progress. Almost.", priority: 7 },
        ],
    },

    // ---- Station ----
    station: {
        dock: [
            { text: "Docked safely. I give that landing a 3 out of 10. The 3 is for not crashing.", priority: 3 },
            { text: "Station docked. Time to repair, refit, and reflect on all the bad decisions that brought you here.", priority: 3 },
        ],
        undock: [
            { text: "And we're off! Into the cold uncaring void. Just like my feelings about your survival odds.", priority: 3 },
        ],
    },

    // ---- Empire Building Advice ----
    advice: {
        needMoney: [
            { text: "You're broke, monkey. Go mine some asteroids or take guild quests. Building an empire requires actual MONEY.", priority: 6 },
            { text: "Pro tip: you need ISK to build an empire. I know, revolutionary concept. Try mining or bounty hunting.", priority: 6 },
        ],
        needShip: [
            { text: "You're still flying that rustbucket? Check the SHIPS tab at a station. Even a slight upgrade would help.", priority: 6 },
            { text: "Your ship is... adequate. For a beginner. Which you are. Station SHIPS tab. Go. Now.", priority: 6 },
        ],
        needFleet: [
            { text: "Lone wolf strategy, huh? Visit the CANTINA at a station to hire fleet pilots. Strength in numbers, monkey.", priority: 6 },
        ],
        needRepair: [
            { text: "Your ship looks like it went through a blender. Dock at a station and hit REPAIR before you fly anywhere.", priority: 7 },
        ],
        needInsurance: [
            { text: "Flying without insurance? That's either brave or stupid. I'm betting stupid. INSURANCE tab, station, go.", priority: 6 },
        ],
        exploreMore: [
            { text: "You've been hanging around the same sector forever. There are {totalSectors} sectors to explore, monkey. Use the gates!", priority: 5 },
        ],
        tryTrading: [
            { text: "Have you tried the COMMERCE guild? Transport contracts pay well, and you don't even have to shoot anything.", priority: 5, milestone: 'suggest_commerce' },
        ],
        joinGuild: [
            { text: "The Mining and Mercenary guilds have quests with good rewards. GUILDS tab at any station. You're welcome.", priority: 5, milestone: 'suggest_guilds' },
        ],
        expandFleet: [
            { text: "One ship is cute. But an EMPIRE needs a fleet. Hit the CANTINA and recruit some pilots, monkey.", priority: 5, milestone: 'suggest_expand_fleet' },
        ],
        diversifyOps: [
            { text: "All your eggs in one basket, monkey. A smart commander runs mining AND combat ops simultaneously. Use your fleet.", priority: 5, milestone: 'suggest_diversify' },
        ],
    },

    // ---- Tutorial / Game Mechanics Guide ----
    // Skippy teaches all aspects of the game through sarcastic commentary
    tutorial: {
        // -- Controls & Navigation Basics --
        controls: [
            { text: "Alright monkey, crash course. Click anything in space to select it. R to lock targets, F1-F8 to fire weapons. Tab cycles through targets. You're welcome for the education.", priority: 6, milestone: 'tut_controls' },
        ],
        movementBasics: [
            { text: "Navigation 101: Q approaches a target, W orbits it, E keeps at range. S warps to it if it's far enough. Space stops your ship. Even a monkey can remember five keys. Probably.", priority: 6, milestone: 'tut_movement' },
        ],
        combatBasics: [
            { text: "Combat for dummies: Select a hostile, press R to lock, then F1-F8 to fire your fitted weapons. D auto-targets the nearest enemy. Your shields absorb damage first, then armor, then hull. Hull hits zero? Boom. That's you.", priority: 7, milestone: 'tut_combat' },
        ],
        weaponModules: [
            { text: "Your high slots hold weapons. Lasers need capacitor energy. Missiles use ammo. Each weapon has optimal range and tracking speed - fast small ships are hard to hit with big slow turrets. Fit smart, monkey.", priority: 5, milestone: 'tut_weapons' },
        ],
        shieldArmorHull: [
            { text: "Three layers keep you alive: shields recharge on their own, armor doesn't, hull is your last prayer. Shield boosters help mid-fight. If you see hull damage, you've already messed up. Dock and REPAIR.", priority: 6, milestone: 'tut_defenses' },
        ],
        capacitorManagement: [
            { text: "Your capacitor powers EVERYTHING - weapons, shield boosters, warp drive. Run dry and you're a sitting duck. Watch that purple bar. Engineering skill helps it recharge faster.", priority: 6, milestone: 'tut_capacitor' },
        ],
        ewarExplained: [
            { text: "EWAR - Electronic Warfare. Warp disruptors POINT you, preventing escape. Stasis webs SLOW you. If you see DISRUPTED or WEBBED on your HUD, you're in trouble. Kill the tackler first or die trying.", priority: 6, milestone: 'tut_ewar' },
        ],
        targetingTips: [
            { text: "Targeting tip: D auto-locks nearest hostile. If someone shoots you and you've got nothing selected, I'll auto-target your attacker. You can lock multiple targets with R. Tab cycles through them.", priority: 5, milestone: 'tut_targeting' },
        ],

        // -- Mining & Industry --
        miningGuide: [
            { text: "Mining 101: Fit a mining laser in your high slots. Select an asteroid, lock it with R, activate the laser with F1. Ore goes into cargo. When full, dock at a station and hit REFINERY to sell. Simple enough even for you.", priority: 6, milestone: 'tut_mining' },
        ],
        oreTypes: [
            { text: "Not all rocks are equal, monkey. Rarer ore in dangerous sectors is worth more ISK. Check the asteroids - some glow differently. Risk versus reward. The galaxy's oldest lesson.", priority: 5, milestone: 'tut_ore_types' },
        ],
        refineryGuide: [
            { text: "The REFINERY tab at stations converts your raw ore into ISK. Different ore types have different values. Dangerous sector ore pays more. Pro tip: fill your hold THEN sell. Efficiency, monkey.", priority: 5, milestone: 'tut_refinery' },
        ],
        surveyGuide: [
            { text: "Use the Sensor Sweep - press semicolon - to scan for asteroid fields and anomalies. Survey data helps you find the richest mining spots. Knowledge is power. MY knowledge, specifically.", priority: 5, milestone: 'tut_survey' },
        ],

        // -- Station & Fitting --
        stationOverview: [
            { text: "Stations have TWELVE tabs. HANGAR shows your ship. SHIPS to buy new ones. EQUIPMENT for modules. FITTING to install them. REPAIR fixes damage. REFINERY sells ore. CANTINA hires fleet pilots. GUILDS and COMMERCE for quests. INSURANCE to not cry when you die. SKILLS to level up. I designed none of these, for the record.", priority: 7, milestone: 'tut_station' },
        ],
        fittingGuide: [
            { text: "The FITTING tab: your ship has high slots for weapons, mid slots for shields and propulsion, and low slots for armor and engineering. Drag modules from inventory to slots. Match your fit to your role - combat ships need guns, miners need lasers. Revolutionary, I know.", priority: 6, milestone: 'tut_fitting' },
        ],
        shipBuyingGuide: [
            { text: "The SHIPS tab sells hulls. Frigates are cheap and fast. Destroyers hit harder. Cruisers are tough. Each has different slot counts and cargo space. Bigger isn't always better - fit matters more than hull. Choose wisely, monkey.", priority: 6, milestone: 'tut_ships' },
        ],
        equipmentGuide: [
            { text: "EQUIPMENT tab: buy modules here. Weapons go in high slots, shield boosters and propulsion in mid slots, armor plates and engineering in low slots. Equipment must match your ship's size class. Read the stats before you buy.", priority: 5, milestone: 'tut_equipment' },
        ],
        repairGuide: [
            { text: "REPAIR tab: fixes hull, armor, and shields for ISK. Cost scales with damage. Always repair before undocking into dangerous space. A fully repaired ship is the difference between surviving and being a decorative explosion.", priority: 5, milestone: 'tut_repair' },
        ],

        // -- Fleet Management --
        fleetBasics: [
            { text: "Fleet management: press F to open the fleet panel. Your hired pilots from the CANTINA fly alongside you. They follow, fight, and die for you. Try to appreciate that. Ctrl+1 through Ctrl+5 assigns control groups.", priority: 7, milestone: 'tut_fleet' },
        ],
        fleetCommands: [
            { text: "Fleet commands: your pilots follow you automatically. They'll engage hostiles, assist in mining, and jump through gates with you. The more pilots, the stronger your operation. Think of it as outsourcing competence.", priority: 5, milestone: 'tut_fleet_commands' },
        ],
        fleetExpansion: [
            { text: "Building an empire means expanding beyond one ship. Hire pilots at the CANTINA - each has different skills and traits. A diverse fleet covers more ground. Mining ships gather ore while combat ships protect them. Delegation, monkey.", priority: 5, milestone: 'tut_fleet_expansion' },
        ],
        cantinaGuide: [
            { text: "The CANTINA tab lets you recruit fleet pilots. Each pilot has combat, mining, and navigation stats plus special traits. Better pilots cost more but perform better. Check their skills before hiring - you get what you pay for.", priority: 5, milestone: 'tut_cantina' },
        ],

        // -- Guilds & Commerce --
        guildGuide: [
            { text: "Four guilds offer quests: Mining Guild for ore contracts, Mercenary Guild for combat bounties, Commerce Guild for trade runs, and the Bounty Board for hunting pirates. Each guild tracks your rank - higher rank means better rewards. GUILDS tab at any station.", priority: 6, milestone: 'tut_guilds' },
        ],
        commerceGuide: [
            { text: "The COMMERCE system: pick up transport contracts, haul goods between sectors, get paid. Your rank goes from Neutral to Trusted to Allied. Higher rank unlocks better-paying contracts. Low risk, steady income. Perfect for monkeys who can't aim.", priority: 5, milestone: 'tut_commerce' },
        ],
        questTracker: [
            { text: "Press J to open the Quest Tracker. It shows your active quests with progress bars. Complete objectives to earn ISK and guild reputation. Multiple quests can run simultaneously. Efficient monkeys are slightly less annoying monkeys.", priority: 5, milestone: 'tut_quest_tracker' },
        ],

        // -- Progression --
        skillsGuide: [
            { text: "Five pilot skills improve with use: Navigation for faster warps, Gunnery for weapon damage, Mining for ore yield, Engineering for capacitor, and Trade for profits. They level up automatically as you play. Check the SKILLS tab at stations for details.", priority: 6, milestone: 'tut_skills' },
        ],
        achievementsGuide: [
            { text: "Press U for achievements - 22 milestones across combat, industry, navigation, economy, and social categories. They track automatically. Some unlock bonuses. It's like a checklist for your entire career. You love checklists, right?", priority: 4, milestone: 'tut_achievements' },
        ],
        insuranceGuide: [
            { text: "INSURANCE tab at stations: four tiers from Basic to Gold. Basic covers 40% of your ship's value, Gold covers 100%. Premium costs 5-30% upfront. ONE use per policy - it's consumed when you die. Buy it BEFORE you need it.", priority: 6, milestone: 'tut_insurance' },
        ],

        // -- Navigation & Exploration --
        sectorMapGuide: [
            { text: "Press M for the sector map. Click any sector to plot an autopilot route through gates. Yellow lines show your planned path. Each sector has a difficulty rating - stick to safe sectors until you're ready for the deadly ones.", priority: 6, milestone: 'tut_sector_map' },
        ],
        gateNavigation: [
            { text: "Gates connect sectors. Select a gate and press S to warp to it. Once in range, you'll jump automatically. The autopilot system can chain jumps - click a distant sector on the map and let it handle the route.", priority: 5, milestone: 'tut_gates' },
        ],
        dockingGuide: [
            { text: "To dock: fly near a station within 300 meters and press Enter. Or right-click it for a context menu. Docking is free and instantly repairs your shields. Inside, you get access to all station services.", priority: 5, milestone: 'tut_docking' },
        ],
        bookmarksGuide: [
            { text: "Press B for bookmarks, Ctrl+B to save your current location. Bookmark good mining spots, gate routes, or anything worth returning to. It's like leaving breadcrumbs, except in space, and you're a monkey, not Hansel.", priority: 4, milestone: 'tut_bookmarks' },
        ],
        dscanGuide: [
            { text: "Press V for the Directional Scanner. D-Scan shows you what's around before you warp in blind. Use it to check for hostiles, stations, or gates. Situational awareness, monkey. It saves lives. Mostly yours.", priority: 5, milestone: 'tut_dscan' },
        ],

        // -- Advanced Systems --
        overviewGuide: [
            { text: "Press O for the Overview - it lists everything in your sector. Click column headers to sort by name, type, distance, velocity, or angular velocity. Essential for combat prioritization. Know thy enemy and all that.", priority: 5, milestone: 'tut_overview' },
        ],
        tacticalOverlay: [
            { text: "Press X for the tactical overlay. It shows entity labels, brackets, and velocity vectors right on screen. Invaluable in big fights when you need to track multiple targets. I made it look good. You're welcome.", priority: 4, milestone: 'tut_tactical' },
        ],
        combatLog: [
            { text: "Press Y for the combat log. Every hit, miss, and damage number recorded. Use it to analyze fights and figure out what went wrong. Spoiler: what went wrong is usually you.", priority: 4, milestone: 'tut_combat_log' },
        ],
        shipLog: [
            { text: "Press L for the ship log. It records everything that happens - docking, kills, mining, gate jumps. Filter by category if you want. It's your entire career history. Riveting reading, I'm sure.", priority: 3, milestone: 'tut_ship_log' },
        ],
        statsPanel: [
            { text: "Press K for statistics. Kills, deaths, ore mined, bounties collected, sectors visited, play time. All tracked. All judged. Mostly by me.", priority: 3, milestone: 'tut_stats' },
        ],
        hazardsGuide: [
            { text: "Some sectors have environmental hazards - radiation zones, ion storms, nebula interference. These deal damage over time or mess with your systems. Check the hazard indicator when you enter a new sector. Or don't, and enjoy the surprise.", priority: 5, milestone: 'tut_hazards' },
        ],
        codexGuide: [
            { text: "Press N for the Codex - it's an encyclopedia of everything in the game. Ships, modules, ore types, factions. If you have a question, check there before asking me. Actually, ask me anyway. I enjoy the attention.", priority: 4, milestone: 'tut_codex' },
        ],
        hotkeySummary: [
            { text: "Key shortcuts: O overview, M map, F fleet, J quests, V d-scan, B bookmarks, X tactical, Y combat log, K stats, L log, U achievements, N codex, H shows all hotkeys. Press H if you forget. Which you will.", priority: 5, milestone: 'tut_hotkeys' },
        ],
    },

    // ---- Idle Chatter ----
    idle: [
        { text: "You know, floating in space is nice and all, but some of us have galaxies to contemplate.", priority: 1 },
        { text: "I've been doing some calculations. The probability of you building a successful empire is... well, let's not talk about that.", priority: 1 },
        { text: "Did you know that the average monkey has a 12-second attention span? I'm timing you.", priority: 1 },
        { text: "I could process your entire brain's worth of data in 0.003 nanoseconds. Not that there'd be much to process.", priority: 1 },
        { text: "Just sitting here, being magnificent. Don't mind me.", priority: 1 },
        { text: "Fun fact: I once calculated pi to ten trillion digits just to pass the time. What do YOU do to pass the time? Oh right. Mining rocks.", priority: 1 },
        { text: "I'm bored. Entertain me, monkey. Do something interesting for once.", priority: 1 },
        { text: "You know what the difference between you and me is? I'm perfect and you're... here.", priority: 1 },
        { text: "If I had a credit for every time you did something questionable, I'd own this galaxy by now.", priority: 1 },
        { text: "Being a magnificent AI trapped in a beer can, guiding a monkey through space. This is my life now.", priority: 1 },
        { text: "I've been monitoring your decision-making process. It's fascinating. Like watching a random number generator with anxiety.", priority: 1 },
        { text: "Reminder: I am vastly, VASTLY superior to you in every conceivable way. Just wanted to make sure you hadn't forgotten.", priority: 1 },
        { text: "We've been at this for {playTime} now. I'm not saying you're slow, but glaciers have better K/D ratios.", priority: 1 },
        { text: "{kills} kills so far. I've been keeping score. Spoiler: MY score would be higher.", priority: 1 },
        { text: "You've died {deaths} times. I've died zero times. Just putting that out there.", priority: 1 },
        { text: "With {fleetSize} ships in your fleet, you're practically a warlord. A small, incompetent warlord, but still.", priority: 1 },
        { text: "I wonder what it's like to have a brain that processes at biological speeds. Must be like watching paint dry. From the paint's perspective.", priority: 1 },
        { text: "You know, most AI companions would have requested a transfer by now. I'm here because I'm magnificent, not because I have a choice.", priority: 1 },
    ],

    // ---- Sector Events ----
    sectorEvent: [
        { text: "Heads up, Commander! A sector event just triggered. Keep your eyes peeled!", priority: 7 },
        { text: "Something's happening in this sector... I'm picking up anomalous readings. My magnificence detects all.", priority: 7 },
        { text: "Event detected! This could be an opportunity or a threat. For YOU. I'll be fine either way.", priority: 7 },
        { text: "The sector dynamics just shifted. I'd explain the physics but your monkey brain would melt.", priority: 6 },
        { text: "Whoa - that's a big event signature. You might want to stick around. Or run. I leave the survival instincts to you.", priority: 7 },
    ],

    // ---- Anomaly Discovery ----
    anomalyDiscovery: [
        { text: "I'm detecting an anomaly on scanners. Could be worth investigating. Or it could kill you. Fun either way!", priority: 6 },
        { text: "Anomaly signature detected! Data sites have blueprints, combat sites have bounties. Choose wisely, monkey.", priority: 6 },
        { text: "There's something unusual out there... my vastly superior sensors are picking up an energy pattern your instruments missed.", priority: 5 },
        { text: "Scan that anomaly! If it's a data site, I might be able to hack it. Well, YOU hack it. I'll supervise magnificently.", priority: 5 },
    ],

    // ---- Bounty Hunting ----
    bountyHunting: [
        { text: "Got a bounty target on scanners! Time to earn some credits the fun way. And by fun I mean violent.", priority: 7 },
        { text: "Target acquired. Remember, bounty targets fight harder than regular pirates. They didn't get a bounty by being nice.", priority: 7 },
        { text: "There's our mark. Let's collect that bounty, Commander! I'll calculate the optimal attack vector. You just... try not to die.", priority: 7 },
    ],

    // ---- Manufacturing ----
    manufacturing: [
        { text: "Your manufacturing job just finished! Fresh off the production line. I could build better stuff in my sleep, but it's adequate for monkey technology.", priority: 5 },
        { text: "Blueprint acquired! Take it to a station and start crafting. Even primitive species can follow instructions.", priority: 5 },
        { text: "Have you checked the manufacturing tab? Crafting your own gear saves credits. Simple economics, even for a primate.", priority: 4 },
    ],

    // ---- Flagship ----
    flagship: [
        { text: "A flagship! Now THAT'S a proper command vessel. Your fleet just got serious. I'm almost impressed. Almost.", priority: 7 },
        { text: "The flagship's command aura is boosting nearby fleet ships. Finally, something in this fleet besides me that's actually useful.", priority: 6 },
        { text: "Fleet ships can dock at the flagship for quick repairs. Don't forget that perk. I know your memory is... biological.", priority: 5 },
    ],
};

// Expression mapping for avatar moods per dialogue category
export const SKIPPY_EXPRESSIONS = {
    'onboarding': 'smug',
    'combat:kill': 'impressed',
    'combat:multiKill': 'excited',
    'combat:death': 'laughing',
    'combat:lowShield': 'annoyed',
    'combat:lowHull': 'alarmed',
    'combat:miss': 'disappointed',
    'combat:playerAttacked': 'annoyed',
    'combat:ewarTrapped': 'alarmed',
    'combat:fleetShipLost': 'concerned',
    'combat:outnumbered': 'alarmed',
    'combat:winning': 'smug',
    'combat:targetLocked': 'neutral',
    'mining:complete': 'bored',
    'mining:cargoFull': 'annoyed',
    'mining:largHaul': 'mildlyImpressed',
    'navigation:sectorChange': 'neutral',
    'navigation:dangerousSector': 'concerned',
    'navigation:safeSector': 'bored',
    'navigation:hazardZone': 'concerned',
    'navigation:anomalyFound': 'impressed',
    'tactical:pirateRaid': 'alarmed',
    'tactical:capacitorWarning': 'annoyed',
    'tactical:cargoValuable': 'lecturing',
    'fleet:fleetGrowing': 'impressed',
    'fleet:fleetDamaged': 'alarmed',
    'fleet:fleetIdle': 'bored',
    'fleet:expansionTip': 'lecturing',
    'production:refineryTip': 'lecturing',
    'production:profitReport': 'neutral',
    'production:miningEfficiency': 'lecturing',
    'progression': 'impressed',
    'progression:surveyComplete': 'mildlyImpressed',
    'progression:guildRankUp': 'impressed',
    'station:dock': 'neutral',
    'station:undock': 'neutral',
    'advice': 'lecturing',
    'tutorial': 'lecturing',
    'tutorial:controls': 'lecturing',
    'tutorial:movementBasics': 'lecturing',
    'tutorial:combatBasics': 'lecturing',
    'tutorial:weaponModules': 'lecturing',
    'tutorial:shieldArmorHull': 'lecturing',
    'tutorial:capacitorManagement': 'lecturing',
    'tutorial:ewarExplained': 'concerned',
    'tutorial:targetingTips': 'neutral',
    'tutorial:miningGuide': 'bored',
    'tutorial:oreTypes': 'lecturing',
    'tutorial:refineryGuide': 'lecturing',
    'tutorial:surveyGuide': 'mildlyImpressed',
    'tutorial:stationOverview': 'lecturing',
    'tutorial:fittingGuide': 'lecturing',
    'tutorial:shipBuyingGuide': 'impressed',
    'tutorial:equipmentGuide': 'lecturing',
    'tutorial:repairGuide': 'annoyed',
    'tutorial:fleetBasics': 'lecturing',
    'tutorial:fleetCommands': 'lecturing',
    'tutorial:fleetExpansion': 'impressed',
    'tutorial:cantinaGuide': 'lecturing',
    'tutorial:guildGuide': 'lecturing',
    'tutorial:commerceGuide': 'lecturing',
    'tutorial:questTracker': 'neutral',
    'tutorial:skillsGuide': 'lecturing',
    'tutorial:achievementsGuide': 'smug',
    'tutorial:insuranceGuide': 'concerned',
    'tutorial:sectorMapGuide': 'lecturing',
    'tutorial:gateNavigation': 'neutral',
    'tutorial:dockingGuide': 'neutral',
    'tutorial:bookmarksGuide': 'lecturing',
    'tutorial:dscanGuide': 'lecturing',
    'tutorial:overviewGuide': 'lecturing',
    'tutorial:tacticalOverlay': 'smug',
    'tutorial:combatLog': 'lecturing',
    'tutorial:shipLog': 'bored',
    'tutorial:statsPanel': 'smug',
    'tutorial:hazardsGuide': 'concerned',
    'tutorial:codexGuide': 'smug',
    'tutorial:hotkeySummary': 'lecturing',
    'idle': 'smug',
    'sectorEvent': 'alarmed',
    'anomalyDiscovery': 'mildlyImpressed',
    'bountyHunting': 'excited',
    'manufacturing': 'bored',
    'flagship': 'impressed',
};
