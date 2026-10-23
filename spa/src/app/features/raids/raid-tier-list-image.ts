import { Role } from '../../game/wow';
import { DIFFICULTY_COLORS } from './raid-display';
import { SPEC_TOP_SCORES } from './raid-scores';
import { FEW_PLAYERS, RoleTierList, describeTiers } from './raid-tier-list';

export interface TierListImageInfo {
  raidName: string;
  raidSlug: string;
  difficultySlug: string;
  difficultyName: string;
  date: Date;
}

const SCALE = 2;
const PADDING = 36;
const TILE = 80;
const LABEL_WIDTH = 100;
const MIN_COLUMNS = 6;
const MAX_COLUMNS = 12;
const FONT = 'Arial, Helvetica, sans-serif';
const GOLD = '#f7b500';
const TEXT = '#e0e0e0';
const MUTED = '#9a9a9a';
const INK = '#1a1a17';
const FOOTER_LINE = 19;
const SITE = 'tauriachievements.github.io';

export function imageColumns(list: RoleTierList): number {
  const widest = Math.max(0, ...list.rows.map(row => row.specs.length));
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, widest));
}

export function formatImageDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function localDay(date: Date): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(part => String(part).padStart(2, '0')).join('-');
}

export function tierListImageName(info: TierListImageInfo, role: Role): string {
  return `${info.raidSlug}-${info.difficultySlug}-${role}-tier-list-${localDay(info.date)}.png`;
}

export function imageFooter(list: RoleTierList): string[] {
  const metric = list.role === 'healer' ? 'HPS' : 'DPS';
  const characters = `${list.characterCount.toLocaleString('en-US')} ${list.characterCount === 1 ? 'character' : 'characters'}`;
  const fewPlayers = list.rows.some(row => row.specs.some(spec => spec.fewPlayers));
  return [
    `Each spec's top ${SPEC_TOP_SCORES} ${metric} scores, averaged, from ${characters}. Tier by share of the best spec: ${describeTiers()}.`,
    ...(fewPlayers ? [`A number on an icon: fewer than ${FEW_PLAYERS} characters played it.`] : []),
    ...(list.unplayed.length ? [`Not played: ${list.unplayed.join(', ')}.`] : [])
  ];
}

export function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  return line ? [...lines, line] : lines;
}

async function loadImage(document: Document, src: string): Promise<HTMLImageElement | undefined> {
  const image = document.createElement('img');
  image.src = src;
  try {
    await image.decode();
    return image;
  } catch {
    return undefined;
  }
}

function drawHeader(context: CanvasRenderingContext2D, list: RoleTierList, info: TierListImageInfo, width: number): void {
  const right = width - PADDING;
  const difficultyColor = DIFFICULTY_COLORS[info.difficultySlug] ?? TEXT;

  context.fillStyle = GOLD;
  context.fillRect(0, 0, width, 4);

  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.font = `700 13px ${FONT}`;
  context.fillText('TAURI LEGION · SPEC TIER LIST', PADDING, PADDING + 12);

  context.fillStyle = '#fff';
  context.font = `700 34px ${FONT}`;
  context.fillText(`${list.title} Tier List`, PADDING, PADDING + 52);

  context.font = `17px ${FONT}`;
  context.fillStyle = TEXT;
  const raid = `${info.raidName}  ·  `;
  context.fillText(raid, PADDING, PADDING + 82);
  const dotX = PADDING + context.measureText(raid).width + 6;
  context.fillStyle = difficultyColor;
  context.beginPath();
  context.arc(dotX, PADDING + 76, 5, 0, Math.PI * 2);
  context.fill();
  context.font = `700 17px ${FONT}`;
  context.fillText(info.difficultyName, dotX + 12, PADDING + 82);

  context.textAlign = 'right';
  context.fillStyle = TEXT;
  context.font = `15px ${FONT}`;
  context.fillText(formatImageDate(info.date), right, PADDING + 52);
  context.fillStyle = MUTED;
  context.font = `13px ${FONT}`;
  context.fillText(`${list.characterCount.toLocaleString('en-US')} characters`, right, PADDING + 82);
}

