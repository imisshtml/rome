export type { PlayerSetup } from './GameEngine';
export {
  createInitialGameState,
  createPregameState,
  createLobbyGameState,
  processGameAction,
  applyActionWithPhaseRules,
  validateGameAction,
  rehydrateGameState,
  getCurrentPlayer,
  getArenaCommitValor,
  getArenaChallengeStats,
  getNextAIAction,
  buildPlayerSetupsFromDb,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ARENA_MAX_COMMIT,
} from './GameEngine';
export {
  buildPostGameSummary,
  getPlayerTotalVp,
  getDeckVpFromCards,
  getAllPlayerCards,
  finishGameIfNeeded,
  isArenaSupplyFinished,
  isEpicSupplyFinished,
  isGameEndConditionMet,
} from './postGame';
export type { PostGameSummary, PostGamePlayerSummary, PostGameCardRow } from './postGame';
export { GameStateManager } from './GameState';
export {
  CARD_DEFINITIONS,
  CROWD_DISFAVOR,
  getCardDefinition,
  getGalleryPoolEntries,
  getEpicPoolEntries,
  getArenaPoolEntries,
  getFlavorPoolEntries,
} from './CardDefinitions';
export { TURN_PHASE_CONFIG, canPerformAction, getNextPhase } from './TurnManager';
