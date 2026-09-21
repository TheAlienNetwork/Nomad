import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { Colors, Nomad } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 400;
  const padBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 10);
  const barHeight = 44 + padBottom;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: Nomad.rust,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarAllowFontScaling: false,
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: {
          fontSize: compact ? 8 : 9,
          fontWeight: '700',
          letterSpacing: compact ? 0.3 : 0.8,
          textTransform: 'uppercase',
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: 'rgba(7,8,6,0.94)',
          borderTopColor: Nomad.line,
          borderTopWidth: 1,
          height: barHeight,
          paddingTop: 4,
          paddingBottom: padBottom,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hunt',
          tabBarIcon: ({ color }) => <MaterialIcons size={compact ? 18 : 20} name="terrain" color={color} />,
        }}
      />
      <Tabs.Screen
        name="memoir"
        options={{
          title: 'Memoir',
          tabBarIcon: ({ color }) => <MaterialIcons size={compact ? 18 : 20} name="menu-book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sky"
        options={{
          title: 'Sky',
          tabBarIcon: ({ color }) => <MaterialIcons size={compact ? 18 : 20} name="cloud" color={color} />,
        }}
      />
      <Tabs.Screen
        name="gear"
        options={{
          title: compact ? 'Kit' : 'Field kit',
          tabBarIcon: ({ color }) => <MaterialIcons size={compact ? 18 : 20} name="inventory-2" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <MaterialIcons size={compact ? 18 : 20} name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}
