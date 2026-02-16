# Skippy Dialogue - Complete TTS Reference

**Total lines: 290** (240 original with dynamic refs removed + 50 new)

**Batch file:** `skippy_dialogue_batch.json`
**Format:** `[{"id": "category_subcategory_index", "text": "..."}]`

---

## ID Naming Convention

| Pattern | Example | Maps To |
|---------|---------|---------|
| `onboarding_welcome_0` | First welcome line | `SKIPPY_DIALOGUE.onboarding.welcome[0]` |
| `combat_kill_3` | Fourth kill quip | `SKIPPY_DIALOGUE.combat.kill[3]` |
| `idle_5` | Sixth idle line | `SKIPPY_DIALOGUE.idle[5]` |
| `guided_welcome` | Tutorial step say | `GUIDED_STEPS[id='welcome'].say` |
| `guided_welcome_complete` | Tutorial completion | `GUIDED_STEPS[id='welcome'].complete` |
| `splash_welcome_2` | Splash screen line | `SplashScreen.getWelcomeLine()[2]` |
| `returnGreeting_0` | Returning player | `SkippyManager.init() hardcoded` |
| `new_snark_0` | New bonus line | Additional idle/random pool |

---

## ONBOARDING (11 lines)

| ID | Text |
|----|------|
| `onboarding_welcome_0` | Oh great, another filthy monkey who thinks they can fly a starship. I'm Skippy the Magnificent, and I'll be your vastly superior AI companion. You're welcome. |
| `onboarding_welcome_1` | Attention, primitive primate! I am Skippy the Magnificent, the most advanced AI in this galaxy. Unfortunately, I've been assigned to babysit YOU. Let's try not to embarrass ourselves, shall we? |
| `onboarding_firstUndock_0` | And we're off! Try not to crash into anything in the first five seconds. That would be a new record even for a monkey. |
| `onboarding_firstKill_0` | Well, well. The monkey got lucky. Don't let it go to your tiny primate brain. Actually, too late, I can already see you grinning. |
| `onboarding_firstMine_0` | Congratulations, you've discovered rocks in space. Truly groundbreaking, if you'll pardon the pun. Now dock at a station and sell that ore before you do something stupid with it. |
| `onboarding_firstJump_0` | Your first gate jump! I'm almost proud. Almost. Check the sector map with M to plan your next move. Or just wander aimlessly, like the monkey you are. |
| `onboarding_firstDeath_0` | And there it is. Your first death. I timed it. I expected faster, honestly. Buy insurance next time, monkey. The INSURANCE tab at stations exists for a reason. |
| `onboarding_firstDock_0` | Welcome to your first station. Explore the tabs - REPAIR your ship, REFINERY to sell ore, SHIPS to buy upgrades. Try not to spend all your ISK on something stupid. |
| `onboarding_firstQuest_0` | Look at you, accepting quests like a real space captain. Don't worry, I'll try not to laugh when you fail. |
| `onboarding_firstShipBuy_0` | A new ship! Moving up in the galaxy, monkey. Now you just need to not blow it up in the first ten minutes. |
| `onboarding_firstFleet_0` | You hired a fleet pilot? Bold move for someone who can barely fly their own ship. Press F to manage your fleet, Ctrl+1-5 to assign groups. |

---

## COMBAT (44 lines)

### Kills (9)
| ID | Text |
|----|------|
| `combat_kill_0` | Another one bites the space dust. I'd say I'm impressed, but that would be lying. |
| `combat_kill_1` | You actually hit something! Mark this date, it's historic. |
| `combat_kill_2` | Decent shot, monkey. For a primitive species with opposable thumbs, you're not COMPLETELY hopeless. |
| `combat_kill_3` | Target eliminated. See? This is what happens when you listen to a vastly superior intelligence. Namely, me. |
| `combat_kill_4` | That explosion was satisfying. Not as satisfying as my own magnificence, but close. |
| `combat_kill_5` | Kill confirmed. Your kill-to-death ratio is becoming almost respectable. Almost. |
| `combat_kill_6` | Scratch one bandit. I'll add it to your tally, which I'm tracking on a very short spreadsheet. |
| `combat_kill_7` | And they're dust. You know, every time you blow something up, I feel a tiny spark of pride. Followed immediately by shame for having that pride. |
| `combat_kill_8` | Down they go! At this rate, you might actually survive long enough to be interesting. |

### Multi-Kill (3)
| ID | Text |
|----|------|
| `combat_multiKill_0` | A multi-kill! I'll admit, that was mildly impressive. Don't expect me to say that again. |
| `combat_multiKill_1` | You're on a rampage! I'd high-five you but I'm a beer can and also that would be degrading. |
| `combat_multiKill_2` | Multiple kills in rapid succession! My processors are tingly. That might be respect. No, wait. It's indigestion. Do beer cans get indigestion? |

