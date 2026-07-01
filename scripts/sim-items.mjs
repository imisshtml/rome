import {
  createInitialGameState,
  processGameAction,
  rehydrateGameState,
  getNextAIAction,
} from '../src/game/GameEngine.ts';

function getNextAIActionSafe(s) {
  try {
    return getNextAIAction(s);
  } catch {
    return null;
  }
}
import { getCardDefinition } from '../src/game/CardDefinitions.ts';
import { getDeckVpFromCards } from '../src/game/postGame.ts';

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass++;
    console.log('  ok  -', name);
  } else {
    fail++;
    console.error('  FAIL-', name);
  }
}

function baseState() {
  const s = createInitialGameState(
    [
      { id: 'p1', name: 'P1', isAI: false },
      { id: 'p2', name: 'P2', isAI: true },
    ],
    'g'
  );
  return { ...s, phase: 'MAIN', turnPlayerId: 'p1', turnCoins: 0 };
}

let uid = 0;
function makeItem(defId, ownerId, tapped = false) {
  return {
    instanceId: `i_${defId}_${uid++}`,
    definitionId: defId,
    definition: getCardDefinition(defId),
    location: 'ITEMS_IN_PLAY',
    ownerId,
    faceUp: true,
    tapped,
  };
}

function withItems(state, playerId, items) {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, itemsInPlay: items } : p
    ),
  };
}

function act(state, type, payload, playerId = 'p1') {
  return processGameAction(state, {
    type,
    playerId,
    payload,
    timestamp: Date.now(),
  });
}

// --- Definitions load correctly ---
console.log('Item definitions:');
const ids = [
  'wooden_gladius',
  'round_shield',
  'trident_head',
  'champions_helm',
  'signet_ring',
  'treasury_keys',
  'legion_standard',
  'centurion_baton',
  'amphora',
  'ivory_dice',
  'laurel_crown',
  'emporers_seal',
  'bloodied_sand',
];
for (const id of ids) {
  const d = getCardDefinition(id);
  ok(`${id} loaded as Item`, d && d.type === 'Item' && d.id === id);
}

// --- Bloodied Sand: tap -> gain favor (begins favor resolution) ---
console.log('Bloodied Sand tap:');
{
  const item = makeItem('bloodied_sand', 'p1');
  let s = withItems(baseState(), 'p1', [item]);
  s = act(s, 'USE_ITEM', { cardInstanceId: item.instanceId });
  const p1 = s.players.find((p) => p.id === 'p1');
  const tappedItem = p1.itemsInPlay.find((c) => c.instanceId === item.instanceId);
  ok('item is tapped after use', tappedItem?.tapped === true);
  ok('favor resolution began', !!s.pendingFavorReveal);
  // Re-tap should be rejected (state unchanged)
  const before = s;
  const s2 = act(s, 'USE_ITEM', { cardInstanceId: item.instanceId });
  ok('re-tap rejected (already tapped)', s2 === before);
}

// --- Trident Head: tap -> flip gallery pick pending ---
console.log('Trident Head tap:');
{
  const item = makeItem('trident_head', 'p1');
  let s = withItems(baseState(), 'p1', [item]);
  s = act(s, 'USE_ITEM', { cardInstanceId: item.instanceId });
  ok('flip market pick pending', !!s.pendingFlipMarketPick);
  ok(
    'flip pick belongs to p1',
    s.pendingFlipMarketPick?.playerId === 'p1'
  );
}

// --- Centurion Baton: tap -> reveal top; peek pending ---
console.log('Centurion Baton tap:');
{
  const item = makeItem('centurion_baton', 'p1');
  let s = withItems(baseState(), 'p1', [item]);
  // Force a cheap top card on p1 deck
  const cheap = {
    instanceId: 'cheap1',
    definitionId: 'ludus_novicii',
    definition: getCardDefinition('ludus_novicii'),
    location: 'DECK',
    ownerId: 'p1',
    faceUp: false,
  };
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 'p1' ? { ...p, deck: [cheap, ...p.deck] } : p
    ),
  };
  s = act(s, 'USE_ITEM', { cardInstanceId: item.instanceId });
  ok('peek pending set', !!s.pendingItemDeckPeek);
  ok(
    'canDraw reflects cost<=3',
    s.pendingItemDeckPeek?.canDraw ===
      ((getCardDefinition('ludus_novicii').cost ?? 0) <= 3)
  );
  const handBefore = s.players.find((p) => p.id === 'p1').hand.length;
  if (s.pendingItemDeckPeek?.canDraw) {
    s = act(s, 'ITEM_PEEK_DRAW');
    const handAfter = s.players.find((p) => p.id === 'p1').hand.length;
    ok('drew card to hand', handAfter === handBefore + 1);
  } else {
    s = act(s, 'ITEM_PEEK_SKIP');
  }
  ok('peek cleared', !s.pendingItemDeckPeek);
}

