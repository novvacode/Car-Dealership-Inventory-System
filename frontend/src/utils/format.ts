const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const currencyExact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Whole-dollar display for cards and tables; exact cents when the price has them. */
export function formatPrice(value: number): string {
  return Number.isInteger(value) ? currency.format(value) : currencyExact.format(value);
}
