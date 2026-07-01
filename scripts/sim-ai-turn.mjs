import {
  createInitialGameState,
  getNextAIAction,
  applyActionWithPhaseRules,
  rehydrateGameState,
} from '../src/game/GameEngine.ts';
import {
  getPendingEventHandChoicePlayerIds,
  getPendingEventHandChoiceForPlayer,
  handCardValidForEventChoice,
} from '../src/game/EventResolver.ts';
import { favorIsOptional } from '../src/game/FavorResolver.ts';

const setups = [
  { id: 'player_1', name: 'Human', isAI: false },
  { id: 'player_2', name: 'AI', isAI: true },
];

let state = createInitialGameState(setups, 'game_1');

function describePending(s) {
  return {
    favor: !!s.pendingFavorReveal,
    gallery: !!s.pendingGalleryEvent,
    handChoices: getPendingEventHandChoicePlayerIds(s).length,
  };
}

function respondHumanEvent(state) {
  const ids = getPendingEventHandChoicePlayerIds(state);
  const humanId = ids.find((id) => {
    const p = state.players.find((pl) => pl.id === id);
    return p && !p.isAI;
  });
  if (!humanId) return null;
  const human = state.players.find((p) => p.id === humanId);
  if (!human || human.hand.length === 0) return null;
  const choice = getPendingEventHandChoiceForPlayer(state, humanId);
  const card = choice
    ? human.hand.find((c) => handCardValidForEventChoice(c, choice.kind))
    : human.hand[0];
  if (!card) return null;
  return {
    type: 'EVENT_DISCARD_CARD',
    playerId: humanId,
    payload: { cardInstanceId: card.instanceId },
    timestamp: Date.now(),
  };
}

function respondHumanFavor(state) {
  const pending = state.pendingFavorReveal;
  if (!pending) return null;
  const owner = state.players.find((p) => p.id === pending.playerId);
  if (!owner || owner.isAI) return null;
  return {
    type: favorIsOptional(pending.card) ? 'ACCEPT_FAVOR' : 'RESOLVE_FAVOR',
    playerId: owner.id,
    timestamp: Date.now(),
  };
}

function respondHumanOptionalDiscard(state) {
  const ids = state.pendingEventOptionalDiscards?.pendingPlayerIds ?? [];
  const humanId = ids.find((id) => {
    const p = state.players.find((pl) => pl.id === id);
    return p && !p.isAI;
  });
  if (!humanId) return null;
  const human = state.players.find((p) => p.id === humanId);
  if (human && human.hand.length > 0) {
    const card = human.hand.reduce((worst, c) =>
      (c.definition?.cost ?? 0) < (worst.definition?.cost ?? 0) ? c : worst
    );
    return {
      type: 'EVENT_DISCARD_CARD',
      playerId: humanId,
      payload: { cardInstanceId: card.instanceId },
      timestamp: Date.now(),
    };
  }
  return { type: 'EVENT_SKIP_GALLERY_CHOICE', playerId: humanId, timestamp: Date.now() };
}

function respondHumanBribery(state) {
  const pick = state.pendingBriberyPick;
  if (!pick) return null;
  const controller = state.players.find((p) => p.id === pick.playerId);
  if (!controller || controller.isAI) return null;
  if (pick.phase === 'choose_opponent') {
    return {
      type: 'BRIBERY_CHOOSE_OPPONENT',
      playerId: pick.playerId,
      payload: { targetPlayerId: pick.opponentCandidateIds[0] },
      timestamp: Date.now(),
    };
  }
  return { type: 'BRIBERY_PLAY_REVEALED', playerId: pick.playerId, timestamp: Date.now() };
}

// Robust fallback: resolve any forced interactive state for the HUMAN by reusing
// the engine's own AI resolver on a copy where the human is flagged as AI. This
// keeps the harness in sync with every current/future interactive pick without
// re-implementing each one here.
function resolveHumanAsAI(snap) {
  const asAI = {
    ...snap,
    players: snap.players.map((p) => (p.isAI ? p : { ...p, isAI: true })),
  };
  const action = getNextAIAction(asAI);
  if (!action) return null;
  return { ...action, timestamp: Date.now() };
}

let stallAt = null;
for (let i = 0; i < 400; i++) {
  const snap = rehydrateGameState(state);
  if (snap.status === 'finished' || snap.phase === 'GAME_OVER') {
    break;
  }
  const turn = snap.players.find((p) => p.id === snap.turnPlayerId);
  let action = getNextAIAction(snap);

  if (!action) {
    action = respondHumanEvent(snap);
  }
  if (!action) {
    action = resolveHumanAsAI(snap);
  }
  if (!action && turn && !turn.isAI) {
    action = {
      type: 'END_PHASE',
      playerId: turn.id,
      timestamp: Date.now(),
    };
  }

  if (!action) {
    stallAt = {
      i,
      turn: turn?.name,
      phase: snap.phase,
      pending: describePending(snap),
    };
    break;
  }

  const after = applyActionWithPhaseRules(snap, action);
  if (after === snap) {
    stallAt = { i, rejected: action.type, pending: describePending(snap) };
    break;
  }
  state = after;
}

if (stallAt) {
  console.error('STALL', JSON.stringify(stallAt, null, 2));
  process.exit(1);
}
console.log('OK - 400 steps');
