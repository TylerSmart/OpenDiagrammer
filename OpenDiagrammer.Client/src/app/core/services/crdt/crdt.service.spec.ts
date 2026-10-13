import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CrdtService } from './crdt.service';
import { CanvasDiagramData } from '../../../features/board/canvas/canvas.models';
import { CanvasShape } from '../../../features/board/canvas/shape.models';
import { CanvasConnection } from '../../../features/board/canvas/connection.models';

describe('CrdtService', () => {
  let service: CrdtService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CrdtService],
    });
    service = TestBed.inject(CrdtService);
  });

  afterEach(() => {
    service.destroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.diagramData().shapes).toEqual([]);
    expect(service.diagramData().connections).toEqual([]);
  });

  it('should initialize board with initial data', async () => {
    const dummyShape: CanvasShape = {
      id: 'shape-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      zIndex: 1,
    };
    const dummyConn: CanvasConnection = {
      id: 'conn-1',
      sourceShapeId: 'shape-1',
      sourceAnchor: 'right',
      targetPoint: { x: 300, y: 100 },
      strokeColor: '#000000',
      strokeWidth: 2,
      pattern: 'solid',
      routing: 'straight',
      endMarker: 'arrow',
    };

    const initialData: CanvasDiagramData = {
      shapes: [dummyShape],
      connections: [dummyConn],
    };

    await service.initBoard('board-123', initialData);

    const data = service.getDiagramData();
    expect(data.shapes.length).toBe(1);
    expect(data.shapes[0].id).toBe('shape-1');
    expect(data.connections.length).toBe(1);
    expect(data.connections[0].id).toBe('conn-1');
  });

  it('should emit local updates when applying local diagram changes', async () => {
    await service.initBoard('board-456');

    let emittedUpdate: Uint8Array | null = null;
    service.localUpdate$.subscribe((update) => {
      emittedUpdate = update;
    });

    const newShape: CanvasShape = {
      id: 'shape-2',
      type: 'ellipse',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      strokeColor: '#000000',
      fillColor: '#ff0000',
      strokeWidth: 2,
      zIndex: 1,
    };

    service.applyLocalDiagramChange({
      shapes: [newShape],
      connections: [],
    });

    expect(emittedUpdate).toBeTruthy();
    expect(service.diagramData().shapes.length).toBe(1);
    expect(service.diagramData().shapes[0].id).toBe('shape-2');
  });

  it('should apply remote updates and update diagramData without emitting local update', async () => {
    // Service A creates an update
    const serviceA = new CrdtService();
    await serviceA.initBoard('board-test');
    serviceA.updateShape({
      id: 'shape-remote',
      type: 'rectangle',
      x: 200,
      y: 200,
      width: 150,
      height: 100,
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      zIndex: 1,
    });
    const updateBytes = serviceA.encodeStateAsUpdate();

    // Service B receives remote update
    await service.initBoard('board-test');

    let localUpdateEmitted = false;
    service.localUpdate$.subscribe(() => {
      localUpdateEmitted = true;
    });

    service.applyRemoteUpdate(updateBytes);

    expect(service.diagramData().shapes.length).toBe(1);
    expect(service.diagramData().shapes[0].id).toBe('shape-remote');
    expect(localUpdateEmitted).toBe(false);

    serviceA.destroy();
  });

  it('should support updating and deleting individual shapes and connections', async () => {
    await service.initBoard('board-crud');

    const shape: CanvasShape = {
      id: 's1',
      type: 'diamond',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      strokeColor: '#000000',
      fillColor: '#ffffff',
      strokeWidth: 2,
      zIndex: 1,
    };
    service.updateShape(shape);
    expect(service.diagramData().shapes.length).toBe(1);

    service.deleteShape('s1');
    expect(service.diagramData().shapes.length).toBe(0);

    const conn: CanvasConnection = {
      id: 'c1',
      sourceShapeId: 's1',
      sourceAnchor: 'bottom',
      targetPoint: { x: 50, y: 100 },
      strokeColor: '#000000',
      strokeWidth: 2,
      pattern: 'solid',
      routing: 'straight',
      endMarker: 'arrow',
    };
    service.updateConnection(conn);
    expect(service.diagramData().connections.length).toBe(1);

    service.deleteConnection('c1');
    expect(service.diagramData().connections.length).toBe(0);
  });
});
