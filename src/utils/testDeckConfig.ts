import {
  getCardDefinition,
  getGalleryPoolEntries,
  getStartingDeckEntries,
} from '../game/CardDefinitions';
import testedBaselineFile from '../../gallery-tested-cards.json';
import {
  clearSharedTestedGalleryIds,
  fetchSharedTestedGalleryIds,
  syncSharedTestedGalleryIds,
} from '../services/galleryTestedSync';

export type TestDeckConfig = {
  excludedStartingDeckDefinitionIds: string[];
  excludedGalleryDefinitionIds: string[];
  testedGalleryDefinitionIds: string[];
};

export type TestDeckCardOption = {
  definitionId: string;
  name: string;
  qty: number;
  cost: number;
  faction: string;
};

const STORAGE_KEY = 'deck_builder.test_deck_config';
const TESTED_SYNC_URL = 'http://127.0.0.1:3939/gallery-tested-cards';

const EMPTY_CONFIG: TestDeckConfig = {
  excludedStartingDeckDefinitionIds: [],
  excludedGalleryDefinitionIds: [],
  testedGalleryDefinitionIds: [],
};

let activeConfig: TestDeckConfig = loadTestDeckConfig();

function getBaselineTestedIds(): string[] {
  const raw = testedBaselineFile as { testedDefinitionIds?: string[] };
  return [...new Set(raw.testedDefinitionIds ?? [])];
}

function normalizeConfig(raw: Partial<TestDeckConfig> | null | undefined): TestDeckConfig {
  return {
    excludedStartingDeckDefinitionIds: [
      ...new Set(raw?.excludedStartingDeckDefinitionIds ?? []),
    ],
    excludedGalleryDefinitionIds: [
      ...new Set(raw?.excludedGalleryDefinitionIds ?? []),
    ],
    testedGalleryDefinitionIds: [
      ...new Set(raw?.testedGalleryDefinitionIds ?? []),
    ],
  };
}

function mergeTestedIds(
  stored: string[] | undefined,
  fallback: string[]
): string[] {
  if (stored && stored.length > 0) {
    return [...new Set(stored)];
  }
  return [...new Set(fallback)];
}

export function loadTestDeckConfig(): TestDeckConfig {
  const baselineTested = getBaselineTestedIds();
  if (typeof localStorage === 'undefined') {
    return {
      ...EMPTY_CONFIG,
      testedGalleryDefinitionIds: baselineTested,
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...EMPTY_CONFIG,
        testedGalleryDefinitionIds: baselineTested,
      };
    }
    const parsed = normalizeConfig(JSON.parse(raw) as Partial<TestDeckConfig>);
    return {
      ...parsed,
      testedGalleryDefinitionIds: mergeTestedIds(
        parsed.testedGalleryDefinitionIds,
        baselineTested
      ),
    };
  } catch {
    return {
      ...EMPTY_CONFIG,
      testedGalleryDefinitionIds: baselineTested,
    };
  }
}

export function saveTestDeckConfig(config: TestDeckConfig): void {
  const normalized = normalizeConfig(config);
  activeConfig = normalized;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
}

export function getActiveTestDeckConfig(): TestDeckConfig {
  return activeConfig;
}

export function applyTestDeckConfig(config: TestDeckConfig): TestDeckConfig {
  const normalized = normalizeConfig(config);
  activeConfig = normalized;
  saveTestDeckConfig(normalized);
  return normalized;
}

applyTestDeckConfig(loadTestDeckConfig());

export async function fetchRemoteTestedGalleryIds(): Promise<{
  source: 'shared' | 'local-file' | null;
  ids: string[];
}> {
  const shared = await fetchSharedTestedGalleryIds();
  if (shared) {
    return { source: 'shared', ids: shared };
  }

  const localFile = await fetchTestedGalleryFromProjectFile();
  if (localFile) {
    return { source: 'local-file', ids: localFile };
  }

  return { source: null, ids: [] };
}

export async function pushRemoteTestedGalleryIds(
  ids: string[]
): Promise<'shared' | 'local-file' | 'offline'> {
  const unique = [...new Set(ids)];
  const sharedOk = await syncSharedTestedGalleryIds(unique);
  if (sharedOk) return 'shared';

  const fileOk = await syncTestedGalleryToProjectFile(unique);
  if (fileOk) return 'local-file';

  return 'offline';
}

