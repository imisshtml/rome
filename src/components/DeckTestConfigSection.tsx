import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import {
  applyTestDeckConfig,
  clearTestedGalleryCards,
  excludeAllTestedGalleryCards,
  fetchRemoteTestedGalleryIds,
  getActiveTestDeckConfig,
  getGalleryPoolTestOptions,
  getStartingDeckTestOptions,
  pushRemoteTestedGalleryIds,
  clearRemoteTestedGalleryIds,
  TestDeckConfig,
  toggleGalleryExclusion,
  toggleGalleryTested,
  toggleStartingDeckExclusion,
} from '../utils/testDeckConfig';
import { subscribeSharedTestedGallery } from '../services/galleryTestedSync';
import { CardLocation } from '../types/cardTypes';

export type DebugSpawnZone = Extract<
  CardLocation,
  'HAND' | 'DECK' | 'DISCARD' | 'DESTROYED'
>;

const SPAWN_ZONES: { zone: DebugSpawnZone; label: string }[] = [
  { zone: 'HAND', label: 'Hand' },
  { zone: 'DECK', label: 'Deck' },
  { zone: 'DISCARD', label: 'Disc' },
  { zone: 'DESTROYED', label: 'Dest' },
];

type Props = {
  config: TestDeckConfig;
  onChange: (config: TestDeckConfig) => void;
  onResetGame: () => void;
  spawnEnabled?: boolean;
  onSpawnCard?: (definitionId: string, zone: DebugSpawnZone) => void;
};

