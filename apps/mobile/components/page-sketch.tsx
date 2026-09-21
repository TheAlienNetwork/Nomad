import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { FieldButton } from '@/components/field-button';
import type { PageSketch } from '@/src/store';

type PageSketchLayerProps = {
  sketches: PageSketch[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (
    id: string,
    patch: Partial<Pick<PageSketch, 'x' | 'y' | 'width' | 'height' | 'rotate'>>,
  ) => void;
  onRemove: (id: string) => void;
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

export function PageSketchLayer({
  sketches,
  selectedId,
  onSelect,
  onChange,
  onRemove,
}: PageSketchLayerProps) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const ordered = [...(sketches ?? [])].sort((left, right) => {
    const zDiff = (left.z ?? 0) - (right.z ?? 0);
    if (zDiff !== 0) return zDiff;
    if (left.id === selectedId) return 1;
    if (right.id === selectedId) return -1;
    return 0;
  });

  return (
    <View
      style={styles.layer}
      pointerEvents="box-none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width >= 8 && height >= 8) setSize({ width, height });
      }}>
      {ordered.map((sketch) => (
        <SketchMark
          key={sketch.id}
          sketch={sketch}
          pageWidth={size.width}
          pageHeight={size.height}
          selected={selectedId === sketch.id}
          onSelect={onSelect}
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

function SketchMark({
  sketch,
  pageWidth,
  pageHeight,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  sketch: PageSketch;
  pageWidth: number;
  pageHeight: number;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onChange: (
    id: string,
    patch: Partial<Pick<PageSketch, 'x' | 'y' | 'width' | 'height' | 'rotate'>>,
  ) => void;
  onRemove: (id: string) => void;
}) {
  const x = useSharedValue(sketch.x);
  const y = useSharedValue(sketch.y);
  const width = useSharedValue(sketch.width);
  const height = useSharedValue(sketch.height);
  const rotate = useSharedValue(sketch.rotate ?? 0);
  const startX = useSharedValue(sketch.x);
  const startY = useSharedValue(sketch.y);
  const startW = useSharedValue(sketch.width);
  const startH = useSharedValue(sketch.height);
  const pageW = useSharedValue(pageWidth);
  const pageH = useSharedValue(pageHeight);
  const transforming = useSharedValue(false);

  useEffect(() => {
    if (transforming.value) return;
    x.value = sketch.x;
    y.value = sketch.y;
    width.value = sketch.width;
    height.value = sketch.height;
    rotate.value = sketch.rotate ?? 0;
  }, [height, rotate, sketch.height, sketch.rotate, sketch.width, sketch.x, sketch.y, transforming, width, x, y]);

  useEffect(() => {
    pageW.value = pageWidth;
    pageH.value = pageHeight;
  }, [pageH, pageW, pageHeight, pageWidth]);

  const selectSelf = () => {
    if (!selected) onSelect(sketch.id);
  };

  const commitLayout = (patch: Partial<Pick<PageSketch, 'x' | 'y' | 'width' | 'height'>>) => {
    const next: Partial<Pick<PageSketch, 'x' | 'y' | 'width' | 'height'>> = {};
    if (typeof patch.x === 'number' && Number.isFinite(patch.x)) {
      next.x = Math.min(100, Math.max(0, patch.x));
    }
    if (typeof patch.y === 'number' && Number.isFinite(patch.y)) {
      next.y = Math.min(100, Math.max(0, patch.y));
    }
    if (typeof patch.width === 'number' && Number.isFinite(patch.width)) {
      next.width = Math.min(96, Math.max(10, patch.width));
    }
    if (typeof patch.height === 'number' && Number.isFinite(patch.height)) {
      next.height = Math.min(92, Math.max(10, patch.height));
    }
    if (Object.keys(next).length === 0) return;
    onChange(sketch.id, next);
  };

  const drag = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      transforming.value = true;
      startX.value = x.value;
      startY.value = y.value;
      runOnJS(selectSelf)();
    })
    .onUpdate((event) => {
      if (pageW.value < 8 || pageH.value < 8) return;
      const maxX = Math.max(0, 100 - width.value);
      const maxY = Math.max(0, 100 - height.value);
      const nextX = clamp(startX.value + (event.translationX / pageW.value) * 100, 0, maxX);
      const nextY = clamp(startY.value + (event.translationY / pageH.value) * 100, 0, maxY);
      x.value = finiteOr(nextX, x.value);
      y.value = finiteOr(nextY, y.value);
    })
    .onEnd(() => {
      transforming.value = false;
      runOnJS(commitLayout)({ x: x.value, y: y.value });
    })
    .onFinalize(() => {
      transforming.value = false;
    });

  const resize = Gesture.Pan()
    .onStart(() => {
      transforming.value = true;
      startW.value = width.value;
      startH.value = height.value;
      runOnJS(selectSelf)();
    })
    .onUpdate((event) => {
      if (pageW.value < 8 || pageH.value < 8) return;
      const nextW = clamp(startW.value + (event.translationX / pageW.value) * 100, 10, 96);
      const nextH = clamp(startH.value + (event.translationY / pageH.value) * 100, 10, 92);
      width.value = finiteOr(nextW, width.value);
      height.value = finiteOr(nextH, height.value);
    })
    .onEnd(() => {
      transforming.value = false;
      runOnJS(commitLayout)({ width: width.value, height: height.value });
    })
    .onFinalize(() => {
      transforming.value = false;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      transforming.value = true;
      startW.value = width.value;
      startH.value = height.value;
      runOnJS(selectSelf)();
    })
    .onUpdate((event) => {
      if (pageW.value < 8 || pageH.value < 8) return;
      const scale = finiteOr(event.scale, 1);
      if (scale <= 0) return;
      width.value = clamp(startW.value * scale, 10, 96);
      height.value = clamp(startH.value * scale, 10, 92);
    })
    .onEnd(() => {
      transforming.value = false;
      runOnJS(commitLayout)({ width: width.value, height: height.value });
    })
    .onFinalize(() => {
      transforming.value = false;
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onSelect)(selected ? null : sketch.id);
  });

  const move = Gesture.Simultaneous(drag, pinch);

  const style = useAnimatedStyle(() => ({
    left: `${x.value}%`,
    top: `${y.value}%`,
    width: `${width.value}%`,
    height: `${height.value}%`,
    transform: [{ rotate: `${rotate.value}deg` }],
    zIndex: selected ? 1000 : (sketch.z ?? 0),
  }));

  return (
    <GestureDetector gesture={move}>
      <Animated.View style={[styles.mark, selected && styles.selected, style]}>
        <GestureDetector gesture={tap}>
          <View style={styles.hit}>
            <Image
              source={{ uri: sketch.uri, width: 512, height: 512 }}
              style={[styles.image, sketch.sketched !== false && styles.imageSketch]}
              contentFit="contain"
              cachePolicy="memory-disk"
              recyclingKey={`${sketch.id}:${sketch.sketched ? 'ink' : 'photo'}`}
              transition={180}
            />
            {sketch.caption ? <Text style={styles.caption} numberOfLines={2}>{sketch.caption}</Text> : null}
          </View>
        </GestureDetector>
        {selected ? (
          <FieldButton
            accessibilityLabel="Remove sketch"
            style={styles.delete}
            onPress={() => onRemove(sketch.id)}>
            <MaterialIcons name="close" size={16} color="#fff" />
          </FieldButton>
        ) : null}
        {selected ? (
          <GestureDetector gesture={resize}>
            <View accessibilityLabel="Resize sketch" style={styles.handle} />
          </GestureDetector>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  mark: {
    position: 'absolute',
    overflow: 'visible',
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
    overflow: 'visible',
  },
  image: {
    width: '100%',
    flex: 1,
    backgroundColor: 'transparent',
  },
  imageSketch: {
    // Soft multiply-like sit on parchment (expo-image has no blend on all platforms).
    opacity: 0.94,
  },
  caption: {
    marginTop: 4,
    color: '#5c4632',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  delete: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: '#7a1c12',
    borderWidth: 1,
    borderColor: '#f3e4c4',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
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
