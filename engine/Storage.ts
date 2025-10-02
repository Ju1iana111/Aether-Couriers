import { Vector2 } from '../types';
import { PlayerProfile } from '../modules/content-types';

interface GameState {
    currentLevel: string;
    playerPosition: Vector2;
}

const DB_NAME = 'AetherCouriersDB';
const DB_VERSION = 2; // Bump version for schema change
const GAME_STATE_STORE = 'gameState';
const PROFILE_STORE = 'playerProfile';


export class Storage {
  private db: IDBDatabase | null = null;
  private dbName: string;

  constructor(dbName: string = DB_NAME) {
      this.dbName = dbName;
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) {
        return this.db;
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, DB_VERSION);
        
        request.onerror = () => reject("Error opening IndexedDB");
        
        request.onsuccess = () => {
            this.db = request.result;
            resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(GAME_STATE_STORE)) {
                db.createObjectStore(GAME_STATE_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(PROFILE_STORE)) {
                db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
            }
        };
    });
  }

  public async saveGameState(state: GameState): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(GAME_STATE_STORE, 'readwrite');
    const store = transaction.objectStore(GAME_STATE_STORE);
    store.put({ id: 'current', ...state });

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject('Error saving game state');
    });
  }

  public async loadGameState(): Promise<GameState | null> {
    const db = await this.openDB();
    const transaction = db.transaction(GAME_STATE_STORE, 'readonly');
    const store = transaction.objectStore(GAME_STATE_STORE);
    const request = store.get('current');

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result ? request.result as GameState : null);
        };
        request.onerror = () => reject('Error loading game state');
    });
  }
  
  public async savePlayerProfile(profile: PlayerProfile): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction(PROFILE_STORE, 'readwrite');
    const store = transaction.objectStore(PROFILE_STORE);
    store.put(profile);

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(`Error saving player profile: ${event}`);
    });
  }

  public async loadPlayerProfile(): Promise<PlayerProfile | null> {
    const db = await this.openDB();
    const transaction = db.transaction(PROFILE_STORE, 'readonly');
    const store = transaction.objectStore(PROFILE_STORE);
    const request = store.get('default'); // We use a fixed key 'default'

    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result ? request.result as PlayerProfile : null);
        };
        request.onerror = () => reject('Error loading player profile');
    });
  }
}