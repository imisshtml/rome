import { GamePhase, GameStatus } from '../types/gameTypes';

export interface TurnPhaseConfig {
  phase: GamePhase;
  autoActions: string[];
  allowedActions: string[];
}

export const TURN_PHASE_CONFIG: Record<GamePhase, TurnPhaseConfig> = {
  PREGAME: {
    phase: 'PREGAME',
    autoActions: [],
    allowedActions: ['PLAYER_READY'],
  },
  MAIN: {
    phase: 'MAIN',
    autoActions: [],
    allowedActions: [
      'PLAY_CARD',
      'DISCARD_CARD',
      'MOVE_CARD',
      'BUY_CARD',
      'CONFIRM_ARENA_FIGHTERS',
      'ACCEPT_BANDING_BONUS',
      'DECLINE_BANDING_BONUS',
      'RESOLVE_GALLERY_EVENT',
      'EVENT_DISCARD_CARD',
      'EVENT_LOSE_ITEM',
      'EVENT_SKIP_GALLERY_CHOICE',
      'RESOLVE_FAVOR',
      'ACCEPT_FAVOR',
      'DECLINE_FAVOR',
      'FAVOR_DESTROY_CARD',
      'FAVOR_ARENA_WAGER_PICK',
      'FAVOR_REPLAY_PICK',
      'CARD_DESTROY_PICK',
      'CARD_DESTROY_SKIP',
      'GALLERY_DESTROY_PICK',
      'GALLERY_DESTROY_SKIP',
      'EPIC_DESTROY_PICK',
      'ANY_DISCARD_DESTROY_PICK',
      'CHOOSE_OR_EFFECT',
      'ON_GAIN_DESTROY_PICK',
      'ON_GAIN_DESTROY_SKIP',
      'FORCE_OPPONENT_DISCARD',
      'CHOOSE_FORCE_DISCARD_TARGET',
      'PLACE_CARD_ON_DECK_PICK',
      'PLACE_CARD_ON_DECK_SKIP',
      'GAIN_CARD_PICK',
      'COPY_CARD_PICK',
      'PLACE_DESTROYED_ON_MARKET_PICK',
      'PLACE_DESTROYED_ON_MARKET_SKIP',
      'DECK_LOOK_CHOOSE_PLAYER',
      'DECK_LOOK_KEEP_TOP',
      'DECK_LOOK_REORDER',
      'DECK_TOP_REVEAL_RESOLVE',
      'CHOOSE_GAIN_BANDING_BONUS',
      'RETURN_CARD_TO_HAND_PICK',
      'RETURN_CARD_TO_HAND_SKIP',
      'BRIBERY_CHOOSE_OPPONENT',
      'BRIBERY_PLAY_REVEALED',
      'BRIBERY_SKIP',
      'REVEAL_FAVORS_PICK',
      'FLIP_MARKET_PICK',
      'FLIP_MARKET_SKIP',
      'CROWD_FRENZY_GAIN_PICK',
      'CROWD_FRENZY_SKIP',
      'USE_ITEM',
      'ITEM_PEEK_DRAW',
      'ITEM_PEEK_SKIP',
      'DECLINE_ARENA',
      'DISMISS_ARENA_RESULT',
      'DISMISS_ARENA_WAGER_RESULT',
      'END_PHASE',
    ],
  },
  CLEANUP: {
    phase: 'CLEANUP',
    autoActions: [],
    allowedActions: ['END_PHASE', 'RESOLVE_GALLERY_EVENT', 'EVENT_DISCARD_CARD', 'EVENT_SKIP_GALLERY_CHOICE', 'RESOLVE_FAVOR', 'ACCEPT_FAVOR', 'DECLINE_FAVOR', 'FAVOR_DESTROY_CARD', 'FAVOR_ARENA_WAGER_PICK', 'DISMISS_ARENA_RESULT', 'DISMISS_ARENA_WAGER_RESULT'],
  },
};

export function canPerformAction(
  phase: GamePhase,
  actionType: string,
  status?: GameStatus
): boolean {
  if (status === 'pregame' && actionType === 'PLAYER_READY') {
    return true;
  }
  if (status === 'pregame') {
    return false;
  }
  const config = TURN_PHASE_CONFIG[phase];
  return (
    config.allowedActions.includes(actionType) ||
    config.autoActions.includes(actionType)
  );
}

export function getNextPhase(current: GamePhase): GamePhase {
  if (current === 'MAIN') return 'CLEANUP';
  if (current === 'CLEANUP') return 'MAIN';
  return 'MAIN';
}