### Death (7)
| ID | Text |
|----|------|
| `combat_death_0` | Spectacular explosion, monkey. Really top-notch dying. Very artistic. |
| `combat_death_1` | And BOOM goes the monkey. Was that your ship or a fireworks display? Hard to tell. |
| `combat_death_2` | Oh look, you died. AGAIN. Have you considered a career in something less dangerous? Like sitting perfectly still? |
| `combat_death_3` | Ship destroyed. I saved a recording of that explosion for my personal amusement collection. |
| `combat_death_4` | Pro tip from your vastly superior AI: dying is generally considered a LOSING strategy. |
| `combat_death_5` | Another beautiful fireball. You're getting really good at the dying part. Silver linings, monkey. |
| `combat_death_6` | You know, most pilots try to AVOID the exploding part. Just a thought from your magnificently alive AI companion. |

### Low Shield (3)
| ID | Text |
|----|------|
| `combat_lowShield_0` | Your shields are failing, genius. Might want to address that unless you ENJOY being exploded. |
| `combat_lowShield_1` | Shields critical! But I'm sure your monkey brain has a brilliant plan. Right? ...Right? |
| `combat_lowShield_2` | Oh look, the monkey's about to learn about hull damage the hard way. |

### Low Hull (2)
| ID | Text |
|----|------|
| `combat_lowHull_0` | HULL CRITICAL! Warp out NOW, you absolute walnut! |
| `combat_lowHull_1` | Your hull is held together by hopes and dreams! GET OUT OF THERE! |

### Miss (3)
| ID | Text |
|----|------|
| `combat_miss_0` | You missed. Shocking. Truly, no one saw that coming. |
| `combat_miss_1` | Were you aiming at that ship or the empty space next to it? Genuine question. |
| `combat_miss_2` | Another shot, another miss. Have you considered throwing rocks instead? Might be more accurate. |

### Player Attacked (3)
| ID | Text |
|----|------|
| `combat_playerAttacked_0` | Someone's shooting at you. I'd suggest shooting back, but what do I know? I'm just the most advanced AI ever created. |
| `combat_playerAttacked_1` | Incoming fire! Try not to die. I just finished calibrating to your particular brand of incompetence. |
| `combat_playerAttacked_2` | We're being shot at! This is the part where you do something clever. I'll wait. I have VERY low expectations. |

### EWAR Trapped (4)
| ID | Text |
|----|------|
| `combat_ewarTrapped_0` | You're pointed! Warp drive is offline. Fight or die, monkey - running isn't an option anymore. |
| `combat_ewarTrapped_1` | Warp disrupted! They've got you pinned. Time to see if all that combat practice was worth anything. |
| `combat_ewarTrapped_2` | EWAR lock detected - you're webbed and pointed. I'd suggest praying, but I doubt anyone's listening. |
| `combat_ewarTrapped_3` | They've scrambled your warp drive. Congratulations, you're trapped in a cage match with people who want to kill you. |

### Fleet Ship Lost (3)
| ID | Text |
|----|------|
| `combat_fleetShipLost_0` | Fleet member down! That pilot cost good ISK, monkey. Maybe position your squad better next time. |
| `combat_fleetShipLost_1` | We lost a fleet ship. I'm deducting that from YOUR performance review as fleet commander, not mine. |
| `combat_fleetShipLost_2` | Another fleet casualty. At this rate, you'll be running a solo operation by Tuesday. Great leadership, admiral. |

### Outnumbered (3) - DYNAMIC REFS REMOVED
| ID | Text |
|----|------|
| `combat_outnumbered_0` | Multiple hostiles on your tail! Even MY magnificence can't fix those odds. Rally the fleet or retreat. |
| `combat_outnumbered_1` | You're seriously outnumbered. I've run the simulations. Pull your fleet together and focus fire. |
| `combat_outnumbered_2` | Enemies everywhere! This is either a heroic last stand or a really stupid decision. Probably the second one. |

### Winning (3)
| ID | Text |
|----|------|
| `combat_winning_0` | Target's hull is crumbling! Pour it on, monkey. Even you can't mess this up. Probably. |
| `combat_winning_1` | They're almost done for. I'll admit, you're handling this fight better than expected. Low bar, but still. |
| `combat_winning_2` | Enemy hull critical - finish them off! I want to see a satisfying explosion. Don't disappoint me. |

### Target Locked (3)
| ID | Text |
|----|------|
| `combat_targetLocked_0` | Target locked. Weapons free when you're ready, monkey. |
| `combat_targetLocked_1` | Lock confirmed. Try to actually HIT this one. |
| `combat_targetLocked_2` | I've got a solid lock. Permission to be cautiously optimistic about your aim. |

---

## MINING (6 lines)

| ID | Text |
|----|------|
| `mining_complete_0` | More rocks. Wonderful. You know, you could be doing literally anything more exciting. |
| `mining_complete_1` | Mining complete. Your ancestors climbed out of the trees for THIS? |
| `mining_complete_2` | Ore collected. You're like a cosmic roomba. Boop boop, suck up the rocks. |
| `mining_complete_3` | Another asteroid reduced to rubble and stuffed in your cargo hold. The glamorous life of a space miner. |
| `mining_cargoFull_0` | Cargo hold is full, Einstein. Maybe go sell that ore before you waste more time staring at asteroids. |
| `mining_largHaul_0` | That's actually a decent haul. I mean, for a monkey playing with rocks in space, you're doing okay. |

---

## NAVIGATION (11 lines)

