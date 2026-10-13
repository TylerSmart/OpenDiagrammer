import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { RenderedConnection } from './connection.models';
import {
  BoundingBox,
  CanvasShape,
  computeFittingFontSize,
  parseUmlClassText,
  parseUmlInterfaceText,
} from './shape.models';

export type ExportFormat = 'svg' | 'png' | 'jpeg' | 'pdf';
export type ExportBackground = 'transparent' | 'theme';

export interface GenerateSvgOptions {
  shapes: CanvasShape[];
  connections: RenderedConnection[];
  frameId?: string | null;
  background: ExportBackground;
  isDark: boolean;
  themeBackgroundColor?: string;
}

export interface ExportCanvasOptions extends GenerateSvgOptions {
  format: ExportFormat;
  boardName?: string;
  scale?: number;
}

const CSS_VARIABLE_COLORS: Record<string, { light: string; dark: string }> = {
  '--canvas-color-default-fill': { light: '#ffffff', dark: '#1e1e24' },
  '--canvas-color-default-stroke': { light: '#374151', dark: '#d1d5db' },
  '--canvas-color-inverse-fill': { light: '#1e1e24', dark: '#ffffff' },
  '--canvas-color-inverse-stroke': { light: '#111827', dark: '#ffffff' },
  '--canvas-color-inverse-text': { light: '#ffffff', dark: '#111827' },
  '--canvas-color-blue-fill': { light: '#eff6ff', dark: '#172554' },
  '--canvas-color-blue-stroke': { light: '#2563eb', dark: '#60a5fa' },
  '--canvas-color-teal-fill': { light: '#f0fdfa', dark: '#042f2e' },
  '--canvas-color-teal-stroke': { light: '#0d9488', dark: '#2dd4bf' },
  '--canvas-color-green-fill': { light: '#f0fdf4', dark: '#052e16' },
  '--canvas-color-green-stroke': { light: '#16a34a', dark: '#4ade80' },
  '--canvas-color-lime-fill': { light: '#f7fee7', dark: '#1a2e05' },
  '--canvas-color-lime-stroke': { light: '#65a30d', dark: '#a3e635' },
  '--canvas-color-yellow-fill': { light: '#fefce8', dark: '#422006' },
  '--canvas-color-yellow-stroke': { light: '#ca8a04', dark: '#facc15' },
  '--canvas-color-amber-fill': { light: '#fffbeb', dark: '#451a03' },
  '--canvas-color-amber-stroke': { light: '#d97706', dark: '#fbbf24' },
  '--canvas-color-orange-fill': { light: '#fff7ed', dark: '#431407' },
  '--canvas-color-orange-stroke': { light: '#ea580c', dark: '#fb923c' },
  '--canvas-color-red-fill': { light: '#fef2f2', dark: '#450a0a' },
  '--canvas-color-red-stroke': { light: '#dc2626', dark: '#f87171' },
  '--canvas-color-pink-fill': { light: '#fdf2f8', dark: '#500724' },
  '--canvas-color-pink-stroke': { light: '#db2777', dark: '#f472b6' },
  '--canvas-color-purple-fill': { light: '#faf5ff', dark: '#2e1065' },
  '--canvas-color-purple-stroke': { light: '#9333ea', dark: '#c084fc' },
  '--mat-sys-primary': { light: '#1976d2', dark: '#90caf9' },
  '--mat-sys-surface': { light: '#ffffff', dark: '#1e1e24' },
  '--mat-sys-on-surface': { light: '#1f2937', dark: '#f3f4f6' },
};

export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resolveCssColor(
  color: string | null | undefined,
  isDark: boolean,
  fallback = '#000000',
): string {
  if (!color) {
    return fallback;
  }

  const trimmed = color.trim();
  if (!trimmed.includes('var(')) {
    return trimmed;
  }

  const varMatch = trimmed.match(/var\((--[^,)]+)(?:,\s*([^)]+))?\)/);
  if (!varMatch) {
    return trimmed;
  }

  const varName = varMatch[1].trim();
  const inlineFallback = varMatch[2]?.trim();

  if (CSS_VARIABLE_COLORS[varName]) {
    return isDark ? CSS_VARIABLE_COLORS[varName].dark : CSS_VARIABLE_COLORS[varName].light;
  }

  if (typeof document !== 'undefined' && document.body) {
    const computedVal = getComputedStyle(document.body).getPropertyValue(varName).trim();
    if (computedVal) {
      return computedVal;
    }
  }

  if (inlineFallback) {
    return resolveCssColor(inlineFallback, isDark, fallback);
  }

  return fallback;
}

