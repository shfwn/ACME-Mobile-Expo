import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TodoColors } from '../constants/theme';

interface AppHeaderTitleProps {
  title: string;
  userName?: string | null;
  role?: string | null;
}

const ROLE_LABEL: Readonly<Record<string, string>> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
  MILT: 'Executive',
};

/**
 * Judul header dua baris: nama halaman di atas, identitas pengguna di bawah.
 * Dipakai di seluruh app agar setiap halaman punya penanda yang sama.
 */
export const AppHeaderTitle: React.FC<AppHeaderTitleProps> = ({ title, userName, role }) => {
  const initial = (userName ?? '?').trim().charAt(0).toUpperCase();
  const roleLabel = role ? ROLE_LABEL[role] ?? role : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {userName ? (
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.identity} numberOfLines={1}>
            {userName}
            {roleLabel ? <Text style={styles.role}> · {roleLabel}</Text> : null}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: TodoColors.title,
    letterSpacing: 0.1,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  avatar: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: TodoColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '800',
    color: TodoColors.surface,
  },
  identity: {
    fontSize: 11,
    fontWeight: '600',
    color: TodoColors.muted,
  },
  role: {
    fontSize: 11,
    fontWeight: '500',
    color: TodoColors.faint,
  },
});