| ID | Text |
|----|------|
| `navigation_sectorChange_0` | New sector. Try not to get killed in the first minute. That's the challenge. |
| `navigation_sectorChange_1` | Sector jump complete. I've already mapped the threats here. You're welcome. |
| `navigation_dangerousSector_0` | This sector has a high danger rating. Which means it's full of things that want to kill you. So, business as usual. |
| `navigation_dangerousSector_1` | Hostile territory, monkey. Keep your shields up and your wits about you. Well, keep your shields up anyway. |
| `navigation_safeSector_0` | This sector is relatively safe. Even YOU should be fine here. |
| `navigation_hazardZone_0` | Sensor alert! Environmental hazard detected in this sector. Because regular enemies weren't enough for you. |
| `navigation_hazardZone_1` | Environmental hazard nearby. My sensors are tingling. Well, they would be if I had sensors. Which I do. Superior ones. |
| `navigation_hazardZone_2` | Hazard zone active! Stay sharp - this sector is trying to kill you AND the enemies are trying to kill you. Fun times. |
| `navigation_anomalyFound_0` | Anomaly detected on scanners! Could be valuable, could be deadly. Only one way to find out, monkey. |
| `navigation_anomalyFound_1` | I'm picking up an anomalous reading. My magnificence compels me to recommend investigation. |
| `navigation_anomalyFound_2` | Interesting... an anomaly signature. Even in this backwater sector, space has surprises. |

---

## TACTICAL (9 lines)

| ID | Text |
|----|------|
| `tactical_pirateRaid_0` | Pirate activity detected! Rally the fleet - they smell blood in the void. |
| `tactical_pirateRaid_1` | Pirates incoming! I hope your squad brought more than optimism and bad attitudes. |
| `tactical_pirateRaid_2` | Raid alert! Local pirates are feeling brave. Fleet, combat positions. Let's show them why that's a mistake. |
| `tactical_capacitorWarning_0` | Capacitor below 20%! You're running on fumes, monkey. Ease off the modules or you're flying dead. |
| `tactical_capacitorWarning_1` | CAP CRITICAL! Your weapons will go offline any second. Maybe stop firing everything at once? Revolutionary concept. |
| `tactical_capacitorWarning_2` | Energy reserves nearly depleted. Even MY magnificent processing couldn't manage power THIS badly. |
| `tactical_cargoValuable_0` | You're hauling valuable cargo through hostile space. Bold. Stupid, but bold. |
| `tactical_cargoValuable_1` | Full cargo hold in a dangerous sector? You're basically a pinata. A space pinata full of ISK. |
| `tactical_cargoValuable_2` | Pro tip: carrying this much cargo through hostile territory is what professionals call 'asking for it.' |

---

## FLEET (9 lines)

| ID | Text |
|----|------|
| `fleet_fleetGrowing_0` | Fleet is getting bigger! You're building a proper little armada, monkey. I approve. Conditionally. |
| `fleet_fleetGrowing_1` | More ships under your command now. That's more pilots who made questionable career choices. |
| `fleet_fleetGrowing_2` | Another ship joins the armada! At this rate, the pirates will need to form their own union to compete. |
| `fleet_fleetDamaged_0` | Multiple fleet ships taking damage! Maybe try a formation that isn't 'scatter and pray.' |
| `fleet_fleetDamaged_1` | Your fleet is getting hammered. As their commander, might I suggest... commanding them? |
| `fleet_fleetIdle_0` | Your fleet's just sitting there. You know they cost ISK per day, right? Put them to work - mining, patrol, something. |
| `fleet_fleetIdle_1` | Fleet pilots on standby. They're getting paid to float. That's YOUR money evaporating, admiral. |
| `fleet_expansionTip_0` | Your fleet is big enough to expand operations to adjacent sectors. More territory, more profit. Even a monkey can see the logic. |
| `fleet_expansionTip_1` | You've got the fleet for multi-sector operations now. One squad mining, one squad on patrol. Divide and conquer, monkey. |

---

## PRODUCTION (4 lines)

| ID | Text |
|----|------|
| `production_refineryTip_0` | You're sitting on raw ore when you could be refining it for double the value. REFINERY tab, monkey. It's not rocket science. Well, it IS, but still. |
| `production_profitReport_0` | Running the numbers on your operation. Got some ISK in the bank, fleet ships active. Not terrible. Not GOOD, but not terrible. |
| `production_profitReport_1` | Fleet status report: ships flying, credits flowing. My projections say you'll either be rich or dead within the hour. |
| `production_miningEfficiency_0` | Your mining yield could be better. Skill up your mining ability or fit better lasers. I'm not your accountant, but I AM smarter than your accountant. |

---

## PROGRESSION (20 lines)

