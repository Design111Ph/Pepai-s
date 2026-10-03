export function formatCurrency(
  amount: number,
  symbol: string = '₱',
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 2
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return `${symbol}0.00`;
  }
  const formatted = amount.toLocaleString('en-PH', {
    minimumFractionDigits,
    maximumFractionDigits,
  });
  return `${symbol}${formatted}`;
}

export function formatPHP(
  amount: number,
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 2
): string {
  return formatCurrency(amount, '₱', minimumFractionDigits, maximumFractionDigits);
}
