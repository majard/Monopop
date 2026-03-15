// Stable lookup data for the unit picker and price formatting.
// Units are stored as atomic bases in the DB (g, ml, un).
// products.unit stores the display preference (g, kg, ml, L, un).
// packageSize and standardPackageSize are always stored in atomic units:
//   kg/g → grams, L/ml → millilitres, un → units
// The factor converts: atomicValue / factor = displayValue

export type UnitSymbol = 'g' | 'kg' | 'ml' | 'L' | 'un';
export type UnitFamily = 'massa' | 'volume' | 'contagem';

export type Unit = {
  symbol: UnitSymbol;
  family: UnitFamily;
  factor: number;          // atomicValue / factor = displayValue (e.g. 1000g / 1000 = 1kg)
  defaultStdSize: number;  // ghost default for stdSize input, in display units
};

export const UNITS: Unit[] = [
  { symbol: 'g',  family: 'massa',    factor: 1,    defaultStdSize: 400 },
  { symbol: 'kg', family: 'massa',    factor: 1000, defaultStdSize: 1   },
  { symbol: 'ml', family: 'volume',   factor: 1,    defaultStdSize: 500 },
  { symbol: 'L',  family: 'volume',   factor: 1000, defaultStdSize: 1   },
  { symbol: 'un', family: 'contagem', factor: 1,    defaultStdSize: 12  },
];

export const UNITS_BY_FAMILY: Record<UnitFamily, Unit[]> = {
  massa:    UNITS.filter(u => u.family === 'massa'),
  volume:   UNITS.filter(u => u.family === 'volume'),
  contagem: UNITS.filter(u => u.family === 'contagem'),
};

export const getUnitFactor = (symbol: UnitSymbol): number =>
  UNITS.find(u => u.symbol === symbol)?.factor ?? 1;

export const getFamilyOf = (symbol: UnitSymbol): UnitFamily =>
  UNITS.find(u => u.symbol === symbol)!.family;

/**
 * Formats an atomic value for display in the product's chosen unit.
 *
 * Examples:
 *   formatStandardPackageDisplay('kg', 1000) → '1kg'
 *   formatStandardPackageDisplay('kg', 500)  → '0.5kg'
 *   formatStandardPackageDisplay('g', 400)   → '400g'
 *   formatStandardPackageDisplay('un', 12)   → '12un'
 */
export const formatStandardPackageDisplay = (
  unit: UnitSymbol,
  atomicValue: number
): string => {
  const factor = getUnitFactor(unit);
  const display = atomicValue / factor;
  const displayStr = Number.isInteger(display)
    ? String(display)
    : display.toFixed(3).replace(/\.?0+$/, '');
  return `${displayStr}${unit}`;
};

/**
 * Label for the pricePerPackage field.
 * e.g. 'Preço por 1kg', 'Preço por 400g', 'Preço por 12un'
 */
export const getPricePerPackageLabel = (
  unit: UnitSymbol | null | undefined,
  standardPackageSize: number | null | undefined  // atomic
): string => {
  if (!unit || !standardPackageSize || standardPackageSize <= 0) {
    return 'Preço por emb. padrão';
  }
  return `Preço por ${formatStandardPackageDisplay(unit, standardPackageSize)}`;
};

/**
 * Formats a price-per-atomic-unit value as price per display unit.
 *
 * pricePerAtomicUnit: R$ per gram, R$ per ml, or R$ per unit
 * Result shows R$/kg, R$/L, R$/un as appropriate.
 *
 * Examples:
 *   formatPricePerUnitDisplay(0.035, 'kg')  → 'R$ 35,00/kg'
 *   formatPricePerUnitDisplay(0.035, 'g')   → 'R$ 0,035/g'
 *   formatPricePerUnitDisplay(0.667, 'un')  → 'R$ 0,667/un'
 */
export const formatPricePerUnitDisplay = (
  pricePerAtomicUnit: number,
  unit: UnitSymbol
): string => {
  const factor = getUnitFactor(unit);
  const pricePerDisplayUnit = pricePerAtomicUnit * factor;
  const s = pricePerDisplayUnit < 10
    ? pricePerDisplayUnit.toPrecision(4).replace(/\.?0+$/, '')
    : pricePerDisplayUnit.toFixed(2);
  return `R$ ${s.replace('.', ',')}/${unit}`;
};

/**
 * Formats a price for one standard package.
 *
 * pricePerAtomicUnit: R$ per gram, R$ per ml, or R$ per unit
 * stdSizeAtomic: standardPackageSize in atomic units
 *
 * Examples:
 *   formatPerStdPkg(0.035, 'kg', 1000) → 'R$ 35,00/1kg'
 *   formatPerStdPkg(0.035, 'g', 400)   → 'R$ 14,00/400g'
 */
export const formatPerStdPkg = (
  pricePerAtomicUnit: number,
  unit: UnitSymbol,
  stdSizeAtomic: number
): string => {
  const price = pricePerAtomicUnit * stdSizeAtomic;
  return `R$ ${price.toFixed(2).replace('.', ',')}/${formatStandardPackageDisplay(unit, stdSizeAtomic)}`;
};