import { CardDefinition } from '../types/cardTypes';

export interface CardStatDisplay {
  cost: number | null;
  victory: number | null;
  valor: number | null;
}

export function getCardStatDisplay(definition: CardDefinition): CardStatDisplay {
  if (
    definition.type === 'CrowdDisfavor' ||
    definition.faction === 'CrowdDisfavor'
  ) {
    return {
      cost: null,
      victory: definition.victoryPoints,
      valor: null,
    };
  }

  if (definition.faction === 'Arena' || definition.valorRequired != null) {
    return {
      cost: null,
      victory: definition.rewardVp ?? 0,
      valor: definition.valorRequired ?? 0,
    };
  }

  if (
    definition.type === 'Epic' ||
    definition.type === 'Gladiator' ||
    definition.type === 'Action' ||
    definition.type === 'Basic'
  ) {
    return {
      cost: definition.cost,
      victory: definition.victoryPoints,
      valor: definition.valor,
    };
  }

  return {
    cost: definition.cost > 0 ? definition.cost : null,
    victory: definition.victoryPoints !== 0 ? definition.victoryPoints : null,
    valor: definition.valor > 0 ? definition.valor : null,
  };
}
