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
      'EVENT_SKIP_GALLERY_CHOICE',
      'RESOLVE_FAVOR',
      'ACCEPT_FAVOR',
      'DECLINE_FAVOR',
      'FAVOR_DESTROY_CARD',
      'CARD_DESTROY_PICK',
      'CARD_DESTROY_SKIP',
      'GALLERY_DESTROY_PICK',
      'ANY_DISCARD_DESTROY_PICK',
      'CHOOSE_OR_EFFECT',
      'ON_GAIN_DESTROY_PICK',
      'ON_GAIN_DESTROY_SKIP',
      'FORCE_OPPONENT_DISCARD',
      'DECLINE_ARENA',
      'DISMISS_ARENA_RESULT',
      'END_PHASE',
    ],
  },
  CLEANUP: {
    phase: 'CLEANUP',
    autoActions: [],
    allowedActions: ['END_PHASE', 'RESOLVE_GALLERY_EVENT', 'EVENT_DISCARD_CARD', 'EVENT_SKIP_GALLERY_CHOICE', 'RESOLVE_FAVOR', 'ACCEPT_FAVOR', 'DECLINE_FAVOR', 'FAVOR_DESTROY_CARD', 'DISMISS_ARENA_RESULT'],
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
