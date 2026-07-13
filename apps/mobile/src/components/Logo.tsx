import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/theme';

const logoBlue = require('../../assets/logo-blue.png');
const logoWhite = require('../../assets/logo-white.png');

interface LogoProps {
  size?: number;
  variant?: 'blue' | 'white';
  showText?: boolean;
}

export function Logo({ size = 36, variant = 'blue', showText = false }: LogoProps) {
  const source = variant === 'white' ? logoWhite : logoBlue;
  const textColor = variant === 'white' ? Colors.white : Colors.primary;

  return (
    <View style={styles.row}>
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
      {showText && (
        <Text style={[styles.text, { color: textColor, fontSize: size * 0.55 }]}>
          DIRECTO
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
