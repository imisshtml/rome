import { GameState } from '../types/gameTypes';

/**
 * Current GameState shape version.
 *
 * Bump this ONLY for a STRUCTURAL change that an old persisted snapshot cannot
 * satisfy just by defaulting a new optional field — e.g. renaming/removing a
 * field, reshaping a nested object, or changing an enum's allowed values.
 *
 * Purely additive optional fields do NOT require a bump: `rehydrateGameState`
 * already fills those in with defaults, so old snapshots stay forward-compatible.
 *
 * When you DO bump it, add a matching migration to `MIGRATIONS` below that
 * upgrades a snapshot from (newVersion - 1) to newVersion.
 */
export const CURRENT_SCHEMA_VERSION = 1;

type RawState = GameState & Record<string, unknown>;

interface Migration {
  /** The version this migration produces (upgrades a snapshot up to `to`). */
  to: number;
  describe: string;
  migrate: (raw: RawState) => RawState;
}

/**
 * Ordered forward migrations, applied in ascending `to` order.
 *
 * Example — renaming `foo` to `bar` when bumping to v2:
 *
 *   {
 *     to: 2,
 *     describe: 'rename foo -> bar',
 *     migrate: (s) => {
 *       const { foo, ...rest } = s as Record<string, unknown>;
 *       return { ...rest, bar: foo } as RawState;
 *     },
 *   },
 */
const MIGRATIONS: Migration[] = [];

/**
 * Bring a persisted snapshot up to the current schema version.
 *
 * - Same version: returned unchanged.
 * - Older version: apply forward migrations, then stamp the current version.
 * - Newer version (snapshot written by newer code than this client is running,
 *   usually a client that hasn't refreshed after a deploy): left untouched, with
 *   a loud warning. Additive fields remain forward-compatible, but the user
 *   should refresh to pick up the latest build.
 */
export function migrateGameState(input: GameState): GameState {
  const raw = input as RawState;
  const from = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;

  if (from === CURRENT_SCHEMA_VERSION) return input;

  if (from > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[schema] Snapshot v${from} is newer than this client (v${CURRENT_SCHEMA_VERSION}). ` +
        'Refresh the page to load the latest build.'
    );
    return input;
  }

  let state = raw;
  for (const m of MIGRATIONS) {
    if (m.to > from && m.to <= CURRENT_SCHEMA_VERSION) {
      console.info(`[schema] migrating snapshot v${from} -> v${m.to} (${m.describe})`);
      state = m.migrate(state);
    }
  }

  return { ...state, schemaVersion: CURRENT_SCHEMA_VERSION };
}
