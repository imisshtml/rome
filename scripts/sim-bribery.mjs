import {
  createInitialGameState,
  getNextAIAction,
  applyActionWithPhaseRules,
  processGameAction,
  rehydrateGameState,
} from '../src/game/GameEngine.ts';
import { getCardDefinition } from '../src/game/CardDefinitions.ts';

let __n = 0;
function mk(defId, location, ownerId) {
  const definition = getCardDefinition(defId);
  __n += 1;
  return {
    instanceId: `${defId}_${__n}`,
    definitionId: definition.id,
    definition,
    location,
    ownerId,
    faceUp: location !== 'HAND' ? true : true,
  };
}

const setups = [
  { id: 'player_1', name: 'Human', isAI: false },
  { id: 'player_2', name: 'AI', isAI: true },
  { id: 'player_3', name: 'AI2', isAI: true },
];

let pass = 0, fail = 0;
const ok = (l, c) => { console.log(`  ${c ? 'ok ' : 'FAIL'} - ${l}`); c ? pass++ : fail++; };

function fresh() {
  let s = rehydrateGameState(createInitialGameState(setups, 'g'));
  return { ...s, phase: 'MAIN', turnPlayerId: 'player_1' };
}

console.log('Bribery — human, multiple opponents:');
{
  let s = fresh();
  // Put Bribery in human hand; give opponents known hands.
  const bribery = mk('bribery', 'HAND', 'player_1');
  s.players = s.players.map((p) => {
    if (p.id === 'player_1') return { ...p, hand: [bribery] };
    if (p.id === 'player_2') return { ...p, hand: [mk('secutor', 'HAND', 'player_2')] };
    if (p.id === 'player_3') return { ...p, hand: [mk('cestus', 'HAND', 'player_3')] };
    return p;
  });
  const coinsBefore = s.turnCoins;

  s = applyActionWithPhaseRules(s, {
    type: 'PLAY_CARD', playerId: 'player_1',
    payload: { cardInstanceId: bribery.instanceId }, timestamp: Date.now(),
  });
  ok('gained +2 coins', s.turnCoins === coinsBefore + 2);
  ok('bribery pick began (choose_opponent)', s.pendingBriberyPick?.phase === 'choose_opponent');
  ok('two opponent candidates', s.pendingBriberyPick?.opponentCandidateIds.length === 2);

  // choose player_2
  s = applyActionWithPhaseRules(s, {
    type: 'BRIBERY_CHOOSE_OPPONENT', playerId: 'player_1',
    payload: { targetPlayerId: 'player_2' }, timestamp: Date.now(),
  });
  ok('reveal phase', s.pendingBriberyPick?.phase === 'play_choice');
  const revealedId = s.pendingBriberyPick?.revealedCardInstanceId;
  ok('revealed a card from player_2 hand', !!revealedId);

  const coinsBeforePlay = s.turnCoins;
  s = applyActionWithPhaseRules(s, {
    type: 'BRIBERY_PLAY_REVEALED', playerId: 'player_1', timestamp: Date.now(),
  });
  ok('pick cleared', s.pendingBriberyPick == null);
  const p1 = s.players.find((p) => p.id === 'player_1');
  const p2 = s.players.find((p) => p.id === 'player_2');
  ok('borrowed card now in controller play area', p1.playArea.some((c) => c.instanceId === revealedId));
  ok('borrowed card marked borrowedFromPlayerId', p1.playArea.find((c) => c.instanceId === revealedId)?.borrowedFromPlayerId === 'player_2');
  ok('removed from opponent hand', !p2.hand.some((c) => c.instanceId === revealedId));
  // Secutor gives +2 coins on play
  ok('borrowed card effect applied (+2 coins from Secutor)', s.turnCoins === coinsBeforePlay + 2);

  // End turn -> borrowed card destroyed, not returned, not in controller discard
  const destroyedBefore = (s.destroyedPile ?? []).length;
  s = applyActionWithPhaseRules(s, { type: 'END_PHASE', playerId: 'player_1', timestamp: Date.now() });
  // advance any AI to settle deferred turn end
  let guard = 0;
  while (guard++ < 5) {
    const a = getNextAIAction(rehydrateGameState(s));
    if (!a || a.playerId !== 'player_1') break;
    const after = applyActionWithPhaseRules(rehydrateGameState(s), a);
    if (after === s) break;
    s = after;
  }
  const p1After = s.players.find((p) => p.id === 'player_1');
  const p2After = s.players.find((p) => p.id === 'player_2');
  const inDestroyed = (s.destroyedPile ?? []).some((c) => c.instanceId === revealedId);
  const inP1 = [...p1After.deck, ...p1After.discard, ...p1After.hand, ...p1After.playArea].some((c) => c.instanceId === revealedId);
  const inP2 = [...p2After.deck, ...p2After.discard, ...p2After.hand, ...p2After.playArea].some((c) => c.instanceId === revealedId);
  ok('borrowed card destroyed at end of turn', inDestroyed);
  ok('borrowed card NOT in controller zones', !inP1);
  ok('borrowed card NOT returned to opponent', !inP2);
}

