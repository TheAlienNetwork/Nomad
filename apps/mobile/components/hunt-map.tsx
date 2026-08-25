import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { buildHuntMapHtml } from '@/lib/hunt-map-html';

const html = buildHuntMapHtml();

export function HuntMap() {
  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html, baseUrl: 'https://unpkg.com/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        style={styles.map}
      />
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
  map: {
    flex: 1,
    backgroundColor: '#050505',
  },
});
