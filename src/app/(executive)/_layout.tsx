import { Tabs } from 'expo-router';
import { BrandColors } from '../../constants/theme';
import { CheckSquare, Calendar, BookOpen, Table2, LogOut } from 'lucide-react-native';
import { TouchableOpacity, Alert, View } from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { router } from 'expo-router';
import { SyncIndicator } from '../../components/sync-indicator';

export default function ExecutiveTabsLayout() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const handleLogout = () => {
    Alert.alert('Keluar Akun', 'Apakah Anda yakin ingin keluar dari workspace?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontWeight: '700', fontSize: 16, color: '#0F172A' },
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 16 }}>
            <SyncIndicator />
            <TouchableOpacity
              onPress={handleLogout}
              style={{ padding: 4 }}
              accessibilityLabel="Keluar"
            >
              <LogOut size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        ),
        tabBarActiveTintColor: BrandColors.primary,
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="todos"
        options={{
          title: 'To-Do Harian',
          headerTitle: `To-Do • ${user?.name ?? 'Executive'}`,
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Jadwal',
          headerTitle: 'Jadwal & Kalender',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Catatan',
          headerTitle: 'Catatan Harian',
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sheets"
        options={{
          title: 'Sheets',
          headerTitle: 'Spreadsheet Hub',
          tabBarIcon: ({ color, size }) => <Table2 size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