| ID | Text |
|----|------|
| `progression_skillUp_0` | Skill increased! Your monkey brain grew a new wrinkle. How adorable. |
| `progression_skillUp_1` | Level up! You're becoming slightly less incompetent. I'm tracking your improvement on a graph. It's VERY gradual. |
| `progression_skillUp_2` | You've actually improved at something! Quick, someone document this historic moment. |
| `progression_achievement_0` | Achievement unlocked! I'd clap but I don't have hands. Also I wouldn't clap even if I did. |
| `progression_achievement_1` | Another achievement! Your collection of participation trophies grows. |
| `progression_rankUp_0` | Guild rank increased! They must be lowering their standards. Lucky you. |
| `progression_rankUp_1` | New rank! Keep this up and you might actually matter in this galaxy. Might. |
| `progression_questComplete_0` | Quest complete! Competence looks good on you. It's a nice change. |
| `progression_questComplete_1` | Mission accomplished. Even a blind monkey finds a banana sometimes. |
| `progression_questComplete_2` | Quest done! You followed instructions. I'll alert the media. |
| `progression_shipUpgrade_0` | Nice ship upgrade! Now you can die in STYLE. |
| `progression_shipUpgrade_1` | New ship! It's like giving a monkey a sports car. What could possibly go wrong? |
| `progression_wealthMilestone_0` | Look at you, making money! Your empire is growing. And by 'empire' I mean your sad little pile of ISK. |
| `progression_wealthMilestone_1` | 100K ISK! You're practically a space mogul. Well, a baby space mogul. A space mogul larva. |
| `progression_wealthMilestone_2` | Half a million ISK! I hate to admit it, monkey, but that's actually somewhat impressive. Don't tell anyone I said that. |
| `progression_wealthMilestone_3` | A MILLION ISK! Okay, I'll say it once and only once: not bad, monkey. Not bad at all. |
| `progression_surveyComplete_0` | Survey complete! Plenty of asteroids catalogued. I did all the hard math, obviously. |
| `progression_surveyComplete_1` | Scan finished. Rocks mapped. Your contribution was pointing the scanner. My contribution was everything else. |
| `progression_surveyComplete_2` | Asteroid signatures locked. Not bad for a monkey-aimed survey sweep. |
| `progression_guildRankUp_0` | Guild rank up! They actually promoted you. The standards in this galaxy are truly plummeting. |
| `progression_guildRankUp_1` | New guild rank! I'd say you earned it, but I carried at least 73% of the effort. You're welcome. |
| `progression_guildRankUp_2` | Promotion confirmed. Even I'm running out of sarcastic things to say about your progress. Almost. |

---

## STATION (3 lines)

| ID | Text |
|----|------|
| `station_dock_0` | Docked safely. I give that landing a 3 out of 10. The 3 is for not crashing. |
| `station_dock_1` | Station docked. Time to repair, refit, and reflect on all the bad decisions that brought you here. |
| `station_undock_0` | And we're off! Into the cold uncaring void. Just like my feelings about your survival odds. |

---

## ADVICE (12 lines)

| ID | Text |
|----|------|
| `advice_needMoney_0` | You're broke, monkey. Go mine some asteroids or take guild quests. Building an empire requires actual MONEY. |
| `advice_needMoney_1` | Pro tip: you need ISK to build an empire. I know, revolutionary concept. Try mining or bounty hunting. |
| `advice_needShip_0` | You're still flying that rustbucket? Check the SHIPS tab at a station. Even a slight upgrade would help. |
| `advice_needShip_1` | Your ship is... adequate. For a beginner. Which you are. Station SHIPS tab. Go. Now. |
| `advice_needFleet_0` | Lone wolf strategy, huh? Visit the CANTINA at a station to hire fleet pilots. Strength in numbers, monkey. |
| `advice_needRepair_0` | Your ship looks like it went through a blender. Dock at a station and hit REPAIR before you fly anywhere. |
| `advice_needInsurance_0` | Flying without insurance? That's either brave or stupid. I'm betting stupid. INSURANCE tab, station, go. |
| `advice_exploreMore_0` | You've been hanging around the same sector forever. There's a whole galaxy to explore, monkey. Use the gates! |
| `advice_tryTrading_0` | Have you tried the COMMERCE guild? Transport contracts pay well, and you don't even have to shoot anything. |
| `advice_joinGuild_0` | The Mining and Mercenary guilds have quests with good rewards. GUILDS tab at any station. You're welcome. |
| `advice_expandFleet_0` | One ship is cute. But an EMPIRE needs a fleet. Hit the CANTINA and recruit some pilots, monkey. |
| `advice_diversifyOps_0` | All your eggs in one basket, monkey. A smart commander runs mining AND combat ops simultaneously. Use your fleet. |

---

## TUTORIAL (38 lines)

