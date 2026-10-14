import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  CanvasExportService,
  computeExportBounds,
  escapeXml,
  extractPlainTextLines,
  getTextWidth,
  resolveCssColor,
  wrapTextLines,
} from './canvas-export.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { CanvasShape } from './shape.models';
import { RenderedConnection } from './connection.models';

describe('CanvasExportService', () => {
  let service: CanvasExportService;
  let mockThemeService: Partial<ThemeService>;

  const mockShapes: CanvasShape[] = [
    {
      id: 'shape-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      fillColor: 'var(--canvas-color-blue-fill)',
      strokeColor: 'var(--canvas-color-blue-stroke)',
      strokeWidth: 2,
      text: 'Process Step',
      zIndex: 1,
    },
    {
      id: 'shape-2',
      type: 'ellipse',
      x: 300,
      y: 100,
      width: 100,
      height: 100,
      fillColor: '#ffffff',
      strokeColor: '#333333',
      strokeWidth: 1.5,
      text: 'End',
      zIndex: 2,
    },
    {
      id: 'frame-1',
      type: 'frame',
      x: 50,
      y: 50,
      width: 500,
      height: 400,
      fillColor: 'rgba(0,0,0,0.02)',
      strokeColor: '#999999',
      strokeWidth: 1.5,
      text: 'Main Frame',
      zIndex: 0,
    },
  ];

  const mockConnections: RenderedConnection[] = [
    {
      id: 'conn-1',
      routing: 'orthogonal',
      pattern: 'solid',
      strokeColor: '#2563eb',
      strokeWidth: 2,
      startMarker: 'none',
      endMarker: 'arrow',
      text: 'Success',
      path: 'M 220 140 L 300 150',
      startPoint: { x: 220, y: 140 },
      endPoint: { x: 300, y: 150 },
      midpoint: { x: 260, y: 145 },
      waypoints: [],
      points: [
        { x: 220, y: 140 },
        { x: 300, y: 150 },
      ],
      segments: [],
    },
  ];

  beforeEach(() => {
    mockThemeService = {
      isDark: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [CanvasExportService, { provide: ThemeService, useValue: mockThemeService }],
    });

    service = TestBed.inject(CanvasExportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('helper functions', () => {
    it('escapeXml should escape special characters', () => {
      expect(escapeXml('<script>alert("hello" & \'bye\')</script>')).toBe(
        '&lt;script&gt;alert(&quot;hello&quot; &amp; &apos;bye&apos;)&lt;/script&gt;',
      );
      expect(escapeXml(null)).toBe('');
    });

    it('extractPlainTextLines should strip HTML and normalize line breaks', () => {
      const html = '<p>First Line</p><br/><div>Second Line</div>';
      const lines = extractPlainTextLines(html);
      expect(lines).toContain('First Line');
      expect(lines).toContain('Second Line');
    });

    it('extractPlainTextLines should preserve line returns from div and br tags without concatenating words', () => {
      expect(extractPlainTextLines('Class<div>Name</div>')).toEqual(['Class', 'Name']);
      expect(extractPlainTextLines('<div>Class</div><div>Name</div>')).toEqual(['Class', 'Name']);
      expect(
        extractPlainTextLines('+ attribute: type<div><br></div><div>- another: type</div>'),
      ).toEqual(['+ attribute: type', '', '- another: type']);
      expect(extractPlainTextLines('Class\nName')).toEqual(['Class', 'Name']);
      expect(extractPlainTextLines('+ attribute: type\n\n- another: type')).toEqual([
        '+ attribute: type',
        '',
        '- another: type',
      ]);
    });

    it('getTextWidth should compute string width proportional to text length and font size', () => {
      expect(getTextWidth('', 14)).toBe(0);
      const w1 = getTextWidth('Hello', 14);
      const w2 = getTextWidth('Hello World', 14);
      expect(w2).toBeGreaterThan(w1);
      const wBold = getTextWidth('Hello', 14, true);
      expect(wBold).toBeGreaterThan(w1);
    });

    it('wrapTextLines should return empty array for empty or whitespace-only input', () => {
      expect(wrapTextLines('', 100, 14)).toEqual([]);
      expect(wrapTextLines(null, 100, 14)).toEqual([]);
    });

    it('wrapTextLines should wrap long sentences into multiple lines', () => {
      const longSentence =
        'This is a very long line of text that needs to wrap properly within a confined width';
      const lines = wrapTextLines(longSentence, 100, 14);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.join(' ')).toBe(longSentence);
    });

    it('wrapTextLines should break extremely long words that exceed maxWidth', () => {
      const longWord = 'supercalifragilisticexpialidocious';
      const lines = wrapTextLines(longWord, 50, 14);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.join('')).toBe(longWord);
    });

    it('resolveCssColor should resolve CSS variables for light and dark themes', () => {
      const lightColor = resolveCssColor('var(--canvas-color-blue-fill)', false);
      const darkColor = resolveCssColor('var(--canvas-color-blue-fill)', true);
      expect(lightColor).toBe('#eff6ff');
      expect(darkColor).toBe('#172554');

      const rawHex = resolveCssColor('#ff0000', false);
      expect(rawHex).toBe('#ff0000');
    });

    it('computeExportBounds should return default box for empty canvas', () => {
      const bounds = computeExportBounds([], []);
      expect(bounds.width).toBe(800);
      expect(bounds.height).toBe(600);
    });

    it('computeExportBounds should return padded union box for shapes and connections', () => {
      const bounds = computeExportBounds(mockShapes, mockConnections);
      expect(bounds.minX).toBeLessThanOrEqual(50);
      expect(bounds.maxX).toBeGreaterThanOrEqual(550);
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    });

    it('computeExportBounds should return exact frame dimensions when frameId is specified', () => {
      const bounds = computeExportBounds(mockShapes, mockConnections, 'frame-1');
      expect(bounds.minX).toBe(50);
      expect(bounds.minY).toBe(50);
      expect(bounds.width).toBe(500);
      expect(bounds.height).toBe(400);
    });
  });

  describe('generateSvg', () => {
    it('should generate valid standalone SVG with theme background', () => {
      const svg = service.generateSvg({
        shapes: mockShapes,
        connections: mockConnections,
        background: 'theme',
        isDark: false,
      });

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('fill="#ffffff"'); // Theme background in light mode
      expect(svg).toContain('class="connections-layer"');
      expect(svg).toContain('class="shapes-layer"');
      expect(svg).toContain('id="shape-shape-1"');
      expect(svg).toContain('id="shape-shape-2"');
      expect(svg).toContain('marker-end="url(#arrow-marker)"');
      expect(svg).toContain('Success');
      expect(svg).toContain('Process Step');
    });

    it('should generate transparent SVG without theme background rect', () => {
      const svg = service.generateSvg({
        shapes: mockShapes,
        connections: mockConnections,
        background: 'transparent',
        isDark: false,
      });

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      // Should not contain full theme background rect
      expect(svg).not.toContain('<rect x="10" y="10" width="');
    });

    it('should filter shapes to frame area when exporting a specific frame', () => {
      const outsideShape: CanvasShape = {
        id: 'shape-outside',
        type: 'rectangle',
        x: 1000,
        y: 1000,
        width: 100,
        height: 100,
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 1,
        zIndex: 1,
      };

      const svg = service.generateSvg({
        shapes: [...mockShapes, outsideShape],
        connections: mockConnections,
        frameId: 'frame-1',
        background: 'transparent',
        isDark: false,
      });

      expect(svg).toContain('shape-shape-1');
      expect(svg).not.toContain('shape-outside');
    });

    it('should render UML class compartments', () => {
      const umlShape: CanvasShape = {
        id: 'uml-1',
        type: 'uml-class',
        x: 100,
        y: 100,
        width: 160,
        height: 120,
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 1.5,
        text: 'User\n---\n+ id: string\n---\n+ save(): void',
        zIndex: 1,
      };

      const svg = service.generateSvg({
        shapes: [umlShape],
        connections: [],
        background: 'theme',
        isDark: false,
      });

      expect(svg).toContain('User');
      expect(svg).toContain('+ id: string');
      expect(svg).toContain('+ save(): void');
    });

    it('should wrap long text in UML class shapes into multiple tspans', () => {
      const umlShape: CanvasShape = {
        id: 'uml-long',
        type: 'uml-class',
        x: 100,
        y: 100,
        width: 150,
        height: 200,
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 1.5,
        text: 'ClassName\n---\n+ reallyLongAttributeNameThatWillDefinitelyWrapAcrossMultipleLines: string\n---\n+ executeLongMethodNameWithManyParameters()',
        zIndex: 1,
      };

      const svg = service.generateSvg({
        shapes: [umlShape],
        connections: [],
        background: 'theme',
        isDark: false,
      });

      const tspanMatches = svg.match(/<tspan[^>]*>[^<]+<\/tspan>/g) || [];
      expect(tspanMatches.length).toBeGreaterThan(3);
      expect(svg).toContain('ClassName');
    });

    it('should wrap long text in standard shapes into multiple tspans', () => {
      const rectShape: CanvasShape = {
        id: 'rect-long',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 120,
        height: 80,
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 1,
        text: 'This is a very long descriptive text inside a rectangle',
        zIndex: 1,
      };

      const svg = service.generateSvg({
        shapes: [rectShape],
        connections: [],
        background: 'transparent',
        isDark: false,
      });

      const tspanMatches = svg.match(/<tspan[^>]*>[^<]+<\/tspan>/g) || [];
      expect(tspanMatches.length).toBeGreaterThan(1);
    });

    it('should correctly handle manual returns and blank lines in UML class compartments without concatenating or misaligning', () => {
      const umlShape: CanvasShape = {
        id: 'uml-manual-returns',
        type: 'uml-class',
        x: 100,
        y: 100,
        width: 180,
        height: 120,
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 1.5,
        text: 'Class\nName\n---\n+ attribute: type\n\n- another: type\n---\n+ method(): void',
        zIndex: 1,
      };

      const svg = service.generateSvg({
        shapes: [umlShape],
        connections: [],
        background: 'theme',
        isDark: false,
      });

      // Header should have Class and Name on distinct tspans, not 'ClassName'
      expect(svg).toContain('>Class</tspan>');
      expect(svg).toContain('>Name</tspan>');
      expect(svg).not.toContain('ClassName');

      // Attribute section should preserve the blank line with &#160;
      expect(svg).toContain('+ attribute: type');
      expect(svg).toContain('&#160;</tspan>');
      expect(svg).toContain('- another: type');

      // Methods text should be rendered cleanly
      expect(svg).toContain('+ method(): void');

      // The rect height must be enlarged if needed to fit all sections
      const rectMatch = svg.match(/<rect[^>]*height="([^"]+)"/);
      expect(rectMatch).toBeTruthy();
      const renderedHeight = parseFloat(rectMatch![1]);
      // Total required height for 2 header lines + 3 attr lines + 1 method line is >= 144px
      expect(renderedHeight).toBeGreaterThanOrEqual(144);
    });
  });

  describe('exportCanvas and downloads', () => {
    it('should export SVG as Blob', async () => {
      const blob = await service.exportCanvas({
        shapes: mockShapes,
        connections: mockConnections,
        format: 'svg',
        background: 'transparent',
        isDark: false,
      });

      expect(blob).toBeTruthy();
      expect(blob.type).toContain('image/svg+xml');
    });

    it('should export PDF as Blob', async () => {
      const blob = await service.exportCanvas({
        shapes: mockShapes,
        connections: mockConnections,
        format: 'pdf',
        background: 'theme',
        isDark: false,
      });

      expect(blob).toBeTruthy();
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should trigger downloadExport with sanitized filename', async () => {
      const downloadSpy = vi.spyOn(service, 'downloadBlob').mockImplementation(() => {
        return;
      });

      await service.downloadExport({
        shapes: mockShapes,
        connections: mockConnections,
        format: 'svg',
        background: 'theme',
        isDark: false,
        boardName: 'My Awesome Board!',
      });

      expect(downloadSpy).toHaveBeenCalledWith(expect.any(Blob), 'my-awesome-board-full.svg');
    });
  });
});
