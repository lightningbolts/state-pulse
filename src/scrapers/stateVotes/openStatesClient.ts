import { fetchOpenStatesPeople } from './personResolver';
import type { PersonRecord } from './personResolver';

export interface OpenStatesBillRef {
  identifier: string;
  id: string;
}

export async function fetchOpenStatesBills(
  jurisdiction: string,
  apiKey: string,
  options: {
    session?: string;
    page?: number;
    perPage?: number;
    sort?: string;
  } = {}
): Promise<OpenStatesBillRef[]> {
  const perPage = options.perPage ?? 50;
  const page = options.page ?? 1;
  let url = `https://v3.openstates.org/bills?jurisdiction=${encodeURIComponent(jurisdiction)}&per_page=${perPage}&page=${page}&apikey=${apiKey}`;
  if (options.session) {
    url += `&session=${encodeURIComponent(options.session)}`;
  }
  if (options.sort) {
    url += `&sort=${encodeURIComponent(options.sort)}`;
  }

  const response = await fetch(url);
  if (!response.ok) return [];
  const data = (await response.json()) as {
    results: { identifier: string; id: string }[];
  };
  return (data.results ?? []).map((b) => ({
    identifier: b.identifier,
    id: b.id,
  }));
}

export async function fetchOpenStatesBillsPaginated(
  jurisdiction: string,
  apiKey: string,
  options: {
    session?: string;
    maxPages?: number;
    perPage?: number;
    sort?: string;
  } = {}
): Promise<OpenStatesBillRef[]> {
  const maxPages = options.maxPages ?? 2;
  const all: OpenStatesBillRef[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await fetchOpenStatesBills(jurisdiction, apiKey, {
      ...options,
      page,
    });
    if (!batch.length) break;
    all.push(...batch);
  }
  return all;
}

export { fetchOpenStatesPeople };
export type { PersonRecord };
