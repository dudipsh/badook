export const formatCurrency = (amount: number, locale = 'he-IL'): string => {
  return amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