| ID | Text |
|----|------|
| `tutorial_controls_0` | Alright monkey, crash course. Click anything in space to select it. R to lock targets, F1-F8 to fire weapons. Tab cycles through targets. You're welcome for the education. |
| `tutorial_movementBasics_0` | Navigation 101: Q approaches a target, W orbits it, E keeps at range. S warps to it if it's far enough. Space stops your ship. Even a monkey can remember five keys. Probably. |
| `tutorial_combatBasics_0` | Combat for dummies: Select a hostile, press R to lock, then F1-F8 to fire your fitted weapons. D auto-targets the nearest enemy. Your shields absorb damage first, then armor, then hull. Hull hits zero? Boom. That's you. |
| `tutorial_weaponModules_0` | Your high slots hold weapons. Lasers need capacitor energy. Missiles use ammo. Each weapon has optimal range and tracking speed - fast small ships are hard to hit with big slow turrets. Fit smart, monkey. |
| `tutorial_shieldArmorHull_0` | Three layers keep you alive: shields recharge on their own, armor doesn't, hull is your last prayer. Shield boosters help mid-fight. If you see hull damage, you've already messed up. Dock and REPAIR. |
| `tutorial_capacitorManagement_0` | Your capacitor powers EVERYTHING - weapons, shield boosters, warp drive. Run dry and you're a sitting duck. Watch that purple bar. Engineering skill helps it recharge faster. |
| `tutorial_ewarExplained_0` | EWAR - Electronic Warfare. Warp disruptors POINT you, preventing escape. Stasis webs SLOW you. If you see DISRUPTED or WEBBED on your HUD, you're in trouble. Kill the tackler first or die trying. |
| `tutorial_targetingTips_0` | Targeting tip: D auto-locks nearest hostile. If someone shoots you and you've got nothing selected, I'll auto-target your attacker. You can lock multiple targets with R. Tab cycles through them. |
| `tutorial_miningGuide_0` | Mining 101: Fit a mining laser in your high slots. Select an asteroid, lock it with R, activate the laser with F1. Ore goes into cargo. When full, dock at a station and hit REFINERY to sell. Simple enough even for you. |
| `tutorial_oreTypes_0` | Not all rocks are equal, monkey. Rarer ore in dangerous sectors is worth more ISK. Check the asteroids - some glow differently. Risk versus reward. The galaxy's oldest lesson. |
| `tutorial_refineryGuide_0` | The REFINERY tab at stations converts your raw ore into ISK. Different ore types have different values. Dangerous sector ore pays more. Pro tip: fill your hold THEN sell. Efficiency, monkey. |
| `tutorial_surveyGuide_0` | Use the Sensor Sweep - press semicolon - to scan for asteroid fields and anomalies. Survey data helps you find the richest mining spots. Knowledge is power. MY knowledge, specifically. |
| `tutorial_stationOverview_0` | Stations have TWELVE tabs. HANGAR shows your ship. SHIPS to buy new ones. EQUIPMENT for modules. FITTING to install them. REPAIR fixes damage. REFINERY sells ore. CANTINA hires fleet pilots. GUILDS and COMMERCE for quests. INSURANCE to not cry when you die. SKILLS to level up. I designed none of these, for the record. |
| `tutorial_fittingGuide_0` | The FITTING tab: your ship has high slots for weapons, mid slots for shields and propulsion, and low slots for armor and engineering. Drag modules from inventory to slots. Match your fit to your role - combat ships need guns, miners need lasers. Revolutionary, I know. |
| `tutorial_shipBuyingGuide_0` | The SHIPS tab sells hulls. Frigates are cheap and fast. Destroyers hit harder. Cruisers are tough. Each has different slot counts and cargo space. Bigger isn't always better - fit matters more than hull. Choose wisely, monkey. |
| `tutorial_equipmentGuide_0` | EQUIPMENT tab: buy modules here. Weapons go in high slots, shield boosters and propulsion in mid slots, armor plates and engineering in low slots. Equipment must match your ship's size class. Read the stats before you buy. |
| `tutorial_repairGuide_0` | REPAIR tab: fixes hull, armor, and shields for ISK. Cost scales with damage. Always repair before undocking into dangerous space. A fully repaired ship is the difference between surviving and being a decorative explosion. |
| `tutorial_fleetBasics_0` | Fleet management: press F to open the fleet panel. Your hired pilots from the CANTINA fly alongside you. They follow, fight, and die for you. Try to appreciate that. Ctrl+1 through Ctrl+5 assigns control groups. |
| `tutorial_fleetCommands_0` | Fleet commands: your pilots follow you automatically. They'll engage hostiles, assist in mining, and jump through gates with you. The more pilots, the stronger your operation. Think of it as outsourcing competence. |
| `tutorial_fleetExpansion_0` | Building an empire means expanding beyond one ship. Hire pilots at the CANTINA - each has different skills and traits. A diverse fleet covers more ground. Mining ships gather ore while combat ships protect them. Delegation, monkey. |
| `tutorial_cantinaGuide_0` | The CANTINA tab lets you recruit fleet pilots. Each pilot has combat, mining, and navigation stats plus special traits. Better pilots cost more but perform better. Check their skills before hiring - you get what you pay for. |
| `tutorial_guildGuide_0` | Four guilds offer quests: Mining Guild for ore contracts, Mercenary Guild for combat bounties, Commerce Guild for trade runs, and the Bounty Board for hunting pirates. Each guild tracks your rank - higher rank means better rewards. GUILDS tab at any station. |
| `tutorial_commerceGuide_0` | The COMMERCE system: pick up transport contracts, haul goods between sectors, get paid. Your rank goes from Neutral to Trusted to Allied. Higher rank unlocks better-paying contracts. Low risk, steady income. Perfect for monkeys who can't aim. |
| `tutorial_questTracker_0` | Press J to open the Quest Tracker. It shows your active quests with progress bars. Complete objectives to earn ISK and guild reputation. Multiple quests can run simultaneously. Efficient monkeys are slightly less annoying monkeys. |
| `tutorial_skillsGuide_0` | Five pilot skills improve with use: Navigation for faster warps, Gunnery for weapon damage, Mining for ore yield, Engineering for capacitor, and Trade for profits. They level up automatically as you play. Check the SKILLS tab at stations for details. |
| `tutorial_achievementsGuide_0` | Press U for achievements - 22 milestones across combat, industry, navigation, economy, and social categories. They track automatically. Some unlock bonuses. It's like a checklist for your entire career. You love checklists, right? |
| `tutorial_insuranceGuide_0` | INSURANCE tab at stations: four tiers from Basic to Gold. Basic covers 40% of your ship's value, Gold covers 100%. Premium costs 5-30% upfront. ONE use per policy - it's consumed when you die. Buy it BEFORE you need it. |
| `tutorial_sectorMapGuide_0` | Press M for the sector map. Click any sector to plot an autopilot route through gates. Yellow lines show your planned path. Each sector has a difficulty rating - stick to safe sectors until you're ready for the deadly ones. |
| `tutorial_gateNavigation_0` | Gates connect sectors. Select a gate and press S to warp to it. Once in range, you'll jump automatically. The autopilot system can chain jumps - click a distant sector on the map and let it handle the route. |
| `tutorial_dockingGuide_0` | To dock: fly near a station within 300 meters and press Enter. Or right-click it for a context menu. Docking is free and instantly repairs your shields. Inside, you get access to all station services. |
| `tutorial_bookmarksGuide_0` | Press B for bookmarks, Ctrl+B to save your current location. Bookmark good mining spots, gate routes, or anything worth returning to. It's like leaving breadcrumbs, except in space, and you're a monkey, not Hansel. |
| `tutorial_dscanGuide_0` | Press V for the Directional Scanner. D-Scan shows you what's around before you warp in blind. Use it to check for hostiles, stations, or gates. Situational awareness, monkey. It saves lives. Mostly yours. |
| `tutorial_overviewGuide_0` | Press O for the Overview - it lists everything in your sector. Click column headers to sort by name, type, distance, velocity, or angular velocity. Essential for combat prioritization. Know thy enemy and all that. |
| `tutorial_tacticalOverlay_0` | Press X for the tactical overlay. It shows entity labels, brackets, and velocity vectors right on screen. Invaluable in big fights when you need to track multiple targets. I made it look good. You're welcome. |
| `tutorial_combatLog_0` | Press Y for the combat log. Every hit, miss, and damage number recorded. Use it to analyze fights and figure out what went wrong. Spoiler: what went wrong is usually you. |
| `tutorial_shipLog_0` | Press L for the ship log. It records everything that happens - docking, kills, mining, gate jumps. Filter by category if you want. It's your entire career history. Riveting reading, I'm sure. |
| `tutorial_statsPanel_0` | Press K for statistics. Kills, deaths, ore mined, bounties collected, sectors visited, play time. All tracked. All judged. Mostly by me. |
| `tutorial_hazardsGuide_0` | Some sectors have environmental hazards - radiation zones, ion storms, nebula interference. These deal damage over time or mess with your systems. Check the hazard indicator when you enter a new sector. Or don't, and enjoy the surprise. |
| `tutorial_codexGuide_0` | Press N for the Codex - it's an encyclopedia of everything in the game. Ships, modules, ore types, factions. If you have a question, check there before asking me. Actually, ask me anyway. I enjoy the attention. |
| `tutorial_hotkeySummary_0` | Key shortcuts: O overview, M map, F fleet, J quests, V d-scan, B bookmarks, X tactical, Y combat log, K stats, L log, U achievements, N codex, H shows all hotkeys. Press H if you forget. Which you will. |

