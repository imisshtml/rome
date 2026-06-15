import { GamePhase } from '../types/gameTypes';

export interface TurnPhaseConfig {
  phase: GamePhase;
  autoActions: string[];
  allowedActions: string[];
}

export const TURN_PHASE_CONFIG: Record<GamePhase, TurnPhaseConfig> = {
  DRAW: {
    phase: 'DRAW',
    autoActions: ['DRAW_CARD'],
    allowedActions: ['END_PHASE'],
  },
  MAIN: {
    phase: 'MAIN',
    autoActions: [],
    allowedActions: ['PLAY_CARD', 'DISCARD_CARD', 'MOVE_CARD', 'END_PHASE'],
  },
  ARENA: {
    phase: 'ARENA',
    autoActions: [],
    allowedActions: ['MOVE_CARD', 'ATTEMPT_ARENA', 'END_PHASE'],
  },
  BUY: {
    phase: 'BUY',
    autoActions: [],
    allowedActions: ['BUY_CARD', 'END_PHASE'],
  },
  END: {
    phase: 'END',
    autoActions: [],
    allowedActions: ['END_PHASE'],
  },
};

export function canPerformAction(
  phase: GamePhase,
  actionType: string
): boolean {
  const config = TURN_PHASE_CONFIG[phase];
  return config.allowedActions.includes(actionType) || config.autoActions.includes(actionType);
}

export function getNextPhase(current: GamePhase): GamePhase {
  const order: GamePhase[] = ['DRAW', 'MAIN', 'ARENA', 'BUY', 'END'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : 'DRAW';
}
