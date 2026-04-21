import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { Project } from '@/types/project';

const DB_NAME = 'TileLayoutProDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

interface TileLayoutSchema extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
}

let dbPromise: Promise<IDBPDatabase<TileLayoutSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<TileLayoutSchema>> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in the browser'));
  }
  if (!dbPromise) {
    dbPromise = openDB<TileLayoutSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const projectsDb = {
  async getAll(): Promise<Project[]> {
    const db = await getDb();
    return db.getAll(STORE_NAME);
  },

  async get(id: string): Promise<Project | undefined> {
    const db = await getDb();
    return db.get(STORE_NAME, id);
  },

  async save(project: Project): Promise<void> {
    const db = await getDb();
    await db.put(STORE_NAME, { ...project, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(STORE_NAME, id);
  },
};