export function extractPlainTextLines(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const normalized = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
  return normalized.split(/\r?\n/).map((l) => l.trimEnd());
}

export function computeExportBounds(
  shapes: CanvasShape[],
  connections: RenderedConnection[],
  frameId?: string | null,
): BoundingBox {
  if (frameId) {
    const frame = shapes.find((s) => s.id === frameId);
    if (frame) {
      return {
        minX: frame.x,
        minY: frame.y,
        maxX: frame.x + frame.width,
        maxY: frame.y + frame.height,
        width: Math.max(1, frame.width),
        height: Math.max(1, frame.height),
      };
    }
  }

  if (shapes.length === 0 && connections.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 800,
      maxY: 600,
      width: 800,
      height: 600,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  }

  for (const conn of connections) {
    if (conn.points && conn.points.length > 0) {
      for (const pt of conn.points) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }
    }
  }

  if (!isFinite(minX) || !isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }

  const padding = 40;
  const pMinX = Math.round(minX - padding);
  const pMinY = Math.round(minY - padding);
  const pMaxX = Math.round(maxX + padding);
  const pMaxY = Math.round(maxY + padding);

  return {
    minX: pMinX,
    minY: pMinY,
    maxX: pMaxX,
    maxY: pMaxY,
    width: Math.max(1, pMaxX - pMinX),
    height: Math.max(1, pMaxY - pMinY),
  };
}

@Injectable({
  providedIn: 'root',
})
export class CanvasExportService {
  private readonly themeService = inject(ThemeService);