function drawBadge(context: CanvasRenderingContext2D, count: number, tileX: number, tileY: number): void {
  context.font = `700 12px ${FONT}`;
  const text = String(count);
  const width = Math.max(18, context.measureText(text).width + 10);
  const height = 17;
  const x = tileX + TILE - 3 - width;
  const y = tileY + TILE - 3 - height;

  context.beginPath();
  context.roundRect(x, y, width, height, height / 2);
  context.fillStyle = 'rgba(0, 0, 0, .82)';
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, .3)';
  context.lineWidth = 1;
  context.stroke();

  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, x + width / 2, y + height / 2 + 1);
}

export async function renderTierListImage(document: Document, list: RoleTierList, info: TierListImageInfo): Promise<Blob> {
  const specs = list.rows.flatMap(row => row.specs);
  const images = new Map(await Promise.all(specs.map(async spec => [spec.id, await loadImage(document, spec.art)] as const)));

  const columns = imageColumns(list);
  const width = PADDING * 2 + 2 + LABEL_WIDTH + columns * TILE;
  const rowHeights = list.rows.map(row => TILE * Math.max(1, Math.ceil(row.specs.length / columns)));
  const tableTop = PADDING + 108;
  const tableHeight = rowHeights.reduce((sum, height) => sum + height, 0) + rowHeights.length + 1;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This browser cannot draw the image.');
  }

  context.font = `13px ${FONT}`;
  const footer = imageFooter(list).flatMap(paragraph =>
    wrapText(paragraph, width - PADDING * 2, text => context.measureText(text).width));
  const footerTop = tableTop + tableHeight + 30;
  const siteBaseline = footerTop + footer.length * FOOTER_LINE + 10;
  const height = siteBaseline + PADDING - 8;

  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  context.scale(SCALE, SCALE);

  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#171717');
  background.addColorStop(1, '#070707');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  drawHeader(context, list, info, width);

  context.fillStyle = '#000';
  context.fillRect(PADDING, tableTop, width - PADDING * 2, tableHeight);

  let rowTop = tableTop + 1;
  list.rows.forEach((row, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];
    const labelX = PADDING + 1;
    const tilesX = labelX + LABEL_WIDTH;

    context.fillStyle = row.tier.color;
    context.fillRect(labelX, rowTop, LABEL_WIDTH, rowHeight);
    context.fillStyle = INK;
    context.fillRect(tilesX, rowTop, columns * TILE, rowHeight);

    context.fillStyle = INK;
    context.font = `700 30px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(row.tier.label, labelX + LABEL_WIDTH / 2, rowTop + rowHeight / 2 + 1);

    row.specs.forEach((spec, specIndex) => {
      const x = tilesX + (specIndex % columns) * TILE;
      const y = rowTop + Math.floor(specIndex / columns) * TILE;
      const image = images.get(spec.id);
      if (image) {
        context.drawImage(image, x, y, TILE, TILE);
      } else {
        context.fillStyle = '#333';
        context.fillRect(x, y, TILE, TILE);
      }
      if (spec.fewPlayers) {
        drawBadge(context, spec.count, x, y);
      }
    });

    rowTop += rowHeight + 1;
  });

  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = MUTED;
  context.font = `13px ${FONT}`;
  footer.forEach((line, index) => context.fillText(line, PADDING, footerTop + index * FOOTER_LINE));

  context.textAlign = 'right';
  context.fillStyle = GOLD;
  context.font = `700 13px ${FONT}`;
  context.fillText(SITE, width - PADDING, siteBaseline);

  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('The image could not be created.')),
    'image/png'
  ));
}

export function saveImage(document: Document, blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
