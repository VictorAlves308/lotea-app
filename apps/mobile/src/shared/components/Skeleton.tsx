import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { palette } from '../theme/colors';

/**
 * A moving-gradient shimmer placeholder for loading states — never a
 * spinner sitting in the middle of content. A true shimmer (a soft
 * highlight band sweeping left-to-right), not a pulsing-opacity block,
 * per the design system's Motion section. Respects reduced-motion: a
 * static, slightly dim block instead of the sweep when the OS/browser
 * prefers it. Accepts `className` for sizing/radius (e.g. `h-9 w-40
 * rounded-2xl`) exactly like a plain `View`.
 */
export function Skeleton({ className, style, ...props }: ViewProps & { className?: string }) {
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [translate] = useState(() => new Animated.Value(0));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion || width === 0) return undefined;
    const bandWidth = width * 0.5;
    translate.setValue(-bandWidth);
    const loop = Animated.loop(
      Animated.timing(translate, {
        toValue: width,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [translate, reduceMotion, width]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={className}
      style={[
        { overflow: 'hidden', borderRadius: 16, backgroundColor: palette.dividerSoft, opacity: reduceMotion ? 0.7 : 1 },
        style,
      ]}
      {...props}
    >
      {!reduceMotion && width > 0 ? (
        <Animated.View
          style={{ width: width * 0.5, height: '100%', transform: [{ translateX: translate }] }}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={palette.surface} stopOpacity={0} />
                <Stop offset="0.5" stopColor={palette.surface} stopOpacity={0.65} />
                <Stop offset="1" stopColor={palette.surface} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#shimmer)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
