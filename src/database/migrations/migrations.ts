import * as SQLite from "expo-sqlite";
import { migrateToV1 } from './migrateToV1';
import { migrateToV2 } from './migrateToV2';
import { migrateToV3 } from './migrateToV3';

export const CURRENT_DATABASE_VERSION = 3;

export const runMigrations = async (db: SQLite.SQLiteDatabase, currentVersion: number) => {
    if (currentVersion < 1) {
        await migrateToV1(db);
        await db.runAsync('PRAGMA user_version = 1;');
    }
    if (currentVersion < 2) {
        try {
            // This function is not supported on web.
            await db.withExclusiveTransactionAsync(async () => {
              await migrateToV2(db);
              await db.runAsync('PRAGMA user_version = 2;');
            });
          } catch (e) {
            console.error("Migration to V2 failed:", e);
            throw e;
          }
    }

    if (currentVersion < 3) {
        try {
            await db.withExclusiveTransactionAsync(async () => {
              await migrateToV3(db);
              await db.runAsync('PRAGMA user_version = 3;');
            });
          } catch (e) {
            console.error("Migration to V3 failed:", e);
            throw e;
          }
    }
};