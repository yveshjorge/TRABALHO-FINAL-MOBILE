import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { theme } from '../theme';

/**
 * Keeps the same mobile-first app surface in native builds and in desktop browsers.
 * On a phone-sized browser it fills the viewport; on a wide screen it is centered
 * in a narrow, device-like frame.
 */
export function AppViewport({ children }: PropsWithChildren) {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideWeb = isWeb && width > 520;

  return (
    <View style={isWeb ? [styles.webStage, { minHeight: height }] : styles.nativeStage}>
      <View style={[styles.appSurface, isWeb && styles.webSurface, isWideWeb && styles.wideWebSurface]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeStage: { flex: 1 },
  webStage: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EEEC',
  },
  appSurface: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.color.paper,
  },
  webSurface: {
    maxWidth: 460,
    maxHeight: 920,
    overflow: 'hidden',
    borderRadius: 0,
  },
  wideWebSurface: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.color.line,
    shadowColor: '#102A24',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
});
