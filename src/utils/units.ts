// units.ts
// Stable lookup data for the unit picker in product edit UI.
// Kept as a constant rather than a DB table — units don't change,
// can't be user-defined at this stage, and don't need backup/restore.

export type UnitSymbol = 'g' | 'ml' | 'un';
export type UnitFamily = 'massa' | 'volume' | 'contagem';

export type Unit = {
  symbol: UnitSymbol;
  label: string;      // display name: 'Grama', 'Mililitro', etc.
  family: UnitFamily;
};

export const UNITS: Unit[] = [
  { symbol: 'g',  label: 'Grama',      family: 'massa' },
  { symbol: 'ml', label: 'Mililitro',  family: 'volume' },
  { symbol: 'un', label: 'Unidade',    family: 'contagem' },
];

// Convenience lookup by symbol
export const UNIT_BY_SYMBOL = new Map<UnitSymbol, Unit>(
  UNITS.map(u => [u.symbol, u])
);

export const formatStandardPackageDisplay = (unit: string, standardPackageSize: number): string => {
  if (unit === 'g' && standardPackageSize % 1000 === 0) return `${standardPackageSize / 1000}kg`;
  if (unit === 'ml' && standardPackageSize % 1000 === 0) return `${standardPackageSize / 1000}L`;
  return `${standardPackageSize}${unit}`;
};

export const getPricePerPackageLabel = (unit: string | null | undefined, standardPackageSize: number | null | undefined): string => {
  if (!unit || !standardPackageSize || standardPackageSize <= 0) return 'Preço por emb. padrão';
  return `Preço por ${formatStandardPackageDisplay(unit, standardPackageSize)}`;
};
