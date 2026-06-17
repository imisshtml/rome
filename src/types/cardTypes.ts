export type Faction =
  | 'Ludus'
  | 'Legion'
  | 'Senate'
  | 'Arena'
  | 'Event'
  | 'Epic'
  | 'Item'
  | 'Favor'
  | 'CrowdDisfavor';

export type CardType =
  | 'Gladiator'
  | 'Action'
  | 'Item'
  | 'Event'
  | 'Epic'
  | 'Favor'
  | 'CrowdDisfavor'
  | 'Basic';

import type { CardEffects } from './effectsTypes';

export interface CardDefinition {
  id: string;
  name: string;
  cost: number;
  valor: number;
  victoryPoints: number;
  type: CardType;
  faction: Faction;
  text: string;
  image?: string;
  /** Arena challenge requirement (arena cards only) */
  valorRequired?: number;
  /** VP awarded on successful arena attempt */
  rewardVp?: number;
  tier?: string;
  /** Structured effect payload from card JSON (`effects` field). */
  effects?: CardEffects;
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  definition: CardDefinition;
  location: CardLocation;
  ownerId: string;
  faceUp: boolean;
}

export type CardLocation =
  | 'HAND'
  | 'PLAY_AREA'
  | 'DISCARD'
  | 'DECK'
  | 'GALLERY'
  | 'ARENA'
  | 'ARENA_COMMIT'
  | 'EPIC_ROW'
  | 'FLAVOR_DECK'
  | 'DISFAVOR_DECK'
  | 'ARENA_DECK'
  | 'ITEMS_IN_PLAY';

export const FACTION_COLORS: Record<Faction, string> = {
  Ludus: '#C0392B',
  Legion: '#27AE60',
  Senate: '#F1C40F',
  Arena: '#8B6914',
  Event: '#2980B9',
  Epic: '#8E44AD',
  Item: '#7F8C8D',
  Favor: '#E67E22',
  CrowdDisfavor: '#2C3E50',
};
