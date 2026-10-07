import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

const PHONE_W = 390;
const PHONE_H = 844;

export default function App() {
  if (Platform.OS !== 'web') {
    return <AppNavigator />;
  }

  return (
    <View style={styles.desktop}>
      <View style={styles.phoneOuter}>
        <View style={styles.dynamicIsland} />
        <View style={styles.screen}>
          <AppNavigator />
        </View>
        <View style={styles.homeBar}>
          <View style={styles.homeIndicator} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktop: {
    flex: 1,
    backgroundColor: '#BDE8A0',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  phoneOuter: {
    width: PHONE_W,
    height: PHONE_H,
    backgroundColor: '#0D0D0D',
    borderRadius: 54,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.45,
    shadowRadius: 64,
    elevation: 40,
    borderWidth: 10,
    borderColor: '#1A1A1A',
  },
  dynamicIsland: {
    position: 'absolute',
    top: 12,
    left: (PHONE_W - 20 - 120) / 2,
    width: 120,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0D0D0D',
    zIndex: 30,
  },
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: '#F7F9F7',
  },
  homeBar: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  homeIndicator: {
    width: 130,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
});
