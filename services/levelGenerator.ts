// FIX: Replaced import from '../types' with '../modules/content-types' to use the correct LevelData type.
import { LevelData, Vector2, GameObject, Patrol, ResourceType } from '../modules/content-types';

const getRandomInt = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// --- Cellular Automata Map Generation ---

const generateTiles = (width: number, height: number): { tiles: string[][], openTiles: Vector2[] } => {
  let tiles = Array.from({ length: height }, () => Array(width).fill('.'));

  // 1. Randomly fill the map
  const wallProbability = 0.45;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create a border of walls
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        tiles[y][x] = 'X';
      } else {
        tiles[y][x] = Math.random() < wallProbability ? 'X' : '.';
      }
    }
  }

  // 2. Run simulation steps to form caves
  const simulationSteps = 5;
  for (let i = 0; i < simulationSteps; i++) {
    const newTiles = tiles.map(arr => [...arr]);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const surroundingWalls = countSurroundingWalls(x, y, tiles);
        if (surroundingWalls > 4) {
          newTiles[y][x] = 'X';
        } else if (surroundingWalls < 4) {
          newTiles[y][x] = '.';
        }
      }
    }
    tiles = newTiles;
  }

  // 3. Find the largest connected area and fill in the rest
  const { largestArea, allAreas } = findConnectedAreas(tiles);
  
  // Fill all smaller areas with walls
  allAreas.forEach(area => {
      if (area !== largestArea) {
          area.forEach(([x, y]) => {
              tiles[y][x] = 'X';
          });
      }
  });

  return { tiles, openTiles: largestArea || [] };
};

const countSurroundingWalls = (x: number, y: number, tiles: string[][]): number => {
  let wallCount = 0;
  for (let j = y - 1; j <= y + 1; j++) {
    for (let i = x - 1; i <= x + 1; i++) {
      if (i === x && j === y) continue;
      // Consider out-of-bounds as walls
      if (i < 0 || i >= tiles[0].length || j < 0 || j >= tiles.length || tiles[j][i] === 'X') {
        wallCount++;
      }
    }
  }
  return wallCount;
};

const findConnectedAreas = (tiles: string[][]): { largestArea: Vector2[] | null, allAreas: Vector2[][] } => {
    const visited = new Set<string>();
    const allAreas: Vector2[][] = [];

    for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < tiles[0].length; x++) {
            const key = `${x},${y}`;
            if (tiles[y][x] === '.' && !visited.has(key)) {
                const newArea: Vector2[] = [];
                const queue: Vector2[] = [[x, y]];
                visited.add(key);

                while (queue.length > 0) {
                    const [cx, cy] = queue.shift()!;
                    newArea.push([cx, cy]);

                    const neighbors: Vector2[] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                    for (const [dx, dy] of neighbors) {
                        const nx = cx + dx;
                        const ny = cy + dy;
                        const nKey = `${nx},${ny}`;
                        if (
                            nx >= 0 && nx < tiles[0].length && ny >= 0 && ny < tiles.length &&
                            tiles[ny][nx] === '.' && !visited.has(nKey)
                        ) {
                            visited.add(nKey);
                            queue.push([nx, ny]);
                        }
                    }
                }
                allAreas.push(newArea);
            }
        }
    }

    allAreas.sort((a, b) => b.length - a.length);
    return { largestArea: allAreas[0] || null, allAreas };
};


// --- Object and Patrol Placement ---

const generatePatrols = (openTiles: Vector2[], difficulty: number): Patrol[] => {
  const patrols: Patrol[] = [];
  if (openTiles.length < 20) return []; // Not enough space for patrols

  const numPatrols = Math.min(4, Math.floor(1 + difficulty / 2));

  for (let i = 0; i < numPatrols; i++) {
    const path: Vector2[] = [];
    const startIndex = getRandomInt(0, openTiles.length - 1);
    let startPos = openTiles[startIndex];
    
    // Find a second point far away
    let endPos = startPos;
    let maxDist = 0;
    for(let j = 0; j < 10; j++) { // try 10 times to find a distant point
        const candidateIndex = getRandomInt(0, openTiles.length - 1);
        const candidatePos = openTiles[candidateIndex];
        const dist = Math.hypot(candidatePos[0] - startPos[0], candidatePos[1] - startPos[1]);
        if(dist > maxDist) {
            maxDist = dist;
            endPos = candidatePos;
        }
    }

    path.push(startPos);
    path.push(endPos);

    patrols.push({
      path,
      speed: parseFloat((Math.random() * 1.5 + 1 + (difficulty * 0.1)).toFixed(2)),
      type: "drone"
    });
  }
  return patrols;
};

