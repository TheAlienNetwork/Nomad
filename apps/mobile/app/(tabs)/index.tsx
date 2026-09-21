import { StyleSheet, View } from 'react-native';

import { FieldChrome, useOnlineStatus } from '@/components/field-chrome';
import { HuntMap } from '@/components/hunt-map';
import { useFieldLocation } from '@/src/use-field-location';

export default function HuntScreen() {
  useFieldLocation();
  useOnlineStatus();

  return (
    <View style={styles.screen}>
      <HuntMap />
      <FieldChrome />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#050505',
  },
});
