export const parseNum = (val: any): number => {
  if (val === '' || val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const strVal = String(val).replace(',', '.').trim();
  const parsed = parseFloat(strVal);
  return isNaN(parsed) ? 0 : parsed;
};

export const formatMoney = (amount: number, locale: string = 'fr-FR'): string =>
  (amount || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
