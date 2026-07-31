import { useId, useMemo, useState } from 'react';
import { Pressable, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { formatBRL } from '../../../shared/lib/currency';
import { Text } from '../../../shared/components/Text';
import { palette } from '../../../shared/theme/colors';

export interface ChartSeriesPoint {
  /** x-axis label, e.g. "05/01". */
  label: string;
  sold: number;
  received: number;
}

interface LineAreaChartProps {
  points: ChartSeriesPoint[];
  soldLabel: string;
  receivedLabel: string;
  /**
   * Fixed, deliberately width-independent — this chart is a supporting
   * "shape of the period" glance, not a growing centerpiece. It never gets
   * taller just because the container (e.g. a wide desktop panel) is wider.
   */
  height?: number;
}

const PADDING_X = 10;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 22;
const MAX_X_LABELS = 5;
const TOOLTIP_WIDTH = 172;
const GRID_LINE_FRACTIONS = [0.25, 0.5, 0.75];

/** Evenly samples up to `max` indices from `[0, count)`, always including the first and last. */
function sampleLabelIndices(count: number, max: number): number[] {
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => Math.round(i * step));
}

function buildLinePath(coords: { x: number; y: number }[]): string {
  return coords.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
}

/**
 * A Catmull-Rom-to-Bezier smoothed curve through every point — reads as a
 * deliberate, designed trend line rather than a jagged connect-the-dots
 * chart. Falls back to a plain line for < 3 points, where "smoothing" has
 * nothing to act on anyway.
 */
function buildSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length < 3) return buildLinePath(coords);

  let d = `M${coords[0]!.x},${coords[0]!.y}`;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const p0 = coords[i - 1] ?? coords[i]!;
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p3 = coords[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function buildSmoothAreaPath(coords: { x: number; y: number }[], baselineY: number): string {
  if (coords.length === 0) return '';
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  return `${buildSmoothPath(coords)} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
}

/**
 * The "shape of the period" chart — sold (muted line) vs. received (green
 * line + gradient area), sharing one y-scale so the gap between them reads
 * as "what's still uncollected". Tap anywhere to see the nearest point's
 * exact values; no continuous drag-scrub, no chart library — the only real
 * gap a library would close is cross-platform drag interaction, which this
 * deliberately doesn't need.
 *
 * Handles: 0/1/2-point series, an all-zero series, sold === received
 * (drawn so the muted line stays visible on top of the green area), wildly
 * uneven series magnitudes (shared scale, no clipping), very narrow
 * containers, and touch targets — the active point is picked by nearest-x,
 * not by hitting a tiny dot.
 */
export function LineAreaChart({ points, soldLabel, receivedLabel, height = 168 }: LineAreaChartProps) {
  const gradientId = useId();
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(points.length === 1 ? 0 : null);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const plotWidth = Math.max(1, width - PADDING_X * 2);
  const plotHeight = Math.max(1, height - PADDING_TOP - PADDING_BOTTOM);

  // Never divide by zero: an all-zero series (or a genuinely flat one)
  // still needs a real denominator, so every point maps cleanly to the
  // baseline instead of producing NaN coordinates.
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.sold, point.received]));

  const xFor = (index: number) =>
    points.length <= 1
      ? PADDING_X + plotWidth / 2 // a single point centers instead of dividing by (count - 1)
      : PADDING_X + (index / (points.length - 1)) * plotWidth;
  const yFor = (value: number) => PADDING_TOP + plotHeight - (value / maxValue) * plotHeight;

  const soldCoords = useMemo(
    () => points.map((point, i) => ({ x: xFor(i), y: yFor(point.sold) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, width, height],
  );
  const receivedCoords = useMemo(
    () => points.map((point, i) => ({ x: xFor(i), y: yFor(point.received) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, width, height],
  );

  const labelIndices = sampleLabelIndices(points.length, MAX_X_LABELS);

  const handlePress = (event: GestureResponderEvent) => {
    if (points.length === 0) return;
    const tapX = event.nativeEvent.locationX;
    // Nearest-point hit testing — the effective tap target for each point is
    // half the distance to its neighbors, not the few pixels of a rendered
    // dot, so points that render close together on a narrow phone are still
    // easy to select individually.
    let nearest = 0;
    let nearestDistance = Infinity;
    soldCoords.forEach((coord, i) => {
      const distance = Math.abs(coord.x - tapX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    });
    setActiveIndex((current) => (current === nearest ? null : nearest));
  };

  const totalSold = points.reduce((sum, point) => sum + point.sold, 0);
  const totalReceived = points.reduce((sum, point) => sum + point.received, 0);
  const trend = useMemo(() => {
    if (points.length < 2) return null;
    const half = Math.floor(points.length / 2);
    const firstHalfAvg = points.slice(0, half).reduce((sum, p) => sum + p.received, 0) / half;
    const secondHalfAvg = points.slice(-half).reduce((sum, p) => sum + p.received, 0) / half;
    if (firstHalfAvg === 0 && secondHalfAvg === 0) return 'stable';
    if (secondHalfAvg > firstHalfAvg * 1.1) return 'up';
    if (secondHalfAvg < firstHalfAvg * 0.9) return 'down';
    return 'stable';
  }, [points]);

  const trendGlyph = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';
  const trendWord = trend === 'up' ? 'em alta' : trend === 'down' ? 'em queda' : 'estável';
  const accessibleSummary =
    points.length === 0
      ? ''
      : `No período mostrado, vendido totalizou ${formatBRL(totalSold.toFixed(2))} e recebido ${formatBRL(
          totalReceived.toFixed(2),
        )}${trend ? `, com recebimentos ${trendWord} em relação à primeira metade do período` : ''}.`;

  if (points.length === 0) return null;

  const active = activeIndex !== null ? points[activeIndex] : null;
  const activeSoldCoord = activeIndex !== null ? soldCoords[activeIndex] : null;
  const activeReceivedCoord = activeIndex !== null ? receivedCoords[activeIndex] : null;

  // Clamp the tooltip horizontally so it never clips off a narrow screen.
  const tooltipLeft = activeSoldCoord
    ? Math.min(Math.max(activeSoldCoord.x - TOOLTIP_WIDTH / 2, 0), Math.max(width - TOOLTIP_WIDTH, 0))
    : 0;

  const trendColor = trend === 'up' ? palette.success : trend === 'down' ? palette.ink : palette.muted;

  return (
    <View>
      {/* Always-visible legend — the tooltip only appears on tap, so a user
          who never taps still needs to know which line is which at a glance. */}
      <View style={{ marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.success }} />
          <Text variant="caption" color="muted">
            {receivedLabel}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.muted }} />
          <Text variant="caption" color="muted">
            {soldLabel}
          </Text>
        </View>
      </View>

      <View style={{ position: 'relative', height }}>
        <Pressable onLayout={handleLayout} onPress={handlePress} style={{ height }}>
          {width > 0 ? (
            <Svg width={width} height={height} accessibilityLabel={accessibleSummary}>
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={palette.success} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={palette.success} stopOpacity={0} />
                </LinearGradient>
              </Defs>

              {GRID_LINE_FRACTIONS.map((fraction) => {
                const y = PADDING_TOP + plotHeight * fraction;
                return (
                  <Line
                    key={fraction}
                    x1={PADDING_X}
                    x2={width - PADDING_X}
                    y1={y}
                    y2={y}
                    stroke={palette.dividerSoft}
                    strokeWidth={1}
                  />
                );
              })}

              {points.length >= 2 ? (
                <>
                  <Path
                    d={buildSmoothAreaPath(receivedCoords, PADDING_TOP + plotHeight)}
                    fill={`url(#${gradientId})`}
                  />
                  <Path
                    d={buildSmoothPath(receivedCoords)}
                    stroke={palette.success}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  {/* Drawn last so it stays visible even when sold === received exactly. */}
                  <Path
                    d={buildSmoothPath(soldCoords)}
                    stroke={palette.muted}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </>
              ) : (
                <>
                  <Circle cx={receivedCoords[0]!.x} cy={receivedCoords[0]!.y} r={5} fill={palette.success} />
                  <Circle cx={soldCoords[0]!.x} cy={soldCoords[0]!.y} r={4} fill={palette.muted} />
                </>
              )}

              {activeSoldCoord && activeReceivedCoord ? (
                <>
                  <Line
                    x1={activeSoldCoord.x}
                    x2={activeSoldCoord.x}
                    y1={PADDING_TOP}
                    y2={PADDING_TOP + plotHeight}
                    stroke={palette.divider}
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  {/* A white halo behind each active dot, so it reads as a
                      distinct "selected point" even where the two series sit close together. */}
                  <Circle cx={activeReceivedCoord.x} cy={activeReceivedCoord.y} r={7} fill={palette.surface} />
                  <Circle cx={activeReceivedCoord.x} cy={activeReceivedCoord.y} r={5} fill={palette.success} />
                  <Circle cx={activeSoldCoord.x} cy={activeSoldCoord.y} r={6} fill={palette.surface} />
                  <Circle cx={activeSoldCoord.x} cy={activeSoldCoord.y} r={4} fill={palette.muted} />
                </>
              ) : null}
            </Svg>
          ) : null}
        </Pressable>

        {width > 0
          ? labelIndices.map((index) => (
              <Text
                key={points[index]!.label + index}
                variant="caption"
                color="muted"
                style={{ position: 'absolute', left: xFor(index) - 20, width: 40, textAlign: 'center', top: height - 16, fontSize: 11 }}
              >
                {points[index]!.label}
              </Text>
            ))
          : null}

        {active ? (
          <View
            style={{
              position: 'absolute',
              left: tooltipLeft,
              top: 0,
              width: TOOLTIP_WIDTH,
              borderRadius: 16,
              backgroundColor: palette.ink,
              paddingHorizontal: 16,
              paddingVertical: 12,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <Text variant="caption" style={{ color: '#FFFFFF', opacity: 0.6 }}>
              {active.label}
            </Text>
            <Text variant="body" style={{ color: '#FFFFFF', opacity: 0.85, fontSize: 13, marginTop: 4 }}>
              {soldLabel}: {formatBRL(active.sold.toFixed(2))}
            </Text>
            <Text variant="body" weight="semibold" style={{ color: '#FFFFFF', fontSize: 13 }}>
              {receivedLabel}: {formatBRL(active.received.toFixed(2))}
            </Text>
          </View>
        ) : null}
      </View>

      <Text variant="caption" color="muted" style={{ marginTop: 20, lineHeight: 18 }}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          variant="caption"
          color="inherit"
          style={{ color: trendColor }}
        >
          {trendGlyph}{' '}
        </Text>
        {accessibleSummary}
      </Text>
    </View>
  );
}
