import * as loader from './content-loader';
import { gameState, storage, calculateGliderStats } from './game-state';
import { Scene } from '../game/scene';
import { GliderPart } from './content-types';
import { soundManager } from './sound-manager';

let gameScene: Scene | null = null;
let workshopVisible = false;

// --- Temporary selections before "Launch" is clicked ---
let selectedChassisId: string;
let selectedWingsId: string;
let selectedEngineId: string;

function setupGameControls(scene: Scene) {
    const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
    const pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
    const workshopBtn = document.getElementById('btn-workshop') as HTMLButtonElement;
    const muteBtn = document.getElementById('btn-mute') as HTMLButtonElement;
    const workshopScreen = document.getElementById('workshop-screen') as HTMLDivElement;

    if (!startBtn || !pauseBtn || !workshopBtn || !muteBtn) return;

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    startBtn.addEventListener('click', () => {
        scene.start();
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        canvas.focus();
    });

    pauseBtn.addEventListener('click', () => {
        scene.pause();
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
    });

    workshopBtn.addEventListener('click', () => {
        scene.pause();
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        workshopVisible = true;
        workshopScreen.classList.add('visible');
    });
    
    muteBtn.addEventListener('click', () => {
        const isMuted = soundManager.toggleMute();
        document.getElementById('icon-sound-on')!.style.display = isMuted ? 'none' : 'block';
        document.getElementById('icon-sound-off')!.style.display = isMuted ? 'block' : 'none';
    });

    const restartBtn = document.getElementById('btn-restart');
    restartBtn?.addEventListener('click', () => {
        document.getElementById('game-over-screen')?.classList.remove('visible');
        workshopScreen.classList.add('visible');
        workshopVisible = true;
        renderWorkshop(); 
    });
}

function updateGliderStatsDisplay() {
    const stats = calculateGliderStats(selectedChassisId, selectedWingsId, selectedEngineId);
    const statsListEl = document.getElementById('glider-stats-list');
    if (statsListEl) {
        statsListEl.innerHTML = `
            <li><span>Max Health:</span> <span class="value">${stats.maxHealth.toFixed(0)}</span></li>
            <li><span>Max Energy:</span> <span class="value">${stats.maxEnergy.toFixed(0)}</span></li>
            <li><span>Energy Regen:</span> <span class="value">${stats.energyRegen.toFixed(2)}/s</span></li>
            <li><span>Gadget Slots:</span> <span class="value">${stats.gadgetSlots}</span></li>
            <li><span>Turn Speed:</span> <span class="value">${stats.physics.rotation_speed.toFixed(2)}</span></li>
            <li><span>Stabilization:</span> <span class="value">${stats.physics.stabilization.toFixed(2)}</span></li>
            <li><span>Boost Power:</span> <span class="value">${stats.physics.boost_impulse.toFixed(0)}</span></li>
        `;
    }
}

function renderPartList(
    listId: string, 
    parts: GliderPart[], 
    purchasedIds: Set<string>, 
    equippedId: string,
    onSelect: (partId: string) => void
) {
    const listEl = document.getElementById(listId);
    if (!listEl) return;
    listEl.innerHTML = '';

    parts.forEach(part => {
        const isPurchased = purchasedIds.has(part.id);
        const isEquipped = part.id === equippedId;
        const canAfford = gameState.playerCurrency >= part.cost;

        const item = document.createElement('div');
        item.className = 'part-item';
        if (isEquipped) item.classList.add('equipped');

        let buttonHtml: string;
        if (isEquipped) {
            buttonHtml = `<button class="control-btn" disabled>ЭКИПИРОВАНО</button>`;
        } else if (isPurchased) {
            buttonHtml = `<button class="control-btn" data-equip-id="${part.id}">ВЫБРАТЬ</button>`;
        } else {
            buttonHtml = `<button class="control-btn" data-buy-id="${part.id}" ${canAfford ? '' : 'disabled'}>КУПИТЬ (${part.cost} C)</button>`;
        }

        item.innerHTML = `
            <h4>${part.name}</h4>
            <p>${part.description}</p>
            ${buttonHtml}
        `;
        listEl.appendChild(item);

        item.querySelector(`[data-equip-id]`)?.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelect(part.id);
        });

        item.querySelector(`[data-buy-id]`)?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (gameState.playerProfile && gameState.playerCurrency >= part.cost) {
                gameState.playerCurrency -= part.cost;
                gameState.playerProfile.purchasedParts.push(part.id);
                onSelect(part.id); // auto-equip on buy
                renderWorkshop(); // Re-render everything
            }
        });
    });
}


