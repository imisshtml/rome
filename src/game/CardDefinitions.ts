import { CardDefinition, Faction } from '../types/cardTypes';

const def = (
  id: string,
  name: string,
  cost: number,
  valor: number,
  vp: number,
  type: CardDefinition['type'],
  faction: Faction,
  text: string
): CardDefinition => ({
  id,
  name,
  cost,
  valor,
  victoryPoints: vp,
  type,
  faction,
  text,
});

export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  basic_gladiator: def(
    'basic_gladiator',
    'Novice Gladiator',
    0,
    1,
    0,
    'Basic',
    'Ludus',
    'A fresh recruit to the arena.'
  ),
  basic_favor: def(
    'basic_favor',
    'Minor Favor',
    0,
    0,
    0,
    'Favor',
    'Favor',
    'Gain 1 coin to spend.'
  ),
  ludus_veteran: def(
    'ludus_veteran',
    'Veteran Fighter',
    3,
    3,
    1,
    'Gladiator',
    'Ludus',
    'A seasoned gladiator of the Ludus.'
  ),
  ludus_champion: def(
    'ludus_champion',
    'Arena Champion',
    5,
    5,
    2,
    'Gladiator',
    'Ludus',
    'The pride of the Ludus.'
  ),
  legion_soldier: def(
    'legion_soldier',
    'Legion Soldier',
    2,
    2,
    1,
    'Gladiator',
    'Legion',
    'Disciplined and deadly.'
  ),
  legion_centurion: def(
    'legion_centurion',
    'Centurion',
    4,
    4,
    2,
    'Gladiator',
    'Legion',
    'Commands respect on the field.'
  ),
  senate_orator: def(
    'senate_orator',
    'Senate Orator',
    3,
    1,
    2,
    'Action',
    'Senate',
    'Draw 2 cards.'
  ),
  senate_consul: def(
    'senate_consul',
    'Consul',
    5,
    2,
    3,
    'Action',
    'Senate',
    'All cards gain +1 valor this turn.'
  ),
  arena_beast: def(
    'arena_beast',
    'Arena Beast',
    0,
    0,
    0,
    'Event',
    'Arena',
    'Requires 6 valor to defeat. Worth 3 VP.'
  ),
  arena_gauntlet: def(
    'arena_gauntlet',
    'The Gauntlet',
    0,
    0,
    0,
    'Event',
    'Arena',
    'Requires 8 valor. Worth 4 VP.'
  ),
  arena_emperor: def(
    'arena_emperor',
    "Emperor's Challenge",
    0,
    0,
    0,
    'Event',
    'Arena',
    'Requires 10 valor. Worth 5 VP.'
  ),
  epic_colosseum: def(
    'epic_colosseum',
    'Colosseum Glory',
    7,
    6,
    4,
    'Epic',
    'Epic',
    'The ultimate prize of the arena.'
  ),
  epic_spartacus: def(
    'epic_spartacus',
    'Spartacus Reborn',
    8,
    7,
    5,
    'Epic',
    'Epic',
    'A legend returns.'
  ),
  epic_jupiter: def(
    'epic_jupiter',
    "Jupiter's Blessing",
    6,
    3,
    3,
    'Epic',
    'Epic',
    'Divine power flows through you.'
  ),
  item_shield: def(
    'item_shield',
    'Bronze Shield',
    2,
    0,
    0,
    'Item',
    'Item',
    'Protect one gladiator from defeat.'
  ),
  item_sword: def(
    'item_sword',
    'Gladius',
    3,
    0,
    1,
    'Item',
    'Item',
    'Equipped gladiator gains +2 valor.'
  ),
  crowd_disfavor: def(
    'crowd_disfavor',
    'Crowd Disfavor',
    0,
    0,
    -1,
    'CrowdDisfavor',
    'CrowdDisfavor',
    'The crowd jeers. -1 VP.'
  ),
  event_festival: def(
    'event_festival',
    'Festival of Mars',
    4,
    0,
    2,
    'Event',
    'Event',
    'All players draw 1 card.'
  ),
  event_uprising: def(
    'event_uprising',
    'Slave Uprising',
    3,
    0,
    1,
    'Event',
    'Event',
    'Each opponent discards 1 card.'
  ),
};

export const GALLERY_CARD_IDS = [
  'ludus_veteran',
  'ludus_champion',
  'legion_soldier',
  'legion_centurion',
  'senate_orator',
  'senate_consul',
  'item_shield',
  'item_sword',
  'event_festival',
  'event_uprising',
];

export const ARENA_CARD_IDS = [
  'arena_beast',
  'arena_gauntlet',
  'arena_emperor',
];

export const EPIC_CARD_IDS = [
  'epic_colosseum',
  'epic_spartacus',
  'epic_jupiter',
];
