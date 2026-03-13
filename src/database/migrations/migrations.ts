import * as SQLite from "expo-sqlite";
import { migrateToV1 } from './migrateToV1';
import { migrateToV2 } from './migrateToV2';
import { migrateToV3 } from './migrateToV3';
import { migrateToV4 } from './migrateToV4';
import { migrateToV5 } from './migrateToV5';
import { migrateToV6 } from './migrateToV6';
import { migrateToV7 } from './migrateToV7';
import { migrateToV8 } from './migrateToV8';
import { migrateToV9 } from './migrateToV9';
import { migrateToV10 } from './migrateToV10';

export const CURRENT_DATABASE_VERSION = 10;

export const runMigrations = async (db: SQLite.SQLiteDatabase, currentVersion: number) => {
    if (currentVersion < 1) {
        await migrateToV1(db);
        await db.runAsync('PRAGMA user_version = 1;');
    }
    if (currentVersion < 2) {
        try {
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
    if (currentVersion < 4) {
        try {
            await db.withExclusiveTransactionAsync(async () => {
              await migrateToV4(db);
              await db.runAsync('PRAGMA user_version = 4;');
            });
          } catch (e) {
            console.error("Migration to V4 failed:", e);
            throw e;
          }
    }
    if (currentVersion < 5) {
        await migrateToV5(db);
        await db.runAsync('PRAGMA user_version = 5;');
    }
    if (currentVersion < 6) {
        await migrateToV6(db);
        await db.runAsync('PRAGMA user_version = 6;');
    }
    if (currentVersion < 7) {
        await migrateToV7(db);
        await db.runAsync('PRAGMA user_version = 7;');
    }
    if (currentVersion < 8) {
        await migrateToV8(db);
        await db.runAsync('PRAGMA user_version = 8;');
    }
    if (currentVersion < 9) {
        await migrateToV9(db);
        await db.runAsync('PRAGMA user_version = 9;');
    }
    if (currentVersion < 10) {
        try {
            await db.withExclusiveTransactionAsync(async () => {
              await migrateToV10(db);
              await db.runAsync('PRAGMA user_version = 10;');
            });
          } catch (e) {
            console.error("Migration to V10 failed:", e);
            throw e;
          }
    }
};