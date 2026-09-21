import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

export type CoverFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_COVER_FRAME: CoverFrame = {
  x: 10,
  y: 6,
  width: 80,
  height: 34,
};

type CoverMarkProps = {
  uri: string;
  framed: boolean;
  frame: CoverFrame;
  selected: boolean;
  onSelect: () => void;
  onChange: (frame: CoverFrame) => void;
};

function clamp(value: number, min: number, max: number): number {
  'worklet';
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number): number {
  'worklet';
  return Number.isFinite(value) ? value : fallback;
}

export function CoverMark({ uri, framed, frame, selected, onSelect, onChange }: CoverMarkProps) {
  const [page, setPage] = useState({ width: 1, height: 1 });
  const x = useSharedValue(frame.x);
  const y = useSharedValue(frame.y);
  const width = useSharedValue(frame.width);
  const height = useSharedValue(frame.height);
  const startX = useSharedValue(frame.x);
  const startY = useSharedValue(frame.y);
  const startW = useSharedValue(frame.width);
  const startH = useSharedValue(frame.height);
  const pageW = useSharedValue(1);
  const pageH = useSharedValue(1);
  const transforming = useSharedValue(false);

  useEffect(() => {
    if (transforming.value) return;
    x.value = frame.x;
    y.value = frame.y;
    width.value = frame.width;
    height.value = frame.height;
  }, [frame.height, frame.width, frame.x, frame.y, height, transforming, width, x, y]);

  useEffect(() => {
    pageW.value = page.width;
    pageH.value = page.height;
  }, [page.height, page.width, pageH, pageW]);

  const commit = (next: CoverFrame) => {
    const safe: CoverFrame = {
      x: Math.min(100, Math.max(0, Number.isFinite(next.x) ? next.x : frame.x)),
      y: Math.min(100, Math.max(0, Number.isFinite(next.y) ? next.y : frame.y)),
      width: Math.min(96, Math.max(18, Number.isFinite(next.width) ? next.width : frame.width)),
      height: Math.min(78, Math.max(14, Number.isFinite(next.height) ? next.height : frame.height)),
    };
    onChange(safe);
  };

  const drag = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      transforming.value = true;
      startX.value = x.value;
      startY.value = y.value;
      runOnJS(onSelect)();
    })
    .onUpdate((event) => {
      if (pageW.value < 8 || pageH.value < 8) return;
      const maxX = Math.max(0, 100 - width.value);
      const maxY = Math.max(0, 100 - height.value);
      x.value = finiteOr(
        clamp(startX.value + (event.translationX / pageW.value) * 100, 0, maxX),
        x.value,
      );
      y.value = finiteOr(
        clamp(startY.value + (event.translationY / pageH.value) * 100, 0, maxY),
        y.value,
      );
    })
    .onEnd(() => {
      transforming.value = false;
      runOnJS(commit)({ x: x.value, y: y.value, width: width.value, height: height.value });
    })
    .onFinalize(() => {
      transforming.value = false;
    });

  const resize = Gesture.Pan()
    .onStart(() => {
      transforming.value = true;
      startW.value = width.value;
      startH.value = height.value;
      runOnJS(onSelect)();
    })
    .onUpdate((event) => {
      if (pageW.value < 8 || pageH.value < 8) return;
      width.value = finiteOr(
        clamp(startW.value + (event.translationX / pageW.value) * 100, 18, 96),
        width.value,
      );
      height.value = finiteOr(
        clamp(startH.value + (event.translationY / pageH.value) * 100, 14, 78),
        height.value,
      );
    })
    .onEnd(() => {
      transforming.value = false;
      runOnJS(commit)({ x: x.value, y: y.value, width: width.value, height: height.value });
    })
    .onFinalize(() => {
      transforming.value = false;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      transforming.value = true;
      startW.value = width.value;
      startH.value = height.value;
      runOnJS(onSelect)();
    })
    .onUpdate((event) => {
      if (pageW.value < 8 || pageH.value < 8) return;
      const scale = finiteOr(event.scale, 1);
      if (scale <= 0) return;
      width.value = clamp(startW.value * scale, 18, 96);
      height.value = clamp(startH.value * scale, 14, 78);
    })
    .onEnd(() => {
      transforming.value = false;
      runOnJS(commit)({ x: x.value, y: y.value, width: width.value, height: height.value });
    })
    .onFinalize(() => {
      transforming.value = false;
    });

  const move = Gesture.Simultaneous(drag, pinch);

  const style = useAnimatedStyle(() => ({
    left: `${x.value}%`,
    top: `${y.value}%`,
    width: `${width.value}%`,
    height: `${height.value}%`,
  }));

  return (
    <View
      style={styles.layer}
      pointerEvents="box-none"
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        if (w >= 8 && h >= 8) setPage({ width: w, height: h });
      }}>
      <GestureDetector gesture={move}>
        <Animated.View style={[styles.mark, framed && styles.framed, selected && styles.selected, style]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selected ? 'Cover image selected. Drag or pinch to resize.' : 'Select cover image'
            }
            style={styles.hit}
            onPress={onSelect}>
            <Image
              source={{ uri, width: 512, height: 512 }}
              style={[styles.image, !framed && styles.imageSketch]}
              contentFit={framed ? 'cover' : 'contain'}
              cachePolicy="memory-disk"
              recyclingKey={`${uri}:${framed ? 'photo' : 'ink'}`}
              transition={180}
            />
          </Pressable>
          {selected ? (
            <GestureDetector gesture={resize}>
              <View accessibilityLabel="Resize cover image" style={styles.handle} />
            </GestureDetector>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  mark: {
    position: 'absolute',
    overflow: 'visible',
  },
  framed: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(90, 51, 32, 0.45)',
    backgroundColor: 'rgba(58, 36, 20, 0.12)',
  },
  selected: {
    borderWidth: 1,
    borderColor: 'rgba(58,36,20,0.45)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  hit: {
    width: '100%',
    height: '100%',
    minHeight: 40,
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  imageSketch: {
    opacity: 0.96,
  },
  handle: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: 28,
    height: 28,
    borderRadius: 3,
    backgroundColor: '#3b2414',
    borderWidth: 2,
    borderColor: '#f3e4c4',
  },
});
