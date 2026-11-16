import { router, Tabs } from 'expo-router';
import { TodoColors } from '../../constants/theme';
import { AppHeaderTitle } from '../../components/app-header-title';
import { AvatarButton } from '../../components/profile-avatar';
import { CheckSquare, Calendar, BookOpen, Table2 } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '../../store/auth.store';

export default function ExecutiveTabsLayout() {
  const user = useAuthStore((s) => s.user);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        // Warna pembeda: header memakai aksen lembut, isi halaman tetap terang.
        headerStyle: { backgroundColor: TodoColors.accentSoft },
        headerTitleStyle: { fontWeight: '700', fontSize: 15, color: TodoColors.title },
        headerTintColor: TodoColors.accent,
        headerShadowVisible: false,
        headerRightContainerStyle: { paddingRight: 4 },
        // Avatar profil menggantikan tombol keluar: pengaturan akun dan log out
        // sekarang tinggal di satu tempat, bukan tersebar di header.
        headerRight: () => (
          <View style={styles.headerRight}>
            <AvatarButton
              name={user?.name}
              avatarUrl={user?.avatarUrl}
              onPress={() => router.push('/profile')}
            />
          </View>
        ),
        tabBarActiveTintColor: TodoColors.accent,
        tabBarInactiveTintColor: TodoColors.faint,
        tabBarStyle: {
          backgroundColor: TodoColors.surface,
          borderTopColor: TodoColors.border,
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
          title: 'Tasks',
          headerTitle: () => <AppHeaderTitle title="Tasks" userName={user?.name} role={user?.role} />,
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Jadwal',
          headerTitle: () => <AppHeaderTitle title="Jadwal" userName={user?.name} role={user?.role} />,
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Catatan',
          headerTitle: () => <AppHeaderTitle title="Catatan" userName={user?.name} role={user?.role} />,
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sheets"
        options={{
          title: 'Sheets',
          headerTitle: () => <AppHeaderTitle title="Spreadsheet" userName={user?.name} role={user?.role} />,
          tabBarIcon: ({ color, size }) => <Table2 size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
  },
});
