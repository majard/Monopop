// units.ts
// Stable lookup data for the unit picker in product edit UI.
// Kept as a constant rather than a DB table — units don't change,
// can't be user-defined at this stage, and don't need backup/restore.

export type UnitSymbol = 'g' | 'kg' | 'ml' | 'L' | 'un' | 'cx' | 'pct' | 'dz' | 'par';
export type UnitFamily = 'massa' | 'volume' | 'contagem';

export type Unit = {
  symbol: UnitSymbol;
  label: string;      // display name: 'Grama', 'Mililitro', etc.
  family: UnitFamily;
  // How "Preço por X" reads in the EditSLI modal.
  // Mass and volume collapse to their larger unit (g→kg, ml→L) for readability.
  priceLabel: string; // e.g. 'Preço por kg', 'Preço por L', 'Preço por unidade'
};

export const UNITS: Unit[] = [
  { symbol: 'g',   label: 'Grama',      family: 'massa',    priceLabel: 'Preço por kg'      },
  { symbol: 'kg',  label: 'Quilograma', family: 'massa',    priceLabel: 'Preço por kg'      },
  { symbol: 'ml',  label: 'Mililitro',  family: 'volume',   priceLabel: 'Preço por L'       },
  { symbol: 'L',   label: 'Litro',      family: 'volume',   priceLabel: 'Preço por L'       },
  { symbol: 'un',  label: 'Unidade',    family: 'contagem', priceLabel: 'Preço por unidade' },
  { symbol: 'cx',  label: 'Caixa',      family: 'contagem', priceLabel: 'Preço por unidade' },
  { symbol: 'pct', label: 'Pacote',     family: 'contagem', priceLabel: 'Preço por unidade' },
  { symbol: 'dz',  label: 'Dúzia',      family: 'contagem', priceLabel: 'Preço por unidade' },
  { symbol: 'par', label: 'Par',        family: 'contagem', priceLabel: 'Preço por unidade' },
];

// Convenience lookup by symbol
export const UNIT_BY_SYMBOL = new Map<UnitSymbol, Unit>(
  UNITS.map(u => [u.symbol, u])
);

export const getPriceLabel = (symbol: UnitSymbol | null | undefined): string => {
  if (!symbol) return 'Preço';
  return UNIT_BY_SYMBOL.get(symbol)?.priceLabel ?? 'Preço por unidade';
};
