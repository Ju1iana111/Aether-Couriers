import {
  Manifest, LevelData, Gadget, StoryEvent, Challenge, Glider, GliderPhysics, Biome, PlayerProgress, Melody,
  GliderChassis, GliderWings, GliderEngine,
  isLevelData, isGadgetArray, isStoryEventArray, isChallengeArray, isGlider, isGliderPhysics, isBiomeArray, isPlayerProgressArray, isMelody,
  isChassisArray, isWingsArray, isEngineArray
} from './content-types';

const CACHE_KEY_PREFIX = 'AETHER_CACHE_';
const VERSION_KEY = 'AETHER_VERSION';

// --- Core Caching Logic ---

async function fetchAndCache<T>(url: string, manifestVersion: string, validator: (obj: any) => obj is T): Promise<T> {
  const cachedVersion = localStorage.getItem(VERSION_KEY);
  const cacheKey = `${CACHE_KEY_PREFIX}${url}`;

  if (cachedVersion !== manifestVersion) {
    console.log(`Manifest version changed from ${cachedVersion} to ${manifestVersion}. Clearing cache.`);
    // In a real scenario, you might want a more nuanced cache clearing
    Object.keys(localStorage)
      .filter(key => key.startsWith(CACHE_KEY_PREFIX) || key === VERSION_KEY)
      .forEach(key => localStorage.removeItem(key));
    localStorage.setItem(VERSION_KEY, manifestVersion);
  }

  const cachedData = localStorage.getItem(cacheKey);
  if (cachedData) {
    try {
      const parsedData = JSON.parse(cachedData);
      if (validator(parsedData)) {
        return parsedData;
      }
    } catch (e) {
      console.warn(`Failed to parse cached data for ${url}. Refetching.`, e);
      localStorage.removeItem(cacheKey);
    }
  }

  // Fetch new data
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} for ${url}`);
    }
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error(`Error parsing JSON from ${url}. The file content is likely not valid JSON. Raw text:`);
        console.error(text);
        throw e;
    }

    if (!validator(data)) {
        // Find the first invalid item to help debugging
        if(Array.isArray(data)) {
            const invalidItem = data.find(item => !validator([item])); // This is a trick; validator needs to handle single item arrays
            console.error(`Validation failed for an item in ${url}:`, invalidItem);
        }
      throw new TypeError(`Invalid data structure for ${url}. Check the JSON content and content-types.ts.`);
    }
    
    localStorage.setItem(cacheKey, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error(`Failed to load or validate JSON from ${url}:`, error);
    throw error;
  }
}

async function fetchTextAndCache(url: string, manifestVersion: string): Promise<string> {
    // Simplified caching for text files like Markdown
    const cachedVersion = localStorage.getItem(VERSION_KEY);
    const cacheKey = `${CACHE_KEY_PREFIX}${url}`;
     if (cachedVersion !== manifestVersion) {
        // version mismatch handled in JSON part, but good to have here too
        localStorage.removeItem(cacheKey);
     }
    const cachedData = localStorage.getItem(cacheKey);
    if(cachedData) return cachedData;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error fetching ${url}`);
    const textData = await response.text();
    localStorage.setItem(cacheKey, textData);
    return textData;
}


// --- Public Loader Functions ---

export const loadManifest = async (): Promise<Manifest> => {
    // Manifest is never cached, always fetched to get the latest version
    const response = await fetch('manifest.json');
    if (!response.ok) throw new Error("Could not load manifest.json!");
    return await response.json();
};

export const loadLevel = (url: string, version: string): Promise<LevelData> => 
  fetchAndCache(url, version, isLevelData);

export const loadGadgets = (url: string, version: string): Promise<Gadget[]> => 
  fetchAndCache(url, version, isGadgetArray);

export const loadChassis = (url: string, version: string): Promise<GliderChassis[]> =>
  fetchAndCache(url, version, isChassisArray);

export const loadWings = (url: string, version: string): Promise<GliderWings[]> =>
    fetchAndCache(url, version, isWingsArray);

export const loadEngines = (url: string, version: string): Promise<GliderEngine[]> =>
    fetchAndCache(url, version, isEngineArray);

export const loadEvents = (url: string, version: string): Promise<StoryEvent[]> => 
  fetchAndCache(url, version, isStoryEventArray);

export const loadChallenges = (url: string, version: string): Promise<Challenge[]> => 
  fetchAndCache(url, version, isChallengeArray);

export const loadTutorialMarkdown = (url: string, version: string): Promise<string> =>
  fetchTextAndCache(url, version);

export const loadGlider = (url: string, version: string): Promise<Glider> =>
  fetchAndCache(url, version, isGlider);

export const loadPhysics = (url: string, version: string): Promise<GliderPhysics> =>
  fetchAndCache(url, version, isGliderPhysics);

export const loadBiomes = (url: string, version: string): Promise<Biome[]> =>
  fetchAndCache(url, version, isBiomeArray);

export const loadPlayerProgress = (url: string, version: string): Promise<PlayerProgress[]> =>
    fetchAndCache(url, version, isPlayerProgressArray);

export const loadMelody = (url: string, version: string): Promise<Melody> =>
    fetchAndCache(url, version, isMelody);
  
export const preloadIcons = async (): Promise<void> => {
    // In this project, SVGs are embedded in HTML, so there's nothing to preload via fetch.
    // This function serves as a placeholder for a real-world scenario where icons might be separate files.
    console.log("Icon preloading step (no-op for this project).");
    return Promise.resolve();
};