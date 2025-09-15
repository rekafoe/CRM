const bynFormatter = new Intl.NumberFormat('ru-BY', {
  style: 'currency',
  currency: 'BYN',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatBYN(value: number | string): string {
  return bynFormatter.format(Number(value) || 0);
}