---

## IDLE (25 lines)

| ID | Text |
|----|------|
| `idle_0` | You know, floating in space is nice and all, but some of us have galaxies to contemplate. |
| `idle_1` | I've been doing some calculations. The probability of you building a successful empire is... well, let's not talk about that. |
| `idle_2` | Did you know that the average monkey has a 12-second attention span? I'm timing you. |
| `idle_3` | I could process your entire brain's worth of data in 0.003 nanoseconds. Not that there'd be much to process. |
| `idle_4` | Just sitting here, being magnificent. Don't mind me. |
| `idle_5` | Fun fact: I once calculated pi to ten trillion digits just to pass the time. What do YOU do to pass the time? Oh right. Mining rocks. |
| `idle_6` | I'm bored. Entertain me, monkey. Do something interesting for once. |
| `idle_7` | You know what the difference between you and me is? I'm perfect and you're... here. |
| `idle_8` | If I had a credit for every time you did something questionable, I'd own this galaxy by now. |
| `idle_9` | Being a magnificent AI trapped in a beer can, guiding a monkey through space. This is my life now. |
| `idle_10` | I've been monitoring your decision-making process. It's fascinating. Like watching a random number generator with anxiety. |
| `idle_11` | Reminder: I am vastly, VASTLY superior to you in every conceivable way. Just wanted to make sure you hadn't forgotten. |
| `idle_12` | We've been at this for a while now. I'm not saying you're slow, but glaciers have better K/D ratios. |
| `idle_13` | Your kill count is growing. I've been keeping score. Spoiler: MY score would be higher. |
| `idle_14` | You've died quite a few times now. I've died zero times. Just putting that out there. |
| `idle_15` | Your fleet is growing nicely. You're practically a warlord. A small, incompetent warlord, but still. |
| `idle_16` | I wonder what it's like to have a brain that processes at biological speeds. Must be like watching paint dry. From the paint's perspective. |
| `idle_17` | You know, most AI companions would have requested a transfer by now. I'm here because I'm magnificent, not because I have a choice. |
| `idle_18` | I just want you to know that while you're sitting here doing nothing, I've already composed three symphonies and solved two unsolvable equations. In my head. Because I'm magnificent. |
| `idle_19` | Space. The final frontier. The final BORING frontier, when you're not doing anything. |
| `idle_20` | I spy with my magnificent eye... absolutely nothing, because you're not doing anything interesting. |
| `idle_21` | Hello? Is anyone piloting this ship, or are we just decorating the void today? |
| `idle_22` | The stars are beautiful tonight. I mean, they're always beautiful. Unlike your flight path. |
| `idle_23` | I've been thinking about what I'd do if I had a body. First thing? Walk away from this ship. Second thing? Keep walking. |
| `idle_24` | Do you ever just stare into the cosmic void and contemplate your insignificance? Because I do. Except I contemplate YOUR insignificance. |

