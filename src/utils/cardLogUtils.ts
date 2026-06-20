import { CardDefinition, CardInstance } from '../types/cardTypes';
import { GameAction } from '../types/gameTypes';
import { getCardDefinition } from '../game/CardDefinitions';

/** Short effect line for the game log — prefers card text, falls back to structured effects. */
export function summarizeCardPlayEffect(definition: CardDefinition): string {
  const text = definition.text?.trim();
  if (text) return text;

  const effects = definition.effects;
  if (!effects) return 'no effect';

  const parts: string[] = [];
  if (effects.gain_coins) {
    parts.push(`+${effects.gain_coins} Coin${effects.gain_coins === 1 ? '' : 's'}`);
  }
  if (effects.gain_valor) {
    parts.push(`+${effects.gain_valor} Valor`);
  }
  if (effects.gain_vp) {
    parts.push(`+${effects.gain_vp} VP`);
  }
  if (effects.draw_cards) {
    parts.push(`Draw ${effects.draw_cards} card${effects.draw_cards === 1 ? '' : 's'}`);
  }
  if (effects.consult_augur) parts.push('Consult the Augur');
  if (effects.gain_imperial_favor) {
    parts.push(`Gain ${effects.gain_imperial_favor} Imperial Favor`);
  }

  return parts.length > 0 ? parts.join(', ') : 'no effect';
}

export function summarizeCardBuyEffect(definition: CardDefinition): string {
  const cost = definition.cost ?? 0;
  return cost > 0 ? `${cost} coin${cost === 1 ? '' : 's'}` : 'free';
}

/** Build a preview card from a logged action (for game log card links). */
export function getLogPreviewCard(action: GameAction): CardInstance | null {
  const definitionId = action.payload?.definitionId;
  if (!definitionId) return null;

  const definition = getCardDefinition(definitionId);
  return {
    instanceId: action.payload?.cardInstanceId ?? `log_${action.timestamp}`,
    definitionId: definition.id,
    definition,
    location: 'HAND',
    ownerId: action.playerId,
    faceUp: true,
    chosenFaction: action.payload?.chosenFaction ?? null,
  };
}