const generateGameObjects = (openTiles: Vector2[], difficulty: number, startPos: Vector2): GameObject[] => {
  const objects: GameObject[] = [];
  // Use a copy so we can remove spots
  const availableSpots = [...openTiles];

  // Helper to get a random open spot and remove it from the list
  const placeObject = (): Vector2 | null => {
    if (availableSpots.length === 0) return null;
    const index = getRandomInt(0, availableSpots.length - 1);
    const pos = availableSpots[index];
    availableSpots.splice(index, 1);
    return pos;
  };
  
  let objectIdCounter = 1;

  // Add Credit Pickups
  const numCredits = getRandomInt(2, 4) + Math.floor(difficulty / 4);
  for (let i = 0; i < numCredits; i++) {
    const pos = placeObject();
    if (pos) {
      objects.push({ id: `pickup-${objectIdCounter++}`, type: "credit", pos, value: [50, 100, 150][getRandomInt(0, 2)] });
    }
  }

  // Add Mines
  const numMines = getRandomInt(3, 6) + Math.floor(difficulty / 2);
  for (let i = 0; i < numMines; i++) {
    const pos = placeObject();
    if (pos) {
      objects.push({ id: `hazard-${objectIdCounter++}`, type: "mine", pos, damage: 20 });
    }
  }

  // Add an Exit Portal, far from the player's start
  let portalPos: Vector2 | null = null;
  let maxDist = -1;
  availableSpots.forEach(spot => {
      const dist = Math.hypot(spot[0] - startPos[0], spot[1] - startPos[1]);
      if (dist > maxDist) {
          maxDist = dist;
          portalPos = spot;
      }
  });

  if (portalPos) {
    objects.push({ id: `portal-${objectIdCounter++}`, type: "exit", pos: portalPos, target: `isle-${getRandomInt(100, 999)}` });
    // Remove it from available spots
    const portalIndex = availableSpots.findIndex(p => p[0] === portalPos![0] && p[1] === portalPos![1]);
    if (portalIndex > -1) availableSpots.splice(portalIndex, 1);
  }
  
  // Add dedicated Fuel (Energy) Pickups, as requested
  const numFuelPickups = getRandomInt(4, 6) + Math.floor(difficulty / 2);
  for (let i = 0; i < numFuelPickups; i++) {
    const pos = placeObject();
    if (pos) {
        objects.push({ id: `resource-${objectIdCounter++}`, type: "fuel", pos });
    }
  }
  
  // Add other resource pickups (shard, overcharge)
  const numOtherResources = getRandomInt(1, 3) + Math.floor(difficulty / 3);
  const otherResourceTypes: ResourceType[] = ["shard", "overcharge"];
  for (let i = 0; i < numOtherResources; i++) {
    const pos = placeObject();
    if (pos) {
        objects.push({ id: `resource-${objectIdCounter++}`, type: otherResourceTypes[getRandomInt(0, otherResourceTypes.length - 1)], pos });
    }
  }

  return objects;
};


// --- Main Export ---

// FIX: Changed return type from 'Level' to 'LevelData' to match the object being created.
export const generateLevel = (difficulty: number = 1, width?: number, height?: number): LevelData => {
  const mapWidth = width || getRandomInt(30, 50);
  const mapHeight = height || getRandomInt(20, 40);

  const { tiles, openTiles } = generateTiles(mapWidth, mapHeight);

  if (openTiles.length < 50) { // Check for a viable map
      console.warn("Generated map is too small or fragmented. Retrying...");
      return generateLevel(difficulty, width, height); // Retry generation
  }

  // Find a good starting position for the player
  // 1. Find geometric center of open space
  const sumPos = openTiles.reduce((acc, pos) => [acc[0] + pos[0], acc[1] + pos[1]], [0, 0]);
  const centerPos: Vector2 = [Math.round(sumPos[0] / openTiles.length), Math.round(sumPos[1] / openTiles.length)];
  
  // 2. Find the closest actual open tile to that center
  let startPos: Vector2 = openTiles[0];
  let minDistance = Infinity;
  for (const tile of openTiles) {
      const distance = Math.hypot(tile[0] - centerPos[0], tile[1] - centerPos[1]);
      if (distance < minDistance) {
          minDistance = distance;
          startPos = tile;
      }
  }
  
  // 3. Add pits to the level, avoiding the spawn area
  const numPits = Math.floor(openTiles.length / 60) + Math.floor(difficulty / 3);
  const safeRadius = 5;
  const pitCandidates = openTiles.filter(tile => {
      // Ensure it's not the start position itself or too close
      const dist = Math.hypot(tile[0] - startPos[0], tile[1] - startPos[1]);
      return dist > safeRadius;
  });

  for (let i = 0; i < numPits; i++) {
      if (pitCandidates.length === 0) break;
      const randIndex = getRandomInt(0, pitCandidates.length - 1);
      const [pitX, pitY] = pitCandidates.splice(randIndex, 1)[0];
      if (tiles[pitY][pitX] === '.') {
          tiles[pitY][pitX] = 'O'; // 'O' for Open pit
      }
  }
  
  // 4. Place the spawn marker
  tiles[startPos[1]][startPos[0]] = '#';

  // FIX: Changed type from 'Level' to 'LevelData' to include width and height properties.
  const level: LevelData = {
    id: `isle-${getRandomInt(100, 999)}`,
    seed: Date.now() + getRandomInt(0, 10000),
    width: mapWidth,
    height: mapHeight,
    wind: {
      amp: parseFloat((Math.random() + 0.5 + (difficulty * 1.2)).toFixed(2)),
      scale: parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)),
      gusts: [getRandomInt(0, 5), getRandomInt(0, 5), getRandomInt(0, 5)],
    },
    tiles,
    patrols: generatePatrols(openTiles, difficulty),
    gameObjects: generateGameObjects(openTiles, difficulty, startPos),
  };

  return level;
};