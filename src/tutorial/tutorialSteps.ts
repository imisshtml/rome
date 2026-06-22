export type TutorialPhase = 'pregame' | 'active';

export type TutorialStepId =
  | 'welcome'
  | 'market'
  | 'recruits'
  | 'epics'
  | 'arena'
  | 'favors'
  | 'deck-discard'
  | 'start-game'
  | 'hand'
  | 'play-zone'
  | 'faction-key'
  | 'stats-icons'
  | 'end-turn'
  | 'opponents'
  | 'game-log';

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  body: string;
  phase: TutorialPhase;
  /** Registered layout key for spotlight */
  targetKey?: string;
  /** User must interact with the highlighted control to proceed */
  requireTargetClick?: boolean;
  /** Tooltip placement relative to highlight (or screen center when no target) */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Keep tooltip higher on screen when the target is near the bottom edge */
  anchorHigh?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    body: 'This quick tour walks through the board layout before your first match. Use Next to move through each area.',
    phase: 'pregame',
    placement: 'center',
  },
  {
    id: 'market',
    title: 'Market',
    body: 'These six cards are the Market. They refill as players purchase them — the core cards you build your deck from.',
    phase: 'pregame',
    targetKey: 'tutorial_market',
    placement: 'bottom',
  },
  {
    id: 'recruits',
    title: 'Recruits',
    body: 'Recruits are an always-available pile of random faction cards that supply a base +2 Coins. Which faction appears is random each game.',
    phase: 'pregame',
    targetKey: 'tutorial_recruits',
    placement: 'right',
  },
  {
    id: 'epics',
    title: 'Epics',
    body: 'Epics are the high-impact cards that provide large advantages. When the Epic supply runs out, the game ends.',
    phase: 'pregame',
    targetKey: 'tutorial_epics',
    placement: 'left',
  },
  {
    id: 'arena',
    title: 'Arena',
    body: 'Challenge the Arena to earn Victory Points. Commit up to 3 cards from your play area — their Valor is tested against the challenge. Opponents may Support or Sabotage with one card each. Many cards interact with Arena fights in special ways.',
    phase: 'pregame',
    targetKey: 'tutorial_arena',
    placement: 'right',
  },
  {
    id: 'favors',
    title: 'Favors',
    body: 'Favors are gained through card effects and offer temporary advantages when played.',
    phase: 'pregame',
    targetKey: 'tutorial_favors',
    placement: 'right',
  },
  {
    id: 'deck-discard',
    title: 'Deck & Discard',
    body: 'Your deck and discard pile. Purchased and played cards go to discard. At end of turn you discard your hand and draw a fresh hand.',
    phase: 'pregame',
    targetKey: 'tutorial_deck_discard',
    placement: 'right',
    anchorHigh: true,
  },
  {
    id: 'start-game',
    title: 'Start Game',
    body: 'When you are ready, tap Start Game to let other players know you are ready and begin.',
    phase: 'pregame',
    targetKey: 'tutorial_start_game',
    requireTargetClick: true,
    placement: 'top',
  },
  {
    id: 'hand',
    title: 'Your Hand',
    body: 'Your hand holds five cards to start (some effects change this). Drag cards from here into the Play zone above.',
    phase: 'active',
    targetKey: 'tutorial_hand',
    placement: 'top',
  },
  {
    id: 'play-zone',
    title: 'Play Zone',
    body: 'Play cards here to generate Coins, trigger effects, buy from the Market or Epics, and commit fighters to the Arena.',
    phase: 'active',
    targetKey: 'tutorial_play_zone',
    placement: 'top',
  },
  {
    id: 'faction-key',
    title: 'Faction Key',
    body: 'Tracks how many cards from each faction you played this turn. Playing three from the same faction grants a banding bonus!',
    phase: 'active',
    targetKey: 'tutorial_faction_key',
    placement: 'right',
    anchorHigh: true,
  },
  {
    id: 'stats-icons',
    title: 'Turn Stats',
    body: 'Coins in play this turn, Valor from cards in play, and total Victory Points earned so far.',
    phase: 'active',
    targetKey: 'tutorial_stats',
    placement: 'left',
    anchorHigh: true,
  },
  {
    id: 'end-turn',
    title: 'End Turn / Enter Arena',
    body: 'Pass the current turn or phase. After the Arena opens, playing Faction cards may require you to Enter Arena before ending.',
    phase: 'active',
    targetKey: 'tutorial_end_turn',
    placement: 'left',
    anchorHigh: true,
  },
  {
    id: 'opponents',
    title: 'Opponents',
    body: 'Opponent totals and hand sizes appear here so you can track the field.',
    phase: 'active',
    targetKey: 'tutorial_opponents',
    placement: 'bottom',
  },
  {
    id: 'game-log',
    title: 'Game Log',
    body: 'A running log of what each player played each turn. Tap card names to preview them.',
    phase: 'active',
    targetKey: 'tutorial_game_log',
    placement: 'left',
  },
];

export const FIRST_ACTIVE_STEP_INDEX = TUTORIAL_STEPS.findIndex(
  (s) => s.phase === 'active'
);