function ZoneSpawnBtn({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.zoneBtn, disabled && styles.zoneBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.zoneBtnText, disabled && styles.zoneBtnTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ConfigToggleRow({
  label,
  meta,
  excluded,
  tested,
  spawnEnabled,
  onTogglePool,
  onToggleTested,
  onSpawnCard,
}: {
  label: string;
  meta: string;
  excluded: boolean;
  tested: boolean;
  spawnEnabled?: boolean;
  onTogglePool: () => void;
  onToggleTested: () => void;
  onSpawnCard?: (zone: DebugSpawnZone) => void;
}) {
  return (
    <View style={[styles.toggleRow, excluded && styles.toggleRowExcluded]}>
      <Pressable style={styles.poolToggle} onPress={onTogglePool}>
        <Text style={styles.toggleMark}>{excluded ? '☐' : '☑'}</Text>
        <View style={styles.toggleTextWrap}>
          <Text style={[styles.toggleLabel, excluded && styles.toggleLabelExcluded]}>
            {label}
          </Text>
          <Text style={styles.toggleMeta}>{meta}</Text>
        </View>
      </Pressable>
      <View style={styles.actionCol}>
        {onSpawnCard ? (
          <View style={styles.zoneRow}>
            {SPAWN_ZONES.map(({ zone, label: zoneLabel }) => (
              <ZoneSpawnBtn
                key={zone}
                label={zoneLabel}
                disabled={!spawnEnabled}
                onPress={() => onSpawnCard(zone)}
              />
            ))}
          </View>
        ) : null}
        <Pressable
          style={[styles.testedBtn, tested && styles.testedBtnActive]}
          onPress={onToggleTested}
        >
          <Text style={[styles.testedBtnText, tested && styles.testedBtnTextActive]}>
            {tested ? '✓' : '○'} Tested
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function StartingDeckRow({
  label,
  meta,
  excluded,
  onTogglePool,
}: {
  label: string;
  meta: string;
  excluded: boolean;
  onTogglePool: () => void;
}) {
  return (
    <Pressable
      style={[styles.toggleRow, excluded && styles.toggleRowExcluded]}
      onPress={onTogglePool}
    >
      <Text style={styles.toggleMark}>{excluded ? '☐' : '☑'}</Text>
      <View style={styles.toggleTextWrap}>
        <Text style={[styles.toggleLabel, excluded && styles.toggleLabelExcluded]}>
          {label}
        </Text>
        <Text style={styles.toggleMeta}>{meta}</Text>
      </View>
    </Pressable>
  );
}

export const DeckTestConfigSection: React.FC<Props> = ({
  config,
  onChange,
  onResetGame,
  spawnEnabled = false,
  onSpawnCard,
}) => {
  const [filter, setFilter] = useState('');
  const [remoteSync, setRemoteSync] = useState<
    'unknown' | 'shared' | 'local-file' | 'offline'
  >('unknown');
  const [pushBusy, setPushBusy] = useState(false);
  const startingOptions = useMemo(() => getStartingDeckTestOptions(), []);
  const galleryOptions = useMemo(() => getGalleryPoolTestOptions(), []);

  const needle = filter.trim().toLowerCase();
  const filteredGallery = needle
    ? galleryOptions.filter(
        (opt) =>
          opt.name.toLowerCase().includes(needle) ||
          opt.faction.toLowerCase().includes(needle)
      )
    : galleryOptions;

  const excludedStarting = config.excludedStartingDeckDefinitionIds.length;
  const excludedGallery = config.excludedGalleryDefinitionIds.length;
  const testedCount = config.testedGalleryDefinitionIds.length;

  const updateConfig = (next: TestDeckConfig, syncTested = false) => {
    const applied = applyTestDeckConfig(next);
    onChange(applied);
    if (syncTested) {
      void pushRemoteTestedGalleryIds(applied.testedGalleryDefinitionIds).then(
        setRemoteSync
      );
    }
  };

  const applySharedTestedIds = (ids: string[]) => {
    const localIds = getActiveTestDeckConfig().testedGalleryDefinitionIds;
    const merged = [...new Set([...ids, ...localIds])];
    if (merged.length === localIds.length && merged.every((id) => localIds.includes(id))) {
      return;
    }
    onChange(
      applyTestDeckConfig({
        ...getActiveTestDeckConfig(),
        testedGalleryDefinitionIds: merged,
      })
    );
  };

  const handlePushToShared = async () => {
    setPushBusy(true);
    try {
      const ids = config.testedGalleryDefinitionIds;
      const result = await pushRemoteTestedGalleryIds(ids);
      setRemoteSync(result);
      const message =
        result === 'shared'
          ? `Pushed ${ids.length} tested card(s) to the shared list.`
          : result === 'local-file'
            ? 'Shared server unavailable — saved to local dev file instead.'
            : 'Could not reach shared server. Run migration 004_gallery_tested_cards.sql in Supabase.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert(result === 'shared' ? 'Synced' : 'Sync failed', message);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleClearTested = () => {
    const message =
      testedCount === 0
        ? 'Clear the tested list? This also clears the shared tester list.'
        : `Remove all ${testedCount} tested mark(s)? This also clears the shared tester list.`;

    const runClear = () => {
      updateConfig(clearTestedGalleryCards(config));
      void clearRemoteTestedGalleryIds().then((ok) =>
        setRemoteSync(ok ? 'shared' : 'offline')
      );
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Clear tested cards?\n\n${message}`)) {
        runClear();
      }
      return;
    }

    Alert.alert('Clear tested cards?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: runClear },
    ]);
  };

  useEffect(() => {
    let cancelled = false;

    const loadRemote = async () => {
      const localIds = getActiveTestDeckConfig().testedGalleryDefinitionIds;
      const remote = await fetchRemoteTestedGalleryIds();
      if (cancelled) return;

      if (remote.source === 'shared') {
        setRemoteSync('shared');
      } else if (remote.source === 'local-file') {
        setRemoteSync('local-file');
      } else {
        setRemoteSync('offline');
      }

      const merged = [...new Set([...remote.ids, ...localIds])];
      if (merged.length > 0) {
        applySharedTestedIds(merged);
      }

      const localOnly = localIds.filter((id) => !remote.ids.includes(id));
      if (localOnly.length > 0 && remote.source === 'shared') {
        await pushRemoteTestedGalleryIds(merged);
      }
    };

    void loadRemote();

    const unsubscribe = subscribeSharedTestedGallery((ids) => {
      if (!cancelled) {
        setRemoteSync('shared');
        applySharedTestedIds(ids);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Deck Test (local practice)</Text>
      <Text style={styles.hint}>
        Pool: unchecked = removed from supply on reset. Tested: marks cards you
        have verified — synced to Supabase for all testers (iPad, web, etc.).
        Hand/Deck/Disc/Dest spawn a copy into your zone (active game only).
      </Text>
      <Text style={styles.syncStatus}>
        Tested sync:{' '}
        {remoteSync === 'shared'
          ? 'shared (Supabase)'
          : remoteSync === 'local-file'
            ? 'local dev file only'
            : remoteSync === 'offline'
              ? 'offline — run migration 004 in Supabase'
              : 'checking…'}
      </Text>

      <Text style={styles.sectionLabel}>
        Starting deck ({startingOptions.length - excludedStarting}/
        {startingOptions.length} types)
      </Text>
      {startingOptions.map((opt) => {
        const excluded = config.excludedStartingDeckDefinitionIds.includes(
          opt.definitionId
        );
        return (
          <StartingDeckRow
            key={opt.definitionId}
            label={opt.name}
            meta={`×${opt.qty} in each player deck`}
            excluded={excluded}
            onTogglePool={() =>
              updateConfig(toggleStartingDeckExclusion(config, opt.definitionId))
            }
          />
        );
      })}

      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
        Gallery pool ({galleryOptions.length - excludedGallery}/
        {galleryOptions.length} in pool · {testedCount} tested)
      </Text>
      <TextInput
        style={styles.filterInput}
        value={filter}
        onChangeText={setFilter}
        placeholder="Filter gallery cards…"
        placeholderTextColor="rgba(255,255,255,0.35)"
      />
      <View style={styles.quickRow}>
        <Pressable
          style={styles.quickBtn}
          onPress={() =>
            updateConfig(excludeAllTestedGalleryCards(config))
          }
        >
          <Text style={styles.quickBtnText}>Exclude all tested</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={handleClearTested}>
          <Text style={styles.quickBtnText}>Clear tested</Text>
        </Pressable>
        <Pressable
          style={[styles.quickBtn, pushBusy && styles.quickBtnDisabled]}
          onPress={() => void handlePushToShared()}
          disabled={pushBusy || testedCount === 0}
        >
          <Text style={styles.quickBtnText}>
            {pushBusy ? 'Pushing…' : 'Push to shared'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.quickRow}>
        <Pressable
          style={styles.quickBtn}
          onPress={() =>
            updateConfig({
              ...config,
              excludedGalleryDefinitionIds: galleryOptions.map(
                (o) => o.definitionId
              ),
            })
          }
        >
          <Text style={styles.quickBtnText}>Exclude all gallery</Text>
        </Pressable>
        <Pressable
          style={styles.quickBtn}
          onPress={() =>
            updateConfig({ ...config, excludedGalleryDefinitionIds: [] })
          }
        >
          <Text style={styles.quickBtnText}>Include all gallery</Text>
        </Pressable>
      </View>
      {filteredGallery.map((opt) => {
        const excluded = config.excludedGalleryDefinitionIds.includes(
          opt.definitionId
        );
        const tested = config.testedGalleryDefinitionIds.includes(
          opt.definitionId
        );
        return (
          <ConfigToggleRow
            key={opt.definitionId}
            label={opt.name}
            meta={`${opt.faction} · ${opt.cost}c · ×${opt.qty} in supply`}
            excluded={excluded}
            tested={tested}
            spawnEnabled={spawnEnabled}
            onTogglePool={() =>
              updateConfig(toggleGalleryExclusion(config, opt.definitionId))
            }
            onToggleTested={() =>
              updateConfig(toggleGalleryTested(config, opt.definitionId), true)
            }
            onSpawnCard={
              onSpawnCard
                ? (zone) => onSpawnCard(opt.definitionId, zone)
                : undefined
            }
          />
        );
      })}

      <Pressable style={styles.resetBtn} onPress={onResetGame}>
        <Text style={styles.resetText}>Reset Game</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
  },
  title: {
    color: '#2ECC71',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 4,
  },
  syncStatus: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#3498DB',
    fontWeight: '700',
    fontSize: 10,
    marginBottom: 4,
  },
  sectionLabelSpaced: {
    marginTop: 10,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#fff',
    fontSize: 11,
    marginBottom: 6,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  quickBtnDisabled: {
    opacity: 0.45,
  },
  quickBtnText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionCol: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: '46%',
  },
  zoneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 3,
  },
  zoneBtn: {
    borderWidth: 1,
    borderColor: 'rgba(52,152,219,0.45)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(52,152,219,0.12)',
  },
  zoneBtnDisabled: {
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  zoneBtnText: {
    color: '#85C1E9',
    fontSize: 8,
    fontWeight: '700',
  },
  zoneBtnTextDisabled: {
    color: 'rgba(255,255,255,0.25)',
  },
  toggleRowExcluded: {
    backgroundColor: 'rgba(192,57,43,0.12)',
  },
  poolToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  toggleMark: {
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: '800',
    width: 14,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  toggleLabelExcluded: {
    color: 'rgba(255,255,255,0.45)',
    textDecorationLine: 'line-through',
  },
  toggleMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    marginTop: 1,
  },
  testedBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 72,
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  testedBtnActive: {
    borderColor: '#F1C40F',
    backgroundColor: 'rgba(241,196,15,0.15)',
  },
  testedBtnText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '700',
  },
  testedBtnTextActive: {
    color: '#F1C40F',
  },
  resetBtn: {
    backgroundColor: '#C0392B',
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  resetText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
});

export default DeckTestConfigSection;