console.log('Bribery — skip declines:');
{
  let s = fresh();
  const bribery = mk('bribery', 'HAND', 'player_1');
  s.players = s.players.map((p) => {
    if (p.id === 'player_1') return { ...p, hand: [bribery] };
    if (p.id === 'player_2') return { ...p, hand: [mk('secutor', 'HAND', 'player_2')] };
    if (p.id === 'player_3') return { ...p, hand: [] };
    return p;
  });
  s = applyActionWithPhaseRules(s, {
    type: 'PLAY_CARD', playerId: 'player_1',
    payload: { cardInstanceId: bribery.instanceId }, timestamp: Date.now(),
  });
  // single opponent with cards -> skip straight to reveal
  ok('single-candidate skips to reveal', s.pendingBriberyPick?.phase === 'play_choice');
  const revealedId = s.pendingBriberyPick?.revealedCardInstanceId;
  s = applyActionWithPhaseRules(s, { type: 'BRIBERY_SKIP', playerId: 'player_1', timestamp: Date.now() });
  ok('pick cleared on skip', s.pendingBriberyPick == null);
  const p2 = s.players.find((p) => p.id === 'player_2');
  ok('card stays in opponent hand on skip', p2.hand.some((c) => c.instanceId === revealedId));
}

console.log('Bribery — AI controller auto-resolves:');
{
  let s = fresh();
  s.turnPlayerId = 'player_2';
  const bribery = mk('bribery', 'HAND', 'player_2');
  s.players = s.players.map((p) => {
    if (p.id === 'player_2') return { ...p, hand: [bribery] };
    if (p.id === 'player_1') return { ...p, hand: [mk('secutor', 'HAND', 'player_1')] };
    if (p.id === 'player_3') return { ...p, hand: [mk('cestus', 'HAND', 'player_3'), mk('cestus', 'HAND', 'player_3')] };
    return p;
  });
  s = applyActionWithPhaseRules(s, {
    type: 'PLAY_CARD', playerId: 'player_2',
    payload: { cardInstanceId: bribery.instanceId }, timestamp: Date.now(),
  });
  let guard = 0;
  while (guard++ < 8 && s.pendingBriberyPick) {
    const a = getNextAIAction(rehydrateGameState(s));
    if (!a) break;
    const after = applyActionWithPhaseRules(rehydrateGameState(s), a);
    if (after === s) break;
    s = after;
  }
  ok('AI resolved bribery pick', s.pendingBriberyPick == null);
  const p2 = s.players.find((p) => p.id === 'player_2');
  ok('AI has a borrowed card in play', p2.playArea.some((c) => c.borrowedFromPlayerId));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