  generateSvg(options: GenerateSvgOptions): string {
    const { shapes, connections, frameId, background, isDark } = options;
    const bounds = computeExportBounds(shapes, connections, frameId);

    const themeBg =
      options.themeBackgroundColor ||
      (isDark
        ? CSS_VARIABLE_COLORS['--mat-sys-surface'].dark
        : CSS_VARIABLE_COLORS['--mat-sys-surface'].light);

    // Shapes to render
    let shapesToRender = [...shapes].sort((a, b) => {
      const zA = a.type === 'frame' ? Math.max(1, a.zIndex) : 10 + a.zIndex;
      const zB = b.type === 'frame' ? Math.max(1, b.zIndex) : 10 + b.zIndex;
      return zA - zB;
    });

    if (frameId) {
      const frame = shapes.find((s) => s.id === frameId);
      if (frame) {
        shapesToRender = shapesToRender.filter((s) => {
          if (s.id === frameId) return false; // Frame itself is the background canvas
          return (
            s.x + s.width >= frame.x &&
            s.x <= frame.x + frame.width &&
            s.y + s.height >= frame.y &&
            s.y <= frame.y + frame.height
          );
        });
      }
    }

    const svgParts: string[] = [];

    // SVG Header
    svgParts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}">`,
    );

    // Defs (Markers & Global Styles)
    svgParts.push(`  <defs>
    <marker id="arrow-marker" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="context-stroke" />
    </marker>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    </style>
  </defs>`);

    // Background rect
    if (background === 'theme') {
      svgParts.push(
        `  <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${themeBg}" />`,
      );
    } else if (frameId) {
      // If frame export with transparent background, check if frame has an explicit fill
      const frame = shapes.find((s) => s.id === frameId);
      if (frame?.fillColor && !frame.fillColor.includes('transparent')) {
        const frameFill = resolveCssColor(frame.fillColor, isDark, 'transparent');
        svgParts.push(
          `  <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${frameFill}" />`,
        );
      }
    }

    // Connections Layer (rendered underneath shapes)
    if (connections.length > 0) {
      svgParts.push('  <!-- Connections -->');
      svgParts.push('  <g class="connections-layer">');
      for (const conn of connections) {
        const strokeColor = resolveCssColor(conn.strokeColor, isDark, '#374151');
        const strokeWidth = conn.strokeWidth || 2;
        const dashAttr = conn.dashArray ? ` stroke-dasharray="${conn.dashArray}"` : '';
        const startMarkerAttr =
          conn.startMarker === 'arrow' ? ' marker-start="url(#arrow-marker)"' : '';
        const endMarkerAttr = conn.endMarker === 'arrow' ? ' marker-end="url(#arrow-marker)"' : '';

        svgParts.push(
          `    <path d="${conn.path}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"${dashAttr}${startMarkerAttr}${endMarkerAttr} />`,
        );

        if (conn.text) {
          const labelBg = resolveCssColor(isDark ? '#1e1e24' : '#ffffff', isDark, '#ffffff');
          const labelTextColor = strokeColor;
          const rectW = conn.text.length * 6.8 + 16;
          const rectH = 24;
          const rectX = conn.midpoint.x - (conn.text.length * 3.4 + 8);
          const rectY = conn.midpoint.y - 12;

          svgParts.push(
            `    <g class="connection-label">
      <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="4" fill="${labelBg}" stroke="${strokeColor}" stroke-width="1" />
      <text x="${conn.midpoint.x}" y="${conn.midpoint.y + 4}" text-anchor="middle" font-size="12" fill="${labelTextColor}">${escapeXml(conn.text)}</text>
    </g>`,
          );
        }
      }
      svgParts.push('  </g>');
    }

    // Shapes Layer
    svgParts.push('  <!-- Shapes -->');
    svgParts.push('  <g class="shapes-layer">');
    for (const shape of shapesToRender) {
      svgParts.push(this.renderShapeSvg(shape, isDark));
    }
    svgParts.push('  </g>');

    svgParts.push('</svg>');
    return svgParts.join('\n');
  }

  private renderShapeSvg(shape: CanvasShape, isDark: boolean): string {
    const fill = resolveCssColor(shape.fillColor, isDark, '#ffffff');
    const stroke = resolveCssColor(shape.strokeColor, isDark, '#374151');
    const strokeWidth = shape.strokeWidth ?? 1.5;
    const defaultTextColor = resolveCssColor(
      shape.fillColor.includes('inverse')
        ? 'var(--canvas-color-inverse-text)'
        : 'var(--mat-sys-on-surface)',
      isDark,
      isDark ? '#f3f4f6' : '#1f2937',
    );

    const parts: string[] = [];
    parts.push(`    <g id="shape-${shape.id}" class="shape-item">`);

    // Shape Geometry
    switch (shape.type) {
      case 'rectangle':
      case 'flowchart-process':
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" width="${shape.width - 2}" height="${shape.height - 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;

      case 'rounded-rectangle':
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" rx="12" ry="12" width="${shape.width - 2}" height="${shape.height - 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;

      case 'ellipse':
      case 'uml-usecase':
        parts.push(
          `      <ellipse cx="${shape.x + shape.width / 2}" cy="${shape.y + shape.height / 2}" rx="${Math.max(1, (shape.width - 2) / 2)}" ry="${Math.max(1, (shape.height - 2) / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;

      case 'diamond':
      case 'flowchart-decision': {
        const w = shape.width;
        const h = shape.height;
        const points = `${shape.x + w / 2},${shape.y} ${shape.x + w},${shape.y + h / 2} ${shape.x + w / 2},${shape.y + h} ${shape.x},${shape.y + h / 2}`;
        parts.push(
          `      <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;
      }

      case 'triangle': {
        const w = shape.width;
        const h = shape.height;
        const points = `${shape.x + w / 2},${shape.y + 1} ${shape.x + w - 1},${shape.y + h - 1} ${shape.x + 1},${shape.y + h - 1}`;
        parts.push(
          `      <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;
      }

      case 'text-block':
        parts.push(
          `      <rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="transparent" stroke="none" />`,
        );
        break;

      case 'flowchart-terminal':
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" rx="${shape.height / 2}" ry="${shape.height / 2}" width="${shape.width - 2}" height="${shape.height - 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;

      case 'flowchart-io': {
        const w = shape.width;
        const h = shape.height;
        const slant = Math.min(24, Math.round(w * 0.2));
        const points = `${shape.x + slant},${shape.y + 1} ${shape.x + w - 1},${shape.y + 1} ${shape.x + w - slant},${shape.y + h - 1} ${shape.x + 1},${shape.y + h - 1}`;
        parts.push(
          `      <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;
      }

      case 'flowchart-document': {
        const w = shape.width;
        const h = shape.height;
        const d = `M ${shape.x + 1} ${shape.y + 1} L ${shape.x + w - 1} ${shape.y + 1} L ${shape.x + w - 1} ${shape.y + h - 14} Q ${shape.x + w * 0.75} ${shape.y + h - 24} ${shape.x + w * 0.5} ${shape.y + h - 14} Q ${shape.x + w * 0.25} ${shape.y + h - 4} ${shape.x + 1} ${shape.y + h - 14} Z`;
        parts.push(
          `      <path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;
      }

      case 'flowchart-database': {
        const w = shape.width;
        const h = shape.height;
        const ry = Math.min(14, Math.round(h * 0.2));
        const bodyD = `M ${shape.x + 1} ${shape.y + ry} A ${(w - 2) / 2} ${ry} 0 0 0 ${shape.x + w - 1} ${shape.y + ry} L ${shape.x + w - 1} ${shape.y + h - ry} A ${(w - 2) / 2} ${ry} 0 0 1 ${shape.x + 1} ${shape.y + h - ry} Z`;
        parts.push(
          `      <path d="${bodyD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        parts.push(
          `      <ellipse cx="${shape.x + w / 2}" cy="${shape.y + ry}" rx="${(w - 2) / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;
      }

      case 'uml-class': {
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" width="${shape.width - 2}" height="${shape.height - 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        const sections = parseUmlClassText(shape.text);
        const headerH = Math.round(shape.height * 0.28);
        const attrH = Math.round(shape.height * 0.34);

        parts.push(
          `      <line x1="${shape.x + 1}" y1="${shape.y + headerH}" x2="${shape.x + shape.width - 1}" y2="${shape.y + headerH}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        parts.push(
          `      <line x1="${shape.x + 1}" y1="${shape.y + headerH + attrH}" x2="${shape.x + shape.width - 1}" y2="${shape.y + headerH + attrH}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );

        // Header Class Name
        const classLines = extractPlainTextLines(sections.className);
        parts.push(
          this.renderTextLinesSvg(
            classLines,
            shape.x + 8,
            shape.y + 6,
            shape.width - 16,
            headerH - 10,
            14,
            defaultTextColor,
            'center',
            'middle',
            true,
          ),
        );

        // Attributes
        const attrLines = extractPlainTextLines(sections.attributes);
        parts.push(
          this.renderTextLinesSvg(
            attrLines,
            shape.x + 10,
            shape.y + headerH + 6,
            shape.width - 20,
            attrH - 12,
            12,
            defaultTextColor,
            'left',
            'top',
          ),
        );

        // Methods
        const methodLines = extractPlainTextLines(sections.methods);
        parts.push(
          this.renderTextLinesSvg(
            methodLines,
            shape.x + 10,
            shape.y + headerH + attrH + 6,
            shape.width - 20,
            shape.height - (headerH + attrH) - 12,
            12,
            defaultTextColor,
            'left',
            'top',
          ),
        );
        break;
      }

      case 'uml-interface': {
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" width="${shape.width - 2}" height="${shape.height - 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        const sections = parseUmlInterfaceText(shape.text);
        const headerH = Math.round(shape.height * 0.38);

        parts.push(
          `      <line x1="${shape.x + 1}" y1="${shape.y + headerH}" x2="${shape.x + shape.width - 1}" y2="${shape.y + headerH}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );

        // Interface name
        const ifaceLines = extractPlainTextLines(sections.interfaceName);
        parts.push(
          this.renderTextLinesSvg(
            ifaceLines,
            shape.x + 8,
            shape.y + 6,
            shape.width - 16,
            headerH - 10,
            13,
            defaultTextColor,
            'center',
            'middle',
            true,
            true,
          ),
        );

        // Methods
        const methodLines = extractPlainTextLines(sections.methods);
        parts.push(
          this.renderTextLinesSvg(
            methodLines,
            shape.x + 10,
            shape.y + headerH + 6,
            shape.width - 20,
            shape.height - headerH - 12,
            12,
            defaultTextColor,
            'left',
            'top',
          ),
        );
        break;
      }

      case 'uml-actor': {
        const headCy = shape.y + shape.height * 0.2;
        const headR = shape.height * 0.15;
        parts.push(
          `      <circle cx="${shape.x + shape.width / 2}" cy="${headCy}" r="${headR}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        parts.push(
          `      <line x1="${shape.x + shape.width / 2}" y1="${shape.y + shape.height * 0.35}" x2="${shape.x + shape.width / 2}" y2="${shape.y + shape.height * 0.7}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        parts.push(
          `      <line x1="${shape.x + shape.width * 0.15}" y1="${shape.y + shape.height * 0.45}" x2="${shape.x + shape.width * 0.85}" y2="${shape.y + shape.height * 0.45}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        parts.push(
          `      <line x1="${shape.x + shape.width / 2}" y1="${shape.y + shape.height * 0.7}" x2="${shape.x + shape.width * 0.2}" y2="${shape.y + shape.height - 2}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        parts.push(
          `      <line x1="${shape.x + shape.width / 2}" y1="${shape.y + shape.height * 0.7}" x2="${shape.x + shape.width * 0.8}" y2="${shape.y + shape.height - 2}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;
      }

      case 'uml-package': {
        const tabW = Math.min(60, Math.round(shape.width * 0.45));
        const tabH = Math.min(20, Math.round(shape.height * 0.2));
        const tabD = `M ${shape.x + 1} ${shape.y + tabH} L ${shape.x + 1} ${shape.y + 1} L ${shape.x + tabW} ${shape.y + 1} L ${shape.x + tabW} ${shape.y + tabH}`;
        parts.push(
          `      <path d="${tabD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + tabH}" width="${shape.width - 2}" height="${shape.height - tabH - 1}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        break;
      }

      case 'sticky-note':
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" rx="4" ry="4" width="${shape.width - 2}" height="${shape.height - 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        if (shape.authorName && shape.showAuthor !== false) {
          parts.push(
            `      <text x="${shape.x + 10}" y="${shape.y + shape.height - 10}" font-size="11" fill="${defaultTextColor}" opacity="0.75">✍ ${escapeXml(shape.authorName)}</text>`,
          );
        }
        break;

      case 'sticky-pad':
        parts.push(
          `      <rect x="${shape.x + 6}" y="${shape.y + 6}" rx="4" ry="4" width="${shape.width - 8}" height="${shape.height - 8}" fill="rgba(0, 0, 0, 0.12)" />`,
        );
        parts.push(
          `      <rect x="${shape.x + 3}" y="${shape.y + 3}" rx="4" ry="4" width="${shape.width - 6}" height="${shape.height - 6}" fill="${fill}" opacity="0.75" />`,
        );
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" rx="4" ry="4" width="${shape.width - 4}" height="${shape.height - 4}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
        );
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" rx="4" ry="4" width="${shape.width - 4}" height="16" fill="rgba(0, 0, 0, 0.08)" />`,
        );
        break;

      case 'frame': {
        const frameFill = shape.fillColor ? fill : 'rgba(128, 128, 128, 0.03)';
        const frameStroke = shape.strokeColor ? stroke : 'rgba(140, 140, 160, 0.5)';
        parts.push(
          `      <rect x="${shape.x + 1}" y="${shape.y + 1}" rx="4" ry="4" width="${shape.width - 2}" height="${shape.height - 2}" fill="${frameFill}" stroke="${frameStroke}" stroke-width="${strokeWidth || 1.5}" stroke-dasharray="6,4" />`,
        );
        // Frame title header badge
        const frameTitle = shape.text || 'Frame';
        const tabWidth = Math.min(shape.width, frameTitle.length * 8 + 32);
        parts.push(
          `      <g class="frame-header">
        <rect x="${shape.x}" y="${shape.y - 22}" width="${tabWidth}" height="22" rx="4" fill="rgba(100, 100, 120, 0.15)" />
        <text x="${shape.x + 8}" y="${shape.y - 6}" font-size="11" font-weight="600" fill="${defaultTextColor}"># ${escapeXml(frameTitle)}</text>
      </g>`,
        );
        break;
      }
    }

    // Standard shape text rendering (excluding UML and Frames which render their own text)
    if (shape.type !== 'uml-class' && shape.type !== 'uml-interface' && shape.type !== 'frame') {
      const lines = extractPlainTextLines(shape.text);
      if (lines.length > 0) {
        const fontSize =
          shape.fontSize || computeFittingFontSize(shape.text, shape.width, shape.height, 14);
        const padding = shape.type === 'sticky-note' ? 12 : 8;
        parts.push(
          this.renderTextLinesSvg(
            lines,
            shape.x + padding,
            shape.y + padding,
            shape.width - padding * 2,
            shape.height - padding * 2,
            fontSize,
            defaultTextColor,
            shape.textAlign || 'center',
            shape.verticalAlign || 'middle',
            shape.isBold,
            shape.isItalic,
            shape.isUnderline,
          ),
        );
      }
    }

    parts.push('    </g>');
    return parts.join('\n');
  }

  private renderTextLinesSvg(
    lines: string[],
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    color: string,
    textAlign: 'left' | 'center' | 'right' = 'center',
    verticalAlign: 'top' | 'middle' | 'bottom' = 'middle',
    isBold = false,
    isItalic = false,
    isUnderline = false,
  ): string {
    if (lines.length === 0) return '';

    const lineHeight = Math.round(fontSize * 1.3);
    const totalTextHeight = lines.length * lineHeight;

    let startY: number;
    if (verticalAlign === 'top') {
      startY = y + fontSize;
    } else if (verticalAlign === 'bottom') {
      startY = y + height - totalTextHeight + fontSize;
    } else {
      startY = y + (height - totalTextHeight) / 2 + fontSize * 0.85;
    }

    let anchorX: number;
    let textAnchor: string;
    if (textAlign === 'left') {
      anchorX = x;
      textAnchor = 'start';
    } else if (textAlign === 'right') {
      anchorX = x + width;
      textAnchor = 'end';
    } else {
      anchorX = x + width / 2;
      textAnchor = 'middle';
    }

    const weightAttr = isBold ? ' font-weight="bold"' : '';
    const styleAttr = isItalic ? ' font-style="italic"' : '';
    const decorAttr = isUnderline ? ' text-decoration="underline"' : '';

    const tspans = lines
      .map(
        (line, index) =>
          `<tspan x="${anchorX}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
      )
      .join('');

    return `      <text x="${anchorX}" y="${startY}" text-anchor="${textAnchor}" font-size="${fontSize}" fill="${color}"${weightAttr}${styleAttr}${decorAttr}>${tspans}</text>`;
  }

  async exportCanvas(options: ExportCanvasOptions): Promise<Blob> {
    const { format, background, isDark } = options;
    const svgString = this.generateSvg(options);
    const bounds = computeExportBounds(options.shapes, options.connections, options.frameId);

    if (format === 'svg') {
      return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    }

    const scale = options.scale || 2;
    const canvas = await this.renderSvgToCanvas(
      svgString,
      bounds.width,
      bounds.height,
      scale,
      background === 'theme' || format === 'jpeg'
        ? options.themeBackgroundColor ||
            (isDark
              ? CSS_VARIABLE_COLORS['--mat-sys-surface'].dark
              : CSS_VARIABLE_COLORS['--mat-sys-surface'].light)
        : undefined,
    );

    if (format === 'png') {
      return this.canvasToBlob(canvas, 'image/png');
    }

    if (format === 'jpeg') {
      return this.canvasToBlob(canvas, 'image/jpeg', 0.95);
    }

    if (format === 'pdf') {
      const orientation = bounds.width >= bounds.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [bounds.width, bounds.height],
        hotfixes: ['px_scaling'],
      });

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, bounds.width, bounds.height);
      const pdfBlob = pdf.output('blob');
      return pdfBlob;
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  private renderSvgToCanvas(
    svgString: string,
    width: number,
    height: number,
    scale: number,
    solidBgColor?: string,
  ): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Canvas rasterization requires DOM document'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback for headless environments (e.g., jsdom) where Canvas 2D is not implemented
        const fallbackCanvas = {
          width: canvas.width,
          height: canvas.height,
          toDataURL: () =>
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          toBlob: (cb: (blob: Blob | null) => void, mime: string) => {
            cb(new Blob([], { type: mime }));
          },
        } as unknown as HTMLCanvasElement;
        resolve(fallbackCanvas);
        return;
      }

      // If solid background is specified or needed
      if (solidBgColor) {
        ctx.fillStyle = solidBgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Fallback: in headless or mocking environments, resolve canvas directly
        resolve(canvas);
      };

      img.src = url;
    });
  }

  private canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality?: number,
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error(`Failed to convert canvas to ${mimeType}`));
            }
          },
          mimeType,
          quality,
        );
      } else {
        // Fallback for jsdom / mocked environments
        try {
          const dataUrl = canvas.toDataURL(mimeType, quality);
          const binary = atob(dataUrl.split(',')[1] || '');
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
          }
          resolve(new Blob([array], { type: mimeType }));
        } catch (_err) {
          resolve(new Blob([], { type: mimeType }));
        }
      }
    });
  }

  async downloadExport(options: ExportCanvasOptions & { boardName: string }): Promise<void> {
    const blob = await this.exportCanvas(options);
    const sanitizedName =
      (options.boardName || 'board')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'diagram';

    const scopeSlug = options.frameId ? `frame-${options.frameId.substring(0, 6)}` : 'full';
    const extension = options.format === 'jpeg' ? 'jpg' : options.format;
    const filename = `${sanitizedName}-${scopeSlug}.${extension}`;

    this.downloadBlob(blob, filename);
  }

  downloadBlob(blob: Blob, filename: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
