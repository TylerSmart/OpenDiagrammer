export enum BoardRole {
  Owner = 0,
  Admin = 1,
  Editor = 2,
  Viewer = 3,
}

export enum BoardBackgroundType {
  GridLines = 0,
  GridDots = 1,
  None = 2,
}

export enum BoardMode {
  Normal = 0,
  ThinkMode = 1,
}

export interface BoardMemberDto {
  id: string;
  boardId: string;
  userId: string;
  username: string;
  email: string;
  role: BoardRole;
  createdAt: string;
}

export interface BoardSummaryDto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerUsername: string;
  userRole: BoardRole;
  backgroundType: BoardBackgroundType;
  backgroundColor: string | null;
  backgroundOpacity: number;
  mode: BoardMode;
  memberCount: number;
  createdAt: string;
  modifiedAt: string;
}

export interface BoardDetailDto {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerUsername: string;
  userRole: BoardRole;
  backgroundType: BoardBackgroundType;
  backgroundColor: string | null;
  backgroundOpacity: number;
  mode: BoardMode;
  thinkModeConfigJson: string | null;
  createdAt: string;
  modifiedAt: string;
  members: BoardMemberDto[];
}

export interface CreateBoardRequest {
  name: string;
  description?: string | null;
  backgroundType?: BoardBackgroundType;
  backgroundColor?: string | null;
  backgroundOpacity?: number | null;
}

export interface UpdateBoardRequest {
  name: string;
  description?: string | null;
  backgroundType: BoardBackgroundType;
  backgroundColor?: string | null;
  backgroundOpacity: number;
  mode: BoardMode;
  thinkModeConfigJson?: string | null;
}

export interface TransferOwnershipRequest {
  newOwnerId: string;
}

export interface AddBoardMemberRequest {
  emailOrUsername: string;
  role: BoardRole;
}

export interface UpdateBoardMemberRoleRequest {
  role: BoardRole;
}

export function getRoleName(role: BoardRole): string {
  switch (role) {
    case BoardRole.Owner:
      return 'Owner';
    case BoardRole.Admin:
      return 'Admin';
    case BoardRole.Editor:
      return 'Editor';
    case BoardRole.Viewer:
      return 'Viewer';
    default:
      return 'Unknown';
  }
}

export function canManageBoardSettings(role: BoardRole): boolean {
  return role === BoardRole.Owner || role === BoardRole.Admin;
}

export function canManageMembers(role: BoardRole): boolean {
  return role === BoardRole.Owner || role === BoardRole.Admin;
}

export function canDeleteBoard(role: BoardRole): boolean {
  return role === BoardRole.Owner;
}
