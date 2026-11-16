import { router, Tabs } from 'expo-router';
import { BrandColors } from '../../constants/theme';
import { CheckSquare, LayoutDashboard, Bell, LogOut, Users2 } from 'lucide-react-native';
import { TouchableOpacity, Alert, View } from 'react-native';
import { useAuthStore } from '../../store/auth.store';

export default function TeamTabsLayout() {
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
        name="my-tasks"
        options={{
          title: 'Tugas Saya',
          headerTitle: `Tugas Saya • ${user?.name ?? 'Member'}`,
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Proyek',
          headerTitle: 'Papan Proyek Tim',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workload"
        options={{
          title: 'Beban Kerja',
          headerTitle: 'Peta Kapasitas Tim',
          tabBarIcon: ({ color, size }) => <Users2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifikasi',
          headerTitle: 'Notifikasi & Aktivitas',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
