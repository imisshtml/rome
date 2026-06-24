export interface RulesSection {
  title: string;
  body?: string;
  bullets?: string[];
}

/** Player-facing rules — kept in sync with implemented gameplay. */
export const GAME_RULES: RulesSection[] = [
  {
    title: 'Goal',
    body: 'Earn the most Victory Points (VP) before the game ends. Typical games end around 30–40 VP.',
    bullets: [
      'Up to 6 players. Empty seats are filled by AI.',
      'The game ends when the Epic supply pile is empty.',
      'Highest VP wins.',
    ],
  },
  {
    title: 'The Board',
    bullets: [
      'Market — six face-up faction cards. Purchased cards are replaced from the deck.',
      'Recruits — one random faction card always available (+2 Coins when played).',
      'Epics — three powerful high-cost cards. When the Epic deck runs out, the game ends.',
      'Arena — one active challenge at a time. Complete it for VP.',
      'Favors — one-time bonus cards gained from effects; they never stay in your deck.',
      'Your Deck & Discard — bought and played cards go to discard; you shuffle discard into deck when needed.',
    ],
  },
  {
    title: 'Turn Overview',
    bullets: [
      'Draw a hand of 5 cards (unless an effect changes this).',
      'Main Phase — play cards from hand to your Play zone, buy from the Market/Epics/Recruits, and resolve effects.',
      'Coins generated this turn are spent to buy cards; unspent Coins are lost at end of turn.',
      'Cards in play at end of turn are discarded. Your hand is discarded and you draw a new hand.',
    ],
  },
  {
    title: 'Playing Cards',
    bullets: [
      'Drag cards from your hand into the Play zone.',
      'Faction cards generate Coins, Valor, and other effects when played.',
      'Charity (+1 Coin) can be played without triggering Arena obligations.',
      'Spy cards let you choose Ludus, Legion, or Senate when played.',
    ],
  },
  {
    title: 'Buying Cards',
    bullets: [
      'Spend Coins equal to a card’s cost to buy from the Market row, Epics, or Recruits.',
      'Purchased cards go to your discard pile.',
      'Event cards in the Market resolve immediately for all players, then are replaced — they never enter decks.',
    ],
  },
  {
    title: 'Faction Banding',
    body: 'Playing three cards from the same faction in one turn triggers that faction’s banding bonus (once per faction per turn):',
    bullets: [
      'Ludus — gain 1 Favor card.',
      'Senate — gain +2 Coins.',
      'Legion — draw 1 card.',
    ],
  },
  {
    title: 'The Arena',
    bullets: [
      'The Opening Games is always the first Arena challenge. Completing it opens the Arena for the rest of the game.',
      'Before the Arena is open, challenging is optional.',
      'After the Arena is open, if you played any Faction or Epic cards this turn, you must Enter the Arena or gain Crowd Disfavor (Charity-only turns may pass).',
      'To challenge, commit exactly 3 cards from your Play zone. Their Valor is totaled against the Arena requirement.',
      'Each opponent may Support (+Valor) or Sabotage (−Valor) with one card from their hand.',
      'Success — gain the Arena reward (usually VP). Failure or declining — gain Crowd Disfavor (−1 VP, 0 Valor).',
    ],
  },
  {
    title: 'Crowd Disfavor',
    bullets: [
      'A penalty card added to your discard when you fail or decline a mandatory Arena challenge.',
      'Worth −1 VP. Some cards let you destroy Disfavor from hand or discard.',
    ],
  },
  {
    title: 'Resources',
    bullets: [
      'Coins — spent to buy cards; lost if unused at end of turn.',
      'Valor — used only for Arena challenges; comes from cards in play.',
      'Victory Points — VP on cards, Arena wins, and special effects determine the winner.',
      'Favors — temporary advantages from the Favor deck; resolved when played.',
    ],
  },
  {
    title: 'Factions at a Glance',
    bullets: [
      'Ludus — draw, trash, gallery manipulation, strong Arena Valor.',
      'Senate — control, sabotage, recursion, item synergy.',
      'Legion — copying, Augury, Favors, flexible utility.',
    ],
  },
];

export const GAME_RULES_TITLE = 'Rules of the Game';
