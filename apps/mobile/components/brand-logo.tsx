import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

const logo = require('@/assets/images/nomad-logo.png');

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({ size = 220, style }: BrandLogoProps) {
  return (
    <Image
      source={logo}
      style={[styles.logo, { width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="Nomad"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: '#000000',
  },
});
