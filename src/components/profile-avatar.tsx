import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { TodoColors } from '../constants/theme';

interface ProfileAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
}

/** Inisial dari nama: huruf pertama kata pertama dan kata terakhir. */
export function initialsFromName(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Foto profil bulat.
 *
 * Bila belum ada foto, tampil inisial di atas latar aksen — bukan ikon generik,
 * supaya pengguna tetap bisa membedakan akun hanya dari avatar.
 */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ name, avatarUrl, size = 32 }) => {
  const radius = size / 2;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        accessibilityLabel={`Foto profil ${name ?? ''}`.trim()}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>
        {initialsFromName(name)}
      </Text>
    </View>
  );
};

interface AvatarButtonProps extends ProfileAvatarProps {
  onPress: () => void;
}

/** Avatar sebagai tombol header, dengan area sentuh yang lebih besar dari ikonnya. */
export const AvatarButton: React.FC<AvatarButtonProps> = ({ onPress, ...props }) => (
  <Pressable
    onPress={onPress}
    hitSlop={8}
    style={styles.button}
    accessibilityRole="button"
    accessibilityLabel="Buka profil"
  >
    <ProfileAvatar {...props} />
  </Pressable>
);

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TodoColors.accent,
  },
  fallbackText: {
    fontWeight: '800',
    color: TodoColors.surface,
    letterSpacing: 0.3,
  },
  button: {
    padding: 4,
  },
});