function renderWorkshop() {
    if (!gameState.playerProfile) return;

    const currencyEl = document.getElementById('workshop-currency');
    if(currencyEl) currencyEl.textContent = gameState.playerCurrency.toString();

    const purchasedParts = new Set(gameState.playerProfile.purchasedParts);

    renderPartList('chassis-list', gameState.allChassis, purchasedParts, selectedChassisId, (id) => {
        selectedChassisId = id;
        renderWorkshop();
    });
    renderPartList('wings-list', gameState.allWings, purchasedParts, selectedWingsId, (id) => {
        selectedWingsId = id;
        renderWorkshop();
    });
    renderPartList('engine-list', gameState.allEngines, purchasedParts, selectedEngineId, (id) => {
        selectedEngineId = id;
        renderWorkshop();
    });
    
    updateGliderStatsDisplay();
}


export async function applyAllContent(canvas: HTMLCanvasElement, loadingScreen: HTMLDivElement) {
  try {
    loadingScreen.classList.remove('hidden');

    const manifest = await loader.loadManifest();
    const { version, assets } = manifest;

    const [
      level, gadgets, challenges, events, tutorial,
      glider, physics, biomes, playerProgress, melody,
      chassis, wings, engines
    ] = await Promise.all([
      loader.loadLevel(assets.level, version),
      loader.loadGadgets(assets.gadgets, version),
      loader.loadChallenges(assets.challenges, version),
      loader.loadEvents(assets.events, version),
      loader.loadTutorialMarkdown(assets.tutorial, version),
      loader.loadGlider(assets.glider, version),
      loader.loadPhysics(assets.physics, version),
      loader.loadBiomes(assets.biomes, version),
      loader.loadPlayerProgress(assets.player_progress, version),
      loader.loadMelody(assets.melody, version),
      loader.loadChassis(assets.chassis, version),
      loader.loadWings(assets.wings, version),
      loader.loadEngines(assets.engines, version),
      loader.preloadIcons()
    ]);

    const profile = await storage.loadPlayerProfile() ?? { 
        id: 'default', 
        currency: 500, 
        purchasedParts: ["chassis-light", "wings-standard", "engine-basic"], 
        equippedChassis: "chassis-light",
        equippedWings: "wings-standard",
        equippedEngine: "engine-basic",
        pilotLevel: 1, 
        experience: 0 
    };

    gameState.setContent({ 
        level, gadgets, challenges, events, tutorial, glider, physics, biomes, playerProgress, melody,
        chassis, wings, engines
    }, profile);
    
    selectedChassisId = profile.equippedChassis;
    selectedWingsId = profile.equippedWings;
    selectedEngineId = profile.equippedEngine;
    
    const workshopScreen = document.getElementById('workshop-screen') as HTMLDivElement;
    const startMissionBtn = document.getElementById('workshop-start-btn') as HTMLButtonElement;
    
    renderWorkshop();
    workshopScreen.classList.add('visible');
    workshopVisible = true;

    startMissionBtn.addEventListener('click', async () => {
        if (!gameState.playerProfile) return;

        // Save equipped parts to profile
        gameState.playerProfile.equippedChassis = selectedChassisId;
        gameState.playerProfile.equippedWings = selectedWingsId;
        gameState.playerProfile.equippedEngine = selectedEngineId;
        await gameState.saveProfile();
        
        await soundManager.init();
        soundManager.setMelody(gameState.melody!);
        soundManager.startBGM();

        const finalStats = calculateGliderStats(selectedChassisId, selectedWingsId, selectedEngineId);
        
        workshopScreen.classList.remove('visible');
        workshopVisible = false;
        loadingScreen.classList.remove('hidden');

        if (!gameScene) {
            gameScene = new Scene(canvas, finalStats);
            await gameScene.init();
            setupGameControls(gameScene);
        } else {
            // Update scene with new stats if it already exists
            gameScene.updatePlayerStats(finalStats);
        }
        
        gameScene.restartGame();
        
        const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
        const pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
        if (startBtn && pauseBtn) {
            startBtn.style.display = 'none';
            pauseBtn.style.display = 'inline-block';
        }
        
        loadingScreen.classList.add('hidden');
        canvas.focus();
    });

  } catch (error) {
    console.error("A critical error occurred during content loading:", error);
    loadingScreen.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 20px;">
        <h2>Error Loading Game</h2>
        <p>Could not load essential game assets. Please check the console for details and try refreshing the page.</p>
    </div>`;
    throw error;
  } finally {
    loadingScreen.classList.add('hidden');
  }
}