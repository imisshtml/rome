import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { GameAction, PlayerState } from '../types/gameTypes';
import { getLogPreviewCard, getLogPreviewCardFromOutcome } from '../utils/cardLogUtils';
import { GalleryEventPlayerOutcome, GalleryEventDecreeOutcome } from '../types/gameTypes';

const MAX_VISIBLE_LOG_LINES = 48;

interface LogLineProps {
  action: GameAction;
  playerName: string;
  onPreviewCard?: (card: CardInstance) => void;
}

function CardNameLink({
  name,
  action,
  onPreviewCard,
}: {
  name: string;
  action: GameAction;
  onPreviewCard?: (card: CardInstance) => void;
}) {
  const preview = getLogPreviewCard(action);
  if (!preview || !onPreviewCard) {
    return <Text>{name}</Text>;
  }

  return (
    <Text style={styles.cardLink} onPress={() => onPreviewCard(preview)}>
      {name}
    </Text>
  );
}

function LogLine({ action, playerName, onPreviewCard }: LogLineProps) {
  const cardName = action.payload?.cardName;
  const effect = action.payload?.effectSummary;

  switch (action.type) {
    case 'PLAY_CARD':
      if (cardName) {
        return (
          <Text style={styles.line} numberOfLines={3}>
            {playerName} played{' '}
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
            {effect ? `: ${effect}` : ''}
          </Text>
        );
      }
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} played a card
        </Text>
      );
    case 'BUY_CARD':
      if (cardName) {
        return (
          <Text style={styles.line} numberOfLines={3}>
            {playerName} bought{' '}
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
            {effect ? ` (${effect})` : ''}
          </Text>
        );
      }
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} bought a card
        </Text>
      );
    case 'GALLERY_EVENT_FLIPPED':
      return (
        <Text style={styles.line} numberOfLines={3}>
          Event:{' '}
          {cardName ? (
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          ) : (
            'Gallery event'
          )}{' '}
          occurred{effect ? ` — ${effect}` : ''}
        </Text>
      );
    case 'RESOLVE_GALLERY_EVENT':
      if (cardName) {
        const outcomes = action.payload?.eventOutcomes ?? [];
        const decreeOutcomes = action.payload?.eventDecreeOutcomes ?? [];
        if (outcomes.length > 0) {
          return (
            <View style={styles.outcomeBlock}>
              <Text style={styles.line} numberOfLines={2}>
                Event:{' '}
                <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
              </Text>
              {outcomes.map((outcome: GalleryEventPlayerOutcome) => {
                const preview = getLogPreviewCardFromOutcome(outcome);
                return (
                  <Text key={outcome.cardInstanceId} style={styles.subLine} numberOfLines={2}>
                    {outcome.playerName} gained{' '}
                    {preview && onPreviewCard ? (
                      <Text
                        style={styles.cardLink}
                        onPress={() => onPreviewCard(preview)}
                      >
                        {outcome.cardName}
                      </Text>
                    ) : (
                      outcome.cardName
                    )}{' '}
                    ({outcome.cost}c) + {outcome.gratiaCount} Gratia
                  </Text>
                );
              })}
            </View>
          );
        }
        if (decreeOutcomes.length > 0) {
          return (
            <View style={styles.outcomeBlock}>
              <Text style={styles.line} numberOfLines={2}>
                Event:{' '}
                <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
              </Text>
              {decreeOutcomes.map((outcome: GalleryEventDecreeOutcome, idx) => (
                <Text key={`${outcome.playerId}-${outcome.cardName}-${idx}`} style={styles.subLine} numberOfLines={2}>
                  {outcome.playerName}:{' '}
                  {outcome.result === 'drawn'
                    ? 'drew'
                    : outcome.result === 'destroyed'
                      ? 'destroyed'
                      : 'kept on deck'}{' '}
                  {outcome.cardName} ({outcome.cost}c)
                </Text>
              ))}
            </View>
          );
        }
        return (
          <Text style={styles.line} numberOfLines={3}>
            Event:{' '}
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
            {effect ? ` — ${effect}` : ''}
          </Text>
        );
      }
      return (
        <Text style={styles.line} numberOfLines={2}>
          Gallery event resolved
        </Text>
      );
    case 'RESOLVE_FAVOR':
    case 'ACCEPT_FAVOR':
      if (cardName) {
        return (
          <Text style={styles.line} numberOfLines={3}>
            Favor:{' '}
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
            {effect ? ` — ${effect}` : ''}
          </Text>
        );
      }
      return (
        <Text style={styles.line} numberOfLines={2}>
          Favor resolved
        </Text>
      );
    case 'DECLINE_FAVOR':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} declined{' '}
          {cardName ? (
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          ) : (
            'a Favor'
          )}
        </Text>
      );
    case 'FAVOR_DESTROY_CARD':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} destroyed{' '}
          {cardName ? (
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          ) : (
            'a card'
          )}{' '}
          for a Favor
        </Text>
      );
    case 'EVENT_DISCARD_CARD':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} discarded{' '}
          {cardName ? (
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          ) : (
            'a card'
          )}{' '}
          for an event
        </Text>
      );
    case 'ARENA_RESPOND': {
      const kind = action.payload?.responseType ?? 'pass';
      if ((kind === 'support' || kind === 'hinder') && cardName) {
        return (
          <Text style={styles.line} numberOfLines={2}>
            {playerName} {kind === 'support' ? 'supported' : 'hindered'} with{' '}
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          </Text>
        );
      }
      if (kind === 'support') {
        return (
          <Text style={styles.line} numberOfLines={2}>
            {playerName} supported the arena challenge
          </Text>
        );
      }
      if (kind === 'hinder') {
        return (
          <Text style={styles.line} numberOfLines={2}>
            {playerName} hindered the arena challenge
          </Text>
        );
      }
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} passed on the arena challenge
        </Text>
      );
    }
    case 'DRAW_CARD':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} drew {action.payload?.count ?? 1} card(s)
        </Text>
      );
    case 'ATTEMPT_ARENA':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} attempted the arena
        </Text>
      );
    case 'CONFIRM_ARENA_FIGHTERS':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} entered the arena
        </Text>
      );
    case 'DISCARD_CARD':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} discarded{' '}
          {cardName ? (
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          ) : (
            'a card'
          )}
          {effect ? ` (${effect})` : ''}
        </Text>
      );
    case 'CARD_DESTROY_PICK':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} destroyed{' '}
          {cardName ? (
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          ) : (
            'a card'
          )}
          {effect ? ` (${effect})` : ''}
        </Text>
      );
    case 'GALLERY_DESTROY_PICK':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} destroyed{' '}
          {cardName ? (
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          ) : (
            'a market card'
          )}
          {effect ? ` (${effect})` : ''}
        </Text>
      );
    case 'GAIN_CARD_PICK':
    case 'COPY_CARD_PICK':
    case 'PLACE_DESTROYED_ON_MARKET_PICK':
    case 'ANY_DISCARD_DESTROY_PICK':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName}{' '}
          {action.type === 'COPY_CARD_PICK'
            ? 'copied'
            : action.type === 'PLACE_DESTROYED_ON_MARKET_PICK'
              ? 'placed on market deck'
              : action.type === 'ANY_DISCARD_DESTROY_PICK'
                ? 'destroyed'
                : 'gained'}{' '}
          {cardName ? (
            <CardNameLink name={cardName} action={action} onPreviewCard={onPreviewCard} />
          ) : (
            'a card'
          )}
          {effect ? ` (${effect})` : ''}
        </Text>
      );
    case 'END_PHASE':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} ended their turn
        </Text>
      );
    case 'MOVE_CARD':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} moved a card
        </Text>
      );
    case 'START_GAME':
      return (
        <Text style={styles.line} numberOfLines={2}>
          Game started
        </Text>
      );
    case 'PLAYER_READY':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} is ready to start
        </Text>
      );
    case 'END_GAME':
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName} ended the game
        </Text>
      );
    default:
      return (
        <Text style={styles.line} numberOfLines={2}>
          {playerName}: {action.type}
        </Text>
      );
  }
}

