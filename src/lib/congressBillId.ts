const CONGRESS_BILL_ID_PATTERN = /^congress-bill-(\d+)-([a-z]+)-(\d+)$/i;

/** Normalize bill type codes (e.g. "H.R." / "HR" -> "hr"). */
export function normalizeLegislationType(type: string): string {
  return type.replace(/\./g, '').trim().toLowerCase();
}

export function buildCongressBillId(
  congress: number | string,
  type: string,
  number: string | number
): string {
  return `congress-bill-${congress}-${normalizeLegislationType(type)}-${number}`.toLowerCase();
}

export function parseCongressBillId(
  billId: string
): { congress: number; type: string; number: string } | null {
  const match = billId.match(CONGRESS_BILL_ID_PATTERN);
  if (!match) return null;

  return {
    congress: Number(match[1]),
    type: normalizeLegislationType(match[2]),
    number: match[3],
  };
}

export function isCongressBillId(billId: string): boolean {
  return CONGRESS_BILL_ID_PATTERN.test(billId);
}

export function legislationTypeVariants(type: string): string[] {
  const normalized = normalizeLegislationType(type);
  return Array.from(new Set([normalized, normalized.toUpperCase(), type]));
}
