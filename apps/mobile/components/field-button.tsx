import { type CSSProperties, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type FieldButtonProps = {
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  disabled?: boolean;
  glass?: boolean;
};

function toWebStyle(style?: StyleProp<ViewStyle>): CSSProperties {
  const flat = StyleSheet.flatten(style) ?? {};
  const padX = typeof flat.paddingHorizontal === 'number' ? flat.paddingHorizontal : undefined;
  const padY = typeof flat.paddingVertical === 'number' ? flat.paddingVertical : undefined;
  return {
    display: 'flex',
    flexDirection: flat.flexDirection === 'row' ? 'row' : 'column',
    alignItems: flat.alignItems === 'flex-start' ? 'flex-start' : 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundColor: typeof flat.backgroundColor === 'string' ? flat.backgroundColor : 'transparent',
    borderRadius: typeof flat.borderRadius === 'number' ? flat.borderRadius : 0,
    height: typeof flat.height === 'number' || flat.height === '100%' ? flat.height : undefined,
    minHeight: typeof flat.minHeight === 'number' ? flat.minHeight : undefined,
    minWidth: typeof flat.minWidth === 'number' ? flat.minWidth : undefined,
    overflow: typeof flat.overflow === 'string' ? flat.overflow : undefined,
    opacity: typeof flat.opacity === 'number' ? flat.opacity : undefined,
    flex: typeof flat.flex === 'number' ? flat.flex : undefined,
    width: typeof flat.width === 'number' || flat.width === '100%' ? flat.width : undefined,
    gap: typeof flat.gap === 'number' ? flat.gap : undefined,
    paddingLeft: padX,
    paddingRight: padX,
    paddingTop: padY,
    paddingBottom: padY,
    borderWidth: typeof flat.borderWidth === 'number' ? flat.borderWidth : 0,
    borderStyle: 'solid',
    borderColor: typeof flat.borderColor === 'string' ? flat.borderColor : 'transparent',
    boxShadow:
      typeof flat.shadowColor === 'string'
        ? '0 10px 24px rgba(0,0,0,0.35)'
        : undefined,
  };
}

export function FieldButton({
  onPress,
  onPressIn,
  onPressOut,
  children,
  style,
  accessibilityLabel,
  disabled,
  glass,
}: FieldButtonProps) {
  if (Platform.OS === 'web') {
    return (
      <button
        type="button"
        aria-label={accessibilityLabel}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (disabled) return;
          onPress();
        }}
        onMouseDown={() => {
          if (disabled) return;
          onPressIn?.();
        }}
        onMouseUp={() => onPressOut?.()}
        onMouseLeave={() => onPressOut?.()}
        style={{
          ...toWebStyle(style),
          opacity: disabled ? 0.55 : 1,
          ...(glass
            ? {
                backdropFilter: 'blur(22px) saturate(180%)',
                WebkitBackdropFilter: 'blur(22px) saturate(180%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.34), 0 10px 28px rgba(241,90,36,0.16)',
              }
            : {}),
        }}>
        {children}
      </button>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[style, disabled ? { opacity: 0.55 } : null]}>
      {children}
    </Pressable>
  );
}
