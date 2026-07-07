export type LegislationPaginationCursor = {
  sortField: string;
  sortValue: string;
  id: string;
};

function toBase64Url(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url');
  }
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64url').toString('utf8');
  }
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeLegislationCursor(cursor: LegislationPaginationCursor): string {
  return toBase64Url(JSON.stringify(cursor));
}

export function parseLegislationCursor(after: string): LegislationPaginationCursor | null {
  try {
    const parsed = JSON.parse(fromBase64Url(after)) as LegislationPaginationCursor;
    if (parsed?.sortField && parsed?.sortValue && parsed?.id) {
      return parsed;
    }
  } catch {
    // invalid cursor
  }
  return null;
}

const SORT_FIELD_MAP: Record<string, string> = {
  lastAction: 'latestActionAt',
  lastActionAt: 'latestActionAt',
};

export function resolveApiSortField(sortField: string): string {
  return SORT_FIELD_MAP[sortField] ?? sortField;
}

export function buildLegislationCursorFromItem(
  item: Record<string, unknown>,
  apiSortField: string,
): string | null {
  const rawValue = item[apiSortField];
  const id = item.id;
  if (!id || rawValue == null) {
    return null;
  }
  const sortValue =
    rawValue instanceof Date
      ? rawValue.toISOString()
      : typeof rawValue === 'string'
        ? rawValue
        : String(rawValue);
  return encodeLegislationCursor({ sortField: apiSortField, sortValue, id: String(id) });
}