export async function clearRemoteTestedGalleryIds(): Promise<boolean> {
  const sharedOk = await clearSharedTestedGalleryIds();
  if (sharedOk) return true;
  return syncTestedGalleryToProjectFile([]);
}

export async function fetchTestedGalleryFromProjectFile(): Promise<
  string[] | null
> {
  try {
    const res = await fetch(TESTED_SYNC_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as { testedDefinitionIds?: string[] };
    return [...new Set(data.testedDefinitionIds ?? [])];
  } catch {
    return null;
  }
}

export async function syncTestedGalleryToProjectFile(
  ids: string[]
): Promise<boolean> {
  try {
    const res = await fetch(TESTED_SYNC_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testedDefinitionIds: ids }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function isStartingDeckDefinitionExcluded(definitionId: string): boolean {
  return activeConfig.excludedStartingDeckDefinitionIds.includes(definitionId);
}

export function isGalleryDefinitionExcluded(definitionId: string): boolean {
  return activeConfig.excludedGalleryDefinitionIds.includes(definitionId);
}

export function isGalleryDefinitionTested(definitionId: string): boolean {
  return activeConfig.testedGalleryDefinitionIds.includes(definitionId);
}

export function getFilteredStartingDeckEntries() {
  return getStartingDeckEntries().filter(
    (entry) => !isStartingDeckDefinitionExcluded(entry.definitionId)
  );
}

export function getFilteredGalleryPoolEntries() {
  return getGalleryPoolEntries().filter(
    (entry) => !isGalleryDefinitionExcluded(entry.definitionId)
  );
}

function buildCardOptions(
  entries: { definitionId: string; qty: number }[]
): TestDeckCardOption[] {
  const byId = new Map<string, TestDeckCardOption>();
  for (const { definitionId, qty } of entries) {
    const existing = byId.get(definitionId);
    if (existing) {
      existing.qty += qty;
      continue;
    }
    const def = getCardDefinition(definitionId);
    byId.set(definitionId, {
      definitionId,
      name: def.name,
      qty,
      cost: def.cost ?? 0,
      faction: def.faction ?? (def.type === 'Event' ? 'Event' : 'Other'),
    });
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

export function getStartingDeckTestOptions(): TestDeckCardOption[] {
  return buildCardOptions(getStartingDeckEntries());
}

export function getGalleryPoolTestOptions(): TestDeckCardOption[] {
  return buildCardOptions(getGalleryPoolEntries());
}

export function toggleStartingDeckExclusion(
  config: TestDeckConfig,
  definitionId: string
): TestDeckConfig {
  const excluded = new Set(config.excludedStartingDeckDefinitionIds);
  if (excluded.has(definitionId)) {
    excluded.delete(definitionId);
  } else {
    excluded.add(definitionId);
  }
  return {
    ...config,
    excludedStartingDeckDefinitionIds: [...excluded],
  };
}

export function toggleGalleryExclusion(
  config: TestDeckConfig,
  definitionId: string
): TestDeckConfig {
  const excluded = new Set(config.excludedGalleryDefinitionIds);
  if (excluded.has(definitionId)) {
    excluded.delete(definitionId);
  } else {
    excluded.add(definitionId);
  }
  return {
    ...config,
    excludedGalleryDefinitionIds: [...excluded],
  };
}

export function toggleGalleryTested(
  config: TestDeckConfig,
  definitionId: string
): TestDeckConfig {
  const tested = new Set(config.testedGalleryDefinitionIds);
  if (tested.has(definitionId)) {
    tested.delete(definitionId);
  } else {
    tested.add(definitionId);
  }
  return {
    ...config,
    testedGalleryDefinitionIds: [...tested],
  };
}

export function excludeAllTestedGalleryCards(
  config: TestDeckConfig
): TestDeckConfig {
  const excluded = new Set([
    ...config.excludedGalleryDefinitionIds,
    ...config.testedGalleryDefinitionIds,
  ]);
  return {
    ...config,
    excludedGalleryDefinitionIds: [...excluded],
  };
}

export function clearTestedGalleryCards(
  config: TestDeckConfig
): TestDeckConfig {
  return {
    ...config,
    testedGalleryDefinitionIds: [],
  };
}
