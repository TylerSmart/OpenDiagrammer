import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ThinkModeDialogComponent, ThinkModeDialogData } from './think-mode-dialog.component';
import { ThinkModeConfig } from '../../../core/models/board.models';

describe('ThinkModeDialogComponent', () => {
  let component: ThinkModeDialogComponent;
  let fixture: ComponentFixture<ThinkModeDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  const defaultData: ThinkModeDialogData = {
    boardId: 'test-board',
    isCurrentlyActive: false,
    currentConfig: null,
  };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ThinkModeDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: defaultData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ThinkModeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and have default values', () => {
    expect(component).toBeTruthy();
    expect(component.form.value.timerPreset).toBe(300);
    expect(component.form.value.viewerParticipation).toBe(true);
    expect(component.form.value.hideOthersWriting).toBe(true);
  });

  it('should initialize with existing config', async () => {
    const existingConfig: ThinkModeConfig = {
      timerSeconds: 600,
      viewerParticipation: false,
      hideOthersWriting: false,
      groups: [
        {
          id: 'g-1',
          name: 'Squad Alpha',
          memberUsernames: ['Alice', 'Bob'],
        },
      ],
    };

    const customTestBed = TestBed.resetTestingModule();
    await customTestBed
      .configureTestingModule({
        imports: [ThinkModeDialogComponent],
        providers: [
          { provide: MatDialogRef, useValue: mockDialogRef },
          {
            provide: MAT_DIALOG_DATA,
            useValue: {
              boardId: 'test-board',
              isCurrentlyActive: true,
              currentConfig: existingConfig,
            },
          },
        ],
      })
      .compileComponents();

    const customFixture = customTestBed.createComponent(ThinkModeDialogComponent);
    const customComp = customFixture.componentRef.instance;
    expect(customComp.form.value.timerPreset).toBe(600);
    expect(customComp.form.value.viewerParticipation).toBe(false);
    expect(customComp.form.value.hideOthersWriting).toBe(false);
    expect(customComp.groups().length).toBe(1);
    expect(customComp.groups()[0].name).toBe('Squad Alpha');
  });

  it('should add and remove groups', () => {
    expect(component.groups().length).toBe(0);
    component.addGroup();
    expect(component.groups().length).toBe(1);

    const groupId = component.groups()[0].id;
    component.updateGroupName(groupId, 'Team Rocket');
    component.updateGroupMembers(groupId, 'Jessie, James');

    expect(component.groups()[0].name).toBe('Team Rocket');
    expect(component.groups()[0].membersText).toBe('Jessie, James');

    component.removeGroup(groupId);
    expect(component.groups().length).toBe(0);
  });

  it('should submit valid form and close dialog with start action', () => {
    component.form.patchValue({
      timerPreset: 180,
      viewerParticipation: true,
      hideOthersWriting: true,
    });

    component.onSubmit();

    expect(mockDialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'start',
        config: expect.objectContaining({
          timerSeconds: 180,
          viewerParticipation: true,
          hideOthersWriting: true,
        }),
      }),
    );
  });

  it('should close dialog with end action on onEndThinkMode', () => {
    component.onEndThinkMode();
    expect(mockDialogRef.close).toHaveBeenCalledWith({ action: 'end' });
  });
});
