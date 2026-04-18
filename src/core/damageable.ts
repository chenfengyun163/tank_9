import type { TeamType } from './team-type';

export interface Damageable {
  readonly id: string;
  readonly team: TeamType;
  readonly isAlive: boolean;

  takeDamage(amount: number): void;
}
