import * as SQLite from "expo-sqlite";

export async function migrateToV7(db: SQLite.SQLiteDatabase) {
  console.log("Migrating to V7: Add default categories.");

  const categories = [
    'Purês',
    'Massas e Grãos Preparados',
    'Panquecas e Waffles',
    'Pães e Salgados',
    'Proteínas Preparadas',
    'Carnes e Peixes',
    'Laticínios e Ovos',
    'Frios e Embutidos',
    'Frutas',
    'Legumes e Verduras',
    'Congelados',
    'Cereais e Café da Manhã',
    'Farinhas e Fermentos',
    'Massas e Grãos',
    'Óleos, Vinagres e Temperos',
    'Molhos e Conservas',
    'Doces e Sobremesas',
    'Snacks e Petiscos',
    'Bebidas',
    'Bebidas Alcoólicas',
    'Higiene e Beleza',
    'Limpeza',
    'Casa e Utilidades',
    'Outros',
  ];

  for (const name of categories) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (name) VALUES (?);`,
      [name]
    );
  }
}