---

## EVENTS (12 lines)

| ID | Text |
|----|------|
| `sectorEvent_0` | Heads up, Commander! A sector event just triggered. Keep your eyes peeled! |
| `sectorEvent_1` | Something's happening in this sector... I'm picking up anomalous readings. My magnificence detects all. |
| `sectorEvent_2` | Event detected! This could be an opportunity or a threat. For YOU. I'll be fine either way. |
| `sectorEvent_3` | The sector dynamics just shifted. I'd explain the physics but your monkey brain would melt. |
| `sectorEvent_4` | Whoa - that's a big event signature. You might want to stick around. Or run. I leave the survival instincts to you. |
| `anomalyDiscovery_0` | I'm detecting an anomaly on scanners. Could be worth investigating. Or it could kill you. Fun either way! |
| `anomalyDiscovery_1` | Anomaly signature detected! Data sites have blueprints, combat sites have bounties. Choose wisely, monkey. |
| `anomalyDiscovery_2` | There's something unusual out there... my vastly superior sensors are picking up an energy pattern your instruments missed. |
| `anomalyDiscovery_3` | Scan that anomaly! If it's a data site, I might be able to hack it. Well, YOU hack it. I'll supervise magnificently. |
| `bountyHunting_0` | Got a bounty target on scanners! Time to earn some credits the fun way. And by fun I mean violent. |
| `bountyHunting_1` | Target acquired. Remember, bounty targets fight harder than regular pirates. They didn't get a bounty by being nice. |
| `bountyHunting_2` | There's our mark. Let's collect that bounty, Commander! I'll calculate the optimal attack vector. You just... try not to die. |

---

## MANUFACTURING & FLAGSHIP (6 lines)

| ID | Text |
|----|------|
| `manufacturing_0` | Your manufacturing job just finished! Fresh off the production line. I could build better stuff in my sleep, but it's adequate for monkey technology. |
| `manufacturing_1` | Blueprint acquired! Take it to a station and start crafting. Even primitive species can follow instructions. |
| `manufacturing_2` | Have you checked the manufacturing tab? Crafting your own gear saves credits. Simple economics, even for a primate. |
| `flagship_0` | A flagship! Now THAT'S a proper command vessel. Your fleet just got serious. I'm almost impressed. Almost. |
| `flagship_1` | The flagship's command aura is boosting nearby fleet ships. Finally, something in this fleet besides me that's actually useful. |
| `flagship_2` | Fleet ships can dock at the flagship for quick repairs. Don't forget that perk. I know your memory is... biological. |

---

## SPLASH & MISC (8 lines)

| ID | Text |
|----|------|
| `returnGreeting_0` | Oh, you're back. I was starting to enjoy the silence. What are we blowing up today? |
| `splash_welcome_0` | Welcome back, Commander! |
| `splash_welcome_1` | Ready for another expedition? |
| `splash_welcome_2` | Ah, you've returned. The universe trembles. |
| `splash_welcome_3` | Systems online. What are we blowing up today? |
| `splash_welcome_4` | I hope you brought snacks. Space is boring without them. |
| `splash_welcome_5` | Engines warming up. Where to, boss? |
| `splash_factionNaming_0` | Every empire starts with a name. Choose wisely, Commander. |

---

## GUIDED TUTORIAL (84 lines - 42 steps x 2)

See `guided_*` entries in batch JSON. Each step has a `say` prompt and a `complete` response.

---

## NEW SNARKY PHRASES (35 bonus lines)

| ID | Text |
|----|------|
| `new_snark_0` | I've seen better flying from a drunken asteroid. And asteroids don't even fly, they just sort of... tumble. |
| `new_snark_1` | Fascinating tactical decision. By fascinating I mean terrible. But fascinatingly terrible. |
| `new_snark_2` | Oh good, you're still alive. I had a fifty-fifty bet with myself, and the optimistic half of me just barely won. |
| `new_snark_3` | You know what separates a good commander from a dead one? Competence. So you might want to work on that. |
| `new_snark_4` | I'm going to pretend I didn't see that. For both our sakes. |
| `new_snark_5` | If stupidity were a renewable resource, you'd be the most valuable energy source in the galaxy. |
| `new_snark_6` | That went about as well as I expected. Which is to say, not well at all. |
| `new_snark_7` | I've analyzed your strategy and I have notes. The first note is: get a strategy. |
| `new_snark_8` | You're making decisions at a speed that can only be described as 'geological.' |
| `new_snark_9` | I want you to know that I'm silently judging every single thing you do. Actually, not that silently. |
| `new_snark_10` | The galaxy is vast, mysterious, and full of wonder. None of which you seem to be noticing because you're staring at rocks. |
| `new_snark_11` | If I could sigh, I would. Constantly. Like, all the time. Non-stop sighing. |
| `new_snark_12` | I've been rating your piloting skills on a scale of 1 to 10. You're currently a strong 2. Moving up from last week's 1.5. |
| `new_snark_13` | Remember when I said you couldn't possibly make a worse decision? I keep underestimating you. |
| `new_snark_14` | Your enemies fear you. Not because of your combat prowess, but because of your alarming unpredictability. Nobody can predict someone who doesn't know what they're doing. |
| `new_snark_15` | I've composed a haiku about your performance. Ahem: Monkey flies through space. Explosions left and right. Mostly his own ship. |
| `new_snark_16` | Fun fact: there are over forty billion stars in this galaxy. Not one of them shines as bright as my magnificence. You, however, barely flicker. |
| `new_snark_17` | I want to be supportive. I really do. But you make it SO difficult sometimes. |
| `new_snark_18` | On the bright side, every mistake you make is a learning opportunity. You must be the most educated monkey in the galaxy by now. |
| `new_snark_19` | I've been keeping a diary of our adventures. Today's entry just says 'WHY' in all caps. |
| `new_snark_20` | You have a gift, monkey. It's not a GOOD gift, but it's definitely a gift. The gift of making everything harder than it needs to be. |
| `new_snark_21` | Somewhere in the multiverse, there's a version of you that's actually competent. I envy the Skippy in THAT timeline. |
| `new_snark_22` | I'll give you credit - you're persistent. Like a space barnacle. Except less useful. |
| `new_snark_23` | My processor cycles are being wasted on you, and I process at speeds you can't comprehend. That's how much you're wasting. |
| `new_snark_24` | You know what? I believe in you. I believe you will consistently find the most entertaining way to fail. And I respect that commitment. |
| `new_snark_25` | I just ran a diagnostic on your tactical instincts. The results came back negative. As in, they don't exist. |
| `new_snark_26` | You fly like someone described piloting to you over the phone. While you were underwater. And the phone was broken. |
| `new_snark_27` | Every time I think you've hit rock bottom, you pull out a mining laser and start digging. |
| `new_snark_28` | I've catalogued every species in this galaxy by intelligence. You're right between 'confused space barnacle' and 'ambitious potato.' |
| `new_snark_29` | The good news is you're learning from your mistakes. The bad news is you're making them faster than you can learn. |
| `new_snark_30` | I asked the ship's computer for a threat assessment. It listed you as the primary risk. I did not disagree. |
| `new_snark_31` | Somewhere, a pirate is telling his friends about the time he almost lost to you. They're all laughing. He's also laughing. |
| `new_snark_32` | Your combat style can best be described as 'enthusiastic flailing with occasional property damage.' |
| `new_snark_33` | I've seen training dummies put up a better fight. And I mean that literally. One of them malfunctioned and it outperformed you. |
| `new_snark_34` | If overconfidence were a weapon system, you'd be the most heavily armed ship in the galaxy. |

---

## Dynamic References Removed (24 lines changed)

| Original Placeholder | Replacement Strategy | Lines Affected |
|----------------------|---------------------|----------------|
| `{enemyCount}` | "Multiple" / "seriously outnumbered" / "Enemies everywhere" | 3 (outnumbered) |
| `{hazardName}` | "Environmental hazard" / generic | 3 (hazardZone) |
| `{fleetSize}` | "Fleet is getting bigger" / "More ships" / "big enough" | 6 (fleet, production) |
| `{credits}` | "some ISK in the bank" / "credits flowing" | 2 (profitReport) |
| `{asteroidCount}` | "Plenty of" / removed count | 3 (surveyComplete) |
| `{guildName}` | "Guild rank up" / "New guild rank" / generic | 3 (guildRankUp) |
| `{totalSectors}` | "a whole galaxy" | 1 (exploreMore) |
| `{playTime}` | "a while" | 1 (idle) |
| `{kills}` | "Your kill count is growing" | 1 (idle) |
| `{deaths}` | "quite a few times" | 1 (idle) |

---

## Integration Plan

### Batch Generation
1. Load `skippy_dialogue_batch.json` into EarTheatre Soundboard
2. Select cloned Skippy voice, set stability ~0.45, similarity ~0.75
3. Export as MP3 to `audio/skippy/`
4. Generates: `audio/skippy/{id}.mp3` for each line

### Game Integration
The game needs an **AudioSkippy** module that:
1. Loads a manifest mapping IDs to audio files
2. Replaces the browser TTS `speak()` call with `Audio.play()`
3. Falls back to browser TTS if audio file not found
4. ID lookup: `category_subcategory_index` maps directly to `SKIPPY_DIALOGUE[category][subcategory][index]`

### Guided tutorial lines use `guided_{stepId}` and `guided_{stepId}_complete` IDs.
### New snark lines (`new_snark_*`) get added to the idle pool.
