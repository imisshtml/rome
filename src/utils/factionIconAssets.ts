import {
  factionIconLegion,
  factionIconLudus,
  factionIconSenate,
} from '../assets/images';
import { Faction } from '../types/cardTypes';

export const BANDING_FACTION_ICONS: Record<'Ludus' | 'Legion' | 'Senate', number> = {
  Ludus: factionIconLudus,
  Legion: factionIconLegion,
  Senate: factionIconSenate,
};

export function getBandingFactionIcon(faction: Faction): number | undefined {
  if (faction === 'Ludus' || faction === 'Legion' || faction === 'Senate') {
    return BANDING_FACTION_ICONS[faction];
  }
  return undefined;
}