interface GameLogPanelProps {
  actions: GameAction[];
  players: PlayerState[];
  onPreviewCard?: (card: CardInstance) => void;
}

export const GameLogPanel: React.FC<GameLogPanelProps> = ({
  actions,
  players,
  onPreviewCard,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const nameById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p.name])),
    [players]
  );
  const visibleActions = useMemo(
    () => actions.slice(-MAX_VISIBLE_LOG_LINES),
    [actions]
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [visibleActions.length]);

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Game Log</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        {visibleActions.length === 0 ? (
          <Text style={styles.empty}>No actions yet.</Text>
        ) : (
          visibleActions.map((action, index) => (
            <LogLine
              key={`${action.timestamp}-${index}`}
              action={action}
              playerName={nameById[action.playerId] ?? action.playerId}
              onPreviewCard={onPreviewCard}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.3)',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  title: {
    color: 'rgba(241,196,15,0.85)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 6,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web'
      ? ({ overflowY: 'auto', overflowX: 'hidden' } as object)
      : null),
  },
  content: {
    paddingBottom: 4,
    gap: 4,
  },
  line: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    lineHeight: 13,
  },
  outcomeBlock: {
    gap: 2,
  },
  subLine: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 8,
    lineHeight: 12,
    paddingLeft: 6,
  },
  cardLink: {
    color: '#f1c40f',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  empty: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default GameLogPanel;
