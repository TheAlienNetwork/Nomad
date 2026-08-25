import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.tint,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#050505',
          borderTopColor: Colors.dark.border,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hunt',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="terrain" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="map" color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="menu-book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="gear"
        options={{
          title: 'Gear',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="inventory-2" color={color} />,
        }}
      />
    </Tabs>
  );
}
