import { GameState, GameAction } from '../types/gameTypes';
import { createInitialGameState, processGameAction, PlayerSetup } from './GameEngine';

export type GameStateListener = (state: GameState) => void;

export class GameStateManager {
  private state: GameState;
  private listeners: Set<GameStateListener> = new Set();
  private history: GameState[] = [];

  constructor(playerSetups: PlayerSetup[]) {
    this.state = createInitialGameState(playerSetups);
    this.history.push(this.state);
  }

  getState(): GameState {
    return this.state;
  }

  dispatch(action: GameAction): GameState {
    this.state = processGameAction(this.state, action);
    this.history.push(this.state);
    this.notify();
    return this.state;
  }

  subscribe(listener: GameStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  reset(playerSetups: PlayerSetup[]): void {
    this.state = createInitialGameState(playerSetups);
    this.history = [this.state];
    this.notify();
  }

  getHistory(): GameState[] {
    return this.history;
  }
}