// --- Champion's Helm: destroy -> gain Ludus pick + shuffle back to market ---
console.log("Champion's Helm destroy:");
{
  const item = makeItem('champions_helm', 'p1');
  let s = withItems(baseState(), 'p1', [item]);
  const supplyBefore = s.gallerySupply.length;
  s = act(s, 'USE_ITEM', { cardInstanceId: item.instanceId });
  const p1 = s.players.find((p) => p.id === 'p1');
  ok('item removed from play', !p1.itemsInPlay.some((c) => c.instanceId === item.instanceId));
  ok(
    'item shuffled back into market deck',
    s.gallerySupply.some((c) => c.definitionId === 'champions_helm') &&
      s.gallerySupply.length === supplyBefore + 1
  );
  // gain pick may or may not be present depending on eligible Ludus in market
  ok(
    'gain pick (if set) is Ludus faction from market',
    !s.pendingGainCardPick ||
      (s.pendingGainCardPick.gainFaction === 'Ludus' &&
        s.pendingGainCardPick.gainSource === 'market')
  );
}

// --- Amphora: destroy -> discard hand, draw 5, shuffle back ---
console.log('Amphora destroy:');
{
  const item = makeItem('amphora', 'p1');
  let s = withItems(baseState(), 'p1', [item]);
  // give p1 a small hand + a deck to draw from
  const mkCard = (n) => ({
    instanceId: `h_${n}`,
    definitionId: 'ludus_novicii',
    definition: getCardDefinition('ludus_novicii'),
    location: 'HAND',
    ownerId: 'p1',
    faceUp: true,
  });
  const deckCard = (n) => ({ ...mkCard(n), location: 'DECK', faceUp: false });
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 'p1'
        ? {
            ...p,
            hand: [mkCard(1), mkCard(2)],
            deck: [deckCard(3), deckCard(4), deckCard(5), deckCard(6), deckCard(7), deckCard(8)],
          }
        : p
    ),
  };
  s = act(s, 'USE_ITEM', { cardInstanceId: item.instanceId });
  const p1 = s.players.find((p) => p.id === 'p1');
  ok('hand redrawn to 5', p1.hand.length === 5);
  ok('amphora back in market deck', s.gallerySupply.some((c) => c.definitionId === 'amphora'));
}

// --- Laurel Crown: destroy -> +5 epic discount ---
console.log('Laurel Crown destroy:');
{
  const item = makeItem('laurel_crown', 'p1');
  let s = withItems(baseState(), 'p1', [item]);
  const before = s.turnEpicDiscount ?? 0;
  s = act(s, 'USE_ITEM', { cardInstanceId: item.instanceId });
  ok('epic discount +5', (s.turnEpicDiscount ?? 0) === before + 5);
}

// --- VP: item victory points count once ---
console.log('Item VP scoring:');
{
  const item = makeItem('champions_helm', 'p1'); // vp 3
  const s = withItems(baseState(), 'p1', [item]);
  const p1 = s.players.find((p) => p.id === 'p1');
  const vp = getDeckVpFromCards(p1);
  ok('champions_helm contributes 3 VP once', vp === 3);
}

function bigDeck(ownerId, n) {
  return Array.from({ length: n }, (_, i) => ({
    instanceId: `d_${ownerId}_${i}_${uid++}`,
    definitionId: 'ludus_novicii',
    definition: getCardDefinition('ludus_novicii'),
    location: 'DECK',
    ownerId,
    faceUp: false,
  }));
}

// --- Emperor's Seal: +1 draw at end of turn; items persist through cleanup ---
console.log("Emperor's Seal end-of-turn draw + persistence:");
{
  const seal = makeItem('emporers_seal', 'p1');
  let s = baseState();
  s = { ...s, turnArenaExempt: true };
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 'p1'
        ? { ...p, itemsInPlay: [seal], hand: [], deck: bigDeck('p1', 12) }
        : p
    ),
  };
  s = act(s, 'END_PHASE');
  const p1 = s.players.find((p) => p.id === 'p1');
  ok('drew 6 (5 + Emperor Seal)', p1.hand.length === 6);
  ok('seal persisted in play through cleanup', p1.itemsInPlay.some((c) => c.definitionId === 'emporers_seal'));
}

// --- Full round: untap + Treasury Keys coins at start of p1's next turn ---
console.log('Treasury Keys coins + untap at turn start:');
{
  const keys = { ...makeItem('treasury_keys', 'p1'), tapped: true };
  let s = baseState();
  s = { ...s, turnArenaExempt: true };
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 'p1'
        ? { ...p, itemsInPlay: [keys], hand: [], deck: bigDeck('p1', 20) }
        : { ...p, deck: bigDeck('p2', 20) }
    ),
  };

  let steps = 0;
  while (s.turnPlayerId !== 'p1' || steps === 0) {
    steps++;
    if (steps > 60) break;
    const snap = rehydrateGameState(s);
    const turn = snap.players.find((p) => p.id === snap.turnPlayerId);
    let action = getNextAIActionSafe(snap);
    if (!action && turn && !turn.isAI) {
      action = { type: 'END_PHASE', playerId: turn.id, timestamp: Date.now() };
    }
    if (!action) break;
    const after = processGameAction(snap, action);
    if (after === snap) break;
    s = after;
  }
  const p1 = s.players.find((p) => p.id === 'p1');
  ok('returned to p1 turn', s.turnPlayerId === 'p1');
  ok('treasury keys granted +1 coin at turn start', (s.turnCoins ?? 0) >= 1);
  ok('item untapped at turn start', p1.itemsInPlay.every((c) => !c.tapped));
}

// --- Passive readers via itemUtils are covered indirectly; done ---
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
