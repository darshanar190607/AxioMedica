import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import BottomNav from '../components/BottomNav';
import { COLORS } from '../data/theme';
import DashboardScreen      from '../screens/DashboardScreen';
import ExerciseDetailScreen from '../screens/ExerciseDetailScreen';
import LandingScreen        from '../screens/LandingScreen';
import LiveMonitorScreen    from '../screens/LiveMonitorScreen';
import LoginScreen          from '../screens/LoginScreen';
import MyPlanScreen         from '../screens/MyPlanScreen';
import ProfileScreen        from '../screens/ProfileScreen';
import ProgressScreen       from '../screens/ProgressScreen';
import SessionResultsScreen from '../screens/SessionResultsScreen';

const Stack = createStackNavigator();

function MainTabs({ navigation }) {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const screenProps = { navigation };

  const renderTab = () => {
    switch (activeTab) {
      case 'Dashboard': return <DashboardScreen {...screenProps} />;
      case 'MyPlan':    return <MyPlanScreen    {...screenProps} />;
      case 'Progress':  return <ProgressScreen  {...screenProps} />;
      case 'Profile':   return <ProfileScreen   {...screenProps} />;
      default:          return <DashboardScreen {...screenProps} />;
    }
  };

  return (
    <View style={styles.layout}>
      <View style={styles.content}>{renderTab()}</View>
      <BottomNav active={activeTab} onPress={setActiveTab} />
    </View>
  );
}

const linking = {
  prefixes: [],
  config: { screens: {} },
};

export default function AppNavigator() {
  return (
    <View style={styles.navRoot}>
      <NavigationContainer
        linking={linking}
        documentTitle={{ formatter: () => 'RehabStep AI' }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Landing">
          <Stack.Screen name="Landing"        component={LandingScreen} />
          <Stack.Screen name="Login"          component={LoginScreen} />
          <Stack.Screen name="Main"           component={MainTabs} />
          <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
          <Stack.Screen name="LiveMonitor"    component={LiveMonitorScreen} />
          <Stack.Screen name="SessionResults" component={SessionResultsScreen} />
          <Stack.Screen name="MyPlan"         component={MyPlanScreen} />
          <Stack.Screen name="Progress"       component={ProgressScreen} />
          <Stack.Screen name="Dashboard"      component={DashboardScreen} />
          <Stack.Screen name="Profile"        component={ProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  navRoot: { flex: 1 },
  layout:  { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },
});
