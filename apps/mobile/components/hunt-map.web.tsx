import { StyleSheet, View } from 'react-native';

import { buildHuntMapHtml } from '@/lib/hunt-map-html';

const html = buildHuntMapHtml();

export function HuntMap() {
  return (
    <View style={styles.wrap}>
      <iframe title="Nomad hunt map" srcDoc={html} style={styles.frame} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 420,
    overflow: 'hidden',
    backgroundColor: '#050505',
  },
  frame: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: '#050505',
  },
});
