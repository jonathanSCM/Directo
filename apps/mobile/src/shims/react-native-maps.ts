/**
 * Web shim for react-native-maps.
 * Renders a gray placeholder box instead of an interactive map on web.
 */
import React from 'react';
import { Text, View } from 'react-native';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type LatLng = {
  latitude: number;
  longitude: number;
};

const MapView = React.forwardRef(function MapView(
  { children, style }: any,
  _ref: any,
) {
  return React.createElement(
    View,
    {
      style: [
        {
          backgroundColor: '#E5E7EB',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        },
        style,
      ],
    },
    React.createElement(
      Text,
      { style: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' } },
      '🗺️  Mapa no disponible en web',
    ),
  );
});

export function Marker(_props: any) {
  return null;
}

export function Circle(_props: any) {
  return null;
}

export function Callout({ children }: any) {
  return children ?? null;
}

export default MapView;
