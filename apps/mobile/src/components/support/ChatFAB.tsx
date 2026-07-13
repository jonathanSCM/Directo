import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/theme';
import ChatScreen from './ChatScreen';

interface ChatFABProps {
  propertyId?: string;
  propertyTitle?: string;
}

export default function ChatFAB({ propertyId, propertyTitle }: ChatFABProps) {
  const [chatVisible, setChatVisible] = useState(false);
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setChatVisible(true);
  };

  return (
    <>
      <Animated.View style={[styles.fabContainer, { transform: [{ scale }] }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color={Colors.white} />
        </TouchableOpacity>
      </Animated.View>

      <ChatScreen
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        propertyId={propertyId}
        propertyTitle={propertyTitle}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    zIndex: 999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
