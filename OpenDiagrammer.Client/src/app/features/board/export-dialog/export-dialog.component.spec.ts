import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExportDialogComponent, ExportDialogData } from './export-dialog.component';
import { CanvasExportService } from '../canvas/canvas-export.service';
import { CanvasShape } from '../canvas/shape.models';
import { RenderedConnection } from '../canvas/connection.models';

describe('ExportDialogComponent', () => {
  let component: ExportDialogComponent;
  let fixture: ComponentFixture<ExportDialogComponent>;
  let mockDialogRef: Partial<MatDialogRef<ExportDialogComponent>>;
  let mockExportService: Partial<CanvasExportService>;
  let mockSnackBar: Partial<MatSnackBar>;

  const mockShapes: CanvasShape[] = [
    {
      id: 'shape-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      fillColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 2,
      zIndex: 1,
    },
    {
      id: 'frame-1',
      type: 'frame',
      x: 50,
      y: 50,
      width: 800,
      height: 600,
      fillColor: 'transparent',
      strokeColor: '#cccccc',
      strokeWidth: 1.5,
      text: 'Frame A',
      zIndex: 0,
    },
  ];

  const mockConnections: RenderedConnection[] = [];

  const dialogData: ExportDialogData = {
    boardName: 'System Architecture',
    shapes: mockShapes,
    connections: mockConnections,
    frames: [mockShapes[1]],
    isDark: false,
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    mockExportService = {
      downloadExport: vi.fn().mockResolvedValue(undefined),
    };

    mockSnackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ExportDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: CanvasExportService, useValue: mockExportService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with defaults', () => {
    expect(component).toBeTruthy();
    expect(component.selectedFormat()).toBe('png');
    expect(component.selectedArea()).toBe('full');
    expect(component.selectedBackground()).toBe('theme');
  });

  it('should compute selectedAreaLabel and selectedAreaIcon correctly', () => {
    expect(component.selectedAreaIcon()).toBe('select_all');
    expect(component.selectedAreaLabel()).toBe('Entire Board (All content)');

    component.selectedArea.set('frame-1');
    expect(component.selectedAreaIcon()).toBe('crop_free');
    expect(component.selectedAreaLabel()).toContain('Frame A');
  });

  it('should update format when user selects a different format', () => {
    component.selectedFormat.set('svg');
    expect(component.selectedFormat()).toBe('svg');

    component.selectedFormat.set('pdf');
    expect(component.selectedFormat()).toBe('pdf');
  });

  it('should compute estimated bounds', () => {
    const bounds = component.estimatedBounds();
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  it('should close dialog when cancel is clicked', () => {
    component.handleCancel();
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });

  it('should invoke export service and close on handleExport', async () => {
    component.selectedFormat.set('svg');
    component.selectedBackground.set('transparent');

    await component.handleExport();

    expect(mockExportService.downloadExport).toHaveBeenCalledWith({
      shapes: dialogData.shapes,
      connections: dialogData.connections,
      frameId: null,
      format: 'svg',
      background: 'transparent',
      isDark: false,
      boardName: 'System Architecture',
    });

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      expect.stringContaining('SVG downloaded'),
      'Close',
      expect.any(Object),
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should pass frameId when specific frame is selected', async () => {
    component.selectedArea.set('frame-1');

    await component.handleExport();

    expect(mockExportService.downloadExport).toHaveBeenCalledWith(
      expect.objectContaining({
        frameId: 'frame-1',
      }),
    );
  });
});
