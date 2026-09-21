import { StyleSheet, View, type DimensionValue } from 'react-native';

type Ring = {
  top: DimensionValue;
  left: DimensionValue;
  width: DimensionValue;
  height: DimensionValue;
  rotate: string;
  index?: boolean;
};

function pct(value: number): DimensionValue {
  return `${value}%` as `${number}%`;
}

function nest(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotate: number,
  count: number,
): Ring[] {
  return Array.from({ length: count }, (_, step) => {
    const shrink = 1 - (step / Math.max(count - 1, 1)) * 0.74;
    return {
      left: pct(cx - (width * shrink) / 2),
      top: pct(cy - (height * shrink) / 2),
      width: pct(width * shrink),
      height: pct(height * shrink),
      rotate: `${rotate}deg`,
      index: step % 3 === 2,
    };
  });
}

const RINGS: Ring[] = [
  ...nest(26, 20, 86, 52, -18, 8),
  ...nest(78, 36, 58, 68, 22, 7),
  ...nest(18, 72, 74, 46, -9, 7),
  ...nest(74, 84, 56, 40, 11, 6),
  ...nest(48, 54, 42, 28, -4, 5),
];

export function SheetTopo() {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {RINGS.map((ring, index) => (
        <View
          key={`${ring.left}-${ring.top}-${index}`}
          style={[
            styles.ring,
            ring.index ? styles.index : null,
            {
              top: ring.top,
              left: ring.left,
              width: ring.width,
              height: ring.height,
              transform: [{ rotate: ring.rotate }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,223,208,0.11)',
  },
  index: {
    borderWidth: 1,
    borderColor: 'rgba(241,90,36,0.16)',
  },
});
