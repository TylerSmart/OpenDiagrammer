import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  AddBoardMemberRequest,
  BoardDetailDto,
  BoardMemberDto,
  BoardSummaryDto,
  CreateBoardRequest,
  TransferOwnershipRequest,
  UpdateBoardMemberRoleRequest,
  UpdateBoardRequest,
  UpdateCanvasDataRequest,
} from '../../models/board.models';

@Service()
export class BoardService {
  private readonly http = inject(HttpClient);

  getBoards(): Observable<BoardSummaryDto[]> {
    return this.http.get<BoardSummaryDto[]>(apiUrl('/boards'));
  }

  getBoardById(id: string): Observable<BoardDetailDto> {
    return this.http.get<BoardDetailDto>(apiUrl(`/boards/${id}`));
  }

  createBoard(request: CreateBoardRequest): Observable<BoardDetailDto> {
    return this.http.post<BoardDetailDto>(apiUrl('/boards'), request);
  }

  updateBoard(id: string, request: UpdateBoardRequest): Observable<BoardDetailDto> {
    return this.http.put<BoardDetailDto>(apiUrl(`/boards/${id}`), request);
  }

  updateCanvasData(id: string, request: UpdateCanvasDataRequest): Observable<BoardDetailDto> {
    return this.http.put<BoardDetailDto>(apiUrl(`/boards/${id}/canvas`), request);
  }

  deleteBoard(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/boards/${id}`));
  }

  transferOwnership(
    id: string,
    request: TransferOwnershipRequest,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(apiUrl(`/boards/${id}/transfer-ownership`), request);
  }

  getMembers(boardId: string): Observable<BoardMemberDto[]> {
    return this.http.get<BoardMemberDto[]>(apiUrl(`/boards/${boardId}/members`));
  }

  addMember(boardId: string, request: AddBoardMemberRequest): Observable<BoardMemberDto> {
    return this.http.post<BoardMemberDto>(apiUrl(`/boards/${boardId}/members`), request);
  }

  updateMemberRole(
    boardId: string,
    userId: string,
    request: UpdateBoardMemberRoleRequest,
  ): Observable<BoardMemberDto> {
    return this.http.put<BoardMemberDto>(apiUrl(`/boards/${boardId}/members/${userId}`), request);
  }

  removeMember(boardId: string, userId: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/boards/${boardId}/members/${userId}`));
  }
}
