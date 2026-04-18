import type { BuildMode, ProductionKind, TechnologyId, Vec3State } from './game-state';

export type CommandSource = 'player' | 'ai' | 'system';

interface BaseCommand {
  id: string;
  source: CommandSource;
}

interface QueueableCommand extends BaseCommand {
  queue?: boolean;
}

export interface StartCommand extends BaseCommand { type: 'start'; }
export interface SelectCommand extends BaseCommand { type: 'select'; entityIds: string[]; }
export interface AssignControlGroupCommand extends BaseCommand { type: 'assignControlGroup'; groupIndex: number; entityIds: string[]; }
export interface RecallControlGroupCommand extends BaseCommand { type: 'recallControlGroup'; groupIndex: number; }
export interface MoveCommand extends QueueableCommand { type: 'move'; entityIds: string[]; target: Vec3State; }
export interface AttackCommand extends QueueableCommand { type: 'attack'; entityIds: string[]; targetEntityId: string; }
export interface AttackMoveCommand extends QueueableCommand { type: 'attackMove'; entityIds: string[]; target: Vec3State; }
export interface PatrolCommand extends QueueableCommand { type: 'patrol'; entityIds: string[]; target: Vec3State; }
export interface HoldPositionCommand extends BaseCommand { type: 'holdPosition'; entityIds: string[]; }
export interface StopCommand extends BaseCommand { type: 'stop'; entityIds: string[]; }
export interface GatherCommand extends QueueableCommand { type: 'gather'; entityIds: string[]; targetEntityId: string; }
export interface RepairCommand extends BaseCommand { type: 'repair'; entityIds: string[]; targetEntityId: string; }
export interface BuildCommand extends BaseCommand { type: 'build'; entityIds: string[]; buildingConfigKey: Exclude<BuildMode, 'none'>; target: Vec3State; }
export interface ProduceCommand extends BaseCommand { type: 'produce'; buildingId: string; unitKind: ProductionKind; }
export interface ResearchCommand extends BaseCommand { type: 'research'; buildingId: string; techId: TechnologyId; }
export interface SetRallyPointCommand extends BaseCommand { type: 'setRallyPoint'; buildingId: string; target: Vec3State; }
export interface ToggleVisionDebugCommand extends BaseCommand { type: 'toggleVisionDebug'; }
export interface RestartCommand extends BaseCommand { type: 'restart'; }

export type GameCommand =
  | StartCommand
  | SelectCommand
  | AssignControlGroupCommand
  | RecallControlGroupCommand
  | MoveCommand
  | AttackCommand
  | AttackMoveCommand
  | PatrolCommand
  | HoldPositionCommand
  | StopCommand
  | GatherCommand
  | RepairCommand
  | BuildCommand
  | ProduceCommand
  | ResearchCommand
  | SetRallyPointCommand
  | ToggleVisionDebugCommand
  | RestartCommand;
