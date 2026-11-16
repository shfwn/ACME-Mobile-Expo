import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  KeyRound,
  ListTodo,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useAuthStore } from '../store/auth.store';
import { accountRepository } from '../db/account.repository';
import { todoRepository } from '../db/repository';
import { BrandColors, TodoColors } from '../constants/theme';
import { ProfileAvatar } from '../components/profile-avatar';
import { formatDayMonthYear, toIsoDate } from '../components/date-picker-sheet';
import type { Role } from '../types/auth.types';

const ROLE_LABEL: Readonly<Record<Role, string>> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
  MILT: 'Executive',
};

type Section = 'name' | 'email' | 'password' | null;

/** Periode ringkasan kerja. Default pekan berjalan. */
type Period = 'week' | 'month';

interface WorkSummary {
  total: number;
  completed: number;
  scheduledMinutes: number;
  /** Rentang inklusif yang dipakai, untuk label di bawah kartu. */
  rangeLabel: string;
}

/**
 * Rentang tanggal lokal untuk periode terpilih.
 *
 * Pekan dihitung Senin–Minggu (bukan 7 hari terakhir) supaya angkanya cocok
 * dengan cara orang membaca kalender, dan bulan mengambil tanggal 1..akhir bulan.
 */
function periodRange(period: Period, now: Date = new Date()): { from: string; to: string } {
  if (period === 'week') {
    const monday = new Date(now);
    const offset = (now.getDay() + 6) % 7; // 0 = Senin
    monday.setDate(now.getDate() - offset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toIsoDate(monday), to: toIsoDate(sunday) };
  }

  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toIsoDate(first), to: toIsoDate(last) };
}

/** Label rentang untuk ditampilkan: "17–23 Nov 2026" atau "1–30 Nov 2026". */
function rangeLabel(fromIso: string, toIso: string): string {
  return `${fromIso.slice(8, 10)}–${formatDayMonthYear(toIso)}`;
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const logout = useAuthStore((s) => s.logout);

  const [period, setPeriod] = useState<Period>('week');
  const [summary, setSummary] = useState<WorkSummary>({
    total: 0,
    completed: 0,
    scheduledMinutes: 0,
    rangeLabel: '',
  });
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);

  const [openSection, setOpenSection] = useState<Section>(null);
  const [nameDraft, setNameDraft] = useState<string>('');
  const [emailDraft, setEmailDraft] = useState<string>('');
  const [passwordDraft, setPasswordDraft] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [confirmDraft, setConfirmDraft] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const loadSummary = useCallback(async (): Promise<WorkSummary | null> => {
    if (!user) return null;
    const { from, to } = periodRange(period);
    try {
      const todos = (await todoRepository.getAllByUser(user.id)).filter(
        (t) => t.targetDate >= from && t.targetDate <= to
      );
      let minutes = 0;
      for (const t of todos) {
        if (!t.startTime || !t.endTime) continue;
        const [sh, sm] = t.startTime.split(':').map((n) => parseInt(n, 10));
        const [eh, em] = t.endTime.split(':').map((n) => parseInt(n, 10));
        if ([sh, sm, eh, em].some(Number.isNaN)) continue;
        const diff = eh * 60 + em - (sh * 60 + sm);
        if (diff > 0) minutes += diff;
      }
      return {
        total: todos.length,
        completed: todos.filter((t) => t.isCompleted).length,
        scheduledMinutes: minutes,
        rangeLabel: rangeLabel(from, to),
      };
    } catch (e) {
      console.warn('Gagal memuat ringkasan kerja:', e);
      return null;
    }
  }, [period, user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadSummary().then((result) => {
        if (!active) return;
        if (result) setSummary(result);
        setIsLoadingSummary(false);
      });
      return () => {
        active = false;
      };
    }, [loadSummary, setIsLoadingSummary, setSummary])
  );

  const completionRate = useMemo(
    () => (summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0),
    [summary]
  );

  const resetForm = () => {
    setFormError(null);
    setPasswordDraft('');
    setPasswordConfirm('');
    setConfirmDraft('');
    setIsSaving(false);
  };

  const toggleSection = (section: Section) => {
    resetForm();
    if (openSection === section) {
      setOpenSection(null);
      return;
    }
    setNameDraft(user?.name ?? '');
    setEmailDraft(user?.email ?? '');
    setOpenSection(section);
  };

  /** Konfirmasi kata sandi: gerbang sebelum email/username/kata sandi diubah. */
  const requirePassword = (): boolean => {
    if (confirmDraft.trim().length === 0) {
      setFormError('Masukkan kata sandi saat ini untuk menyimpan perubahan');
      return false;
    }
    return true;
  };

  const saveName = async () => {
    if (!user) return;
    if (!requirePassword()) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const ok = await accountRepository.confirmPassword(user.id, confirmDraft);
      if (!ok) {
        setFormError('Kata sandi saat ini salah');
        setIsSaving(false);
        return;
      }
      const result = await accountRepository.updateProfile(user.id, { name: nameDraft });
      if (!result.success) {
        setFormError(result.error);
        setIsSaving(false);
        return;
      }
      await refreshUser();
      setOpenSection(null);
      resetForm();
      Alert.alert('Sukses', 'Username berhasil diperbarui.');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Gagal menyimpan nama');
      setIsSaving(false);
    }
  };

  const saveEmail = async () => {
    if (!user) return;
    if (!requirePassword()) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const ok = await accountRepository.confirmPassword(user.id, confirmDraft);
      if (!ok) {
        setFormError('Kata sandi saat ini salah');
        setIsSaving(false);
        return;
      }
      const result = await accountRepository.updateProfile(user.id, { email: emailDraft });
      if (!result.success) {
        setFormError(result.error);
        setIsSaving(false);
        return;
      }
      await refreshUser();
      setOpenSection(null);
      resetForm();
      Alert.alert('Sukses', 'Email berhasil diperbarui.');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Gagal menyimpan email');
      setIsSaving(false);
    }
  };

  const savePassword = async () => {
    if (!user) return;
    if (!requirePassword()) return;
    if (passwordDraft.length < 8) {
      setFormError('Kata sandi baru minimal 8 karakter');
      return;
    }
    if (passwordDraft !== passwordConfirm) {
      setFormError('Konfirmasi kata sandi baru tidak sama');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const ok = await accountRepository.confirmPassword(user.id, confirmDraft);
      if (!ok) {
        setFormError('Kata sandi saat ini salah');
        setIsSaving(false);
        return;
      }
      await accountRepository.changePassword(user.id, passwordDraft);
      setOpenSection(null);
      resetForm();
      Alert.alert('Sukses', 'Kata sandi berhasil diperbarui.');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Gagal mengganti kata sandi');
      setIsSaving(false);
    }
  };

  const pickAvatar = () => {
    Alert.alert(
      'Foto Profil',
      'Nama dan inisial Anda dipakai sebagai avatar. Unggah foto membutuhkan akses galeri dan penyimpanan berkas.',
      [{ text: 'Mengerti' }]
    );
  };

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

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
      </View>
    );
  }

  const hours = (summary.scheduledMinutes / 60).toFixed(1);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* 1. Identitas Pengguna */}
        <View style={styles.identityCard}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={pickAvatar}
            accessibilityLabel="Atur foto profil"
            activeOpacity={0.8}
          >
            <ProfileAvatar name={user.name} avatarUrl={user.avatarUrl} size={76} />
            <View style={styles.avatarBadge}>
              <Camera size={13} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>

          <Text style={styles.identityName}>{user.name}</Text>
          <Text style={styles.identityEmail}>{user.email}</Text>
          <View style={styles.rolePill}>
            <ShieldCheck size={12} color={TodoColors.accent} />
            <Text style={styles.rolePillText}>{ROLE_LABEL[user.role]}</Text>
          </View>
        </View>

        {/* 2. Ringkasan Kerja (Pertama setelah identitas) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Ringkasan Kerja</Text>
          <View style={styles.periodToggle}>
            {(['week', 'month'] as const).map((option) => {
              const isActive = period === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.periodBtn, isActive && styles.periodBtnActive]}
                  onPress={() => {
                    setPeriod(option);
                    setIsLoadingSummary(true);
                  }}
                  accessibilityLabel={option === 'week' ? 'Ringkasan per pekan' : 'Ringkasan per bulan'}
                >
                  <Text style={[styles.periodText, isActive && styles.periodTextActive]}>
                    {option === 'week' ? 'Pekan' : 'Bulan'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.summaryCard}>
          {isLoadingSummary ? (
            <View style={styles.summaryLoading}>
              <ActivityIndicator size="small" color={BrandColors.primary} />
            </View>
          ) : (
            <>
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <View style={[styles.metricIconBox, { backgroundColor: TodoColors.accentSoft }]}>
                    <ListTodo size={16} color={TodoColors.accent} />
                  </View>
                  <Text style={styles.metricValue}>{summary.total}</Text>
                  <Text style={styles.metricLabel}>Total tugas</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metric}>
                  <View style={[styles.metricIconBox, { backgroundColor: '#E7F5EF' }]}>
                    <Check size={16} color="#10B981" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{summary.completed}</Text>
                  <Text style={styles.metricLabel}>Selesai</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metric}>
                  <View style={[styles.metricIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Clock3 size={16} color="#D97706" />
                  </View>
                  <Text style={styles.metricValue}>{hours}j</Text>
                  <Text style={styles.metricLabel}>Terjadwal</Text>
                </View>
              </View>

              {summary.rangeLabel ? (
                <Text style={styles.summaryRange}>{summary.rangeLabel}</Text>
              ) : null}

              {/* Progress Bar Penyelesaian */}
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Tingkat Penyelesaian</Text>
                  <Text style={styles.progressPercentText}>{completionRate}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${completionRate}%`,
                        backgroundColor: completionRate === 100 ? '#10B981' : BrandColors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            </>
          )}
        </View>

        {/* 3. Pengaturan Akun (Kedua setelah ringkasan) */}
        <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>Pengaturan Akun</Text>

        <View style={styles.settingsCard}>
          {/* Username */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => toggleSection('name')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <UserRound size={17} color={TodoColors.accent} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Username</Text>
              <Text style={styles.settingValue}>{user.name}</Text>
            </View>
            {openSection === 'name' ? (
              <ChevronDown size={18} color={TodoColors.accent} />
            ) : (
              <ChevronRight size={18} color={TodoColors.faint} />
            )}
          </TouchableOpacity>

          {openSection === 'name' ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Nama tampilan"
                placeholderTextColor={TodoColors.faint}
                value={nameDraft}
                onChangeText={setNameDraft}
              />
              <PasswordConfirm value={confirmDraft} onChange={setConfirmDraft} />
              {formError ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={14} color={TodoColors.danger} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}
              <SaveRow onSave={saveName} onCancel={() => toggleSection(null)} saving={isSaving} />
            </View>
          ) : null}

          {/* Email */}
          <TouchableOpacity
            style={[styles.settingRow, styles.settingRowDivider]}
            onPress={() => toggleSection('email')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <Mail size={17} color={TodoColors.accent} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Email</Text>
              <Text style={styles.settingValue}>{user.email}</Text>
            </View>
            {openSection === 'email' ? (
              <ChevronDown size={18} color={TodoColors.accent} />
            ) : (
              <ChevronRight size={18} color={TodoColors.faint} />
            )}
          </TouchableOpacity>

          {openSection === 'email' ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="nama@perusahaan.com"
                placeholderTextColor={TodoColors.faint}
                value={emailDraft}
                onChangeText={setEmailDraft}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <PasswordConfirm value={confirmDraft} onChange={setConfirmDraft} />
              {formError ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={14} color={TodoColors.danger} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}
              <SaveRow onSave={saveEmail} onCancel={() => toggleSection(null)} saving={isSaving} />
            </View>
          ) : null}

          {/* Kata Sandi */}
          <TouchableOpacity
            style={[styles.settingRow, styles.settingRowDivider]}
            onPress={() => toggleSection('password')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <KeyRound size={17} color={TodoColors.accent} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Kata Sandi</Text>
              <Text style={styles.settingValue}>••••••••</Text>
            </View>
            {openSection === 'password' ? (
              <ChevronDown size={18} color={TodoColors.accent} />
            ) : (
              <ChevronRight size={18} color={TodoColors.faint} />
            )}
          </TouchableOpacity>

          {openSection === 'password' ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Kata sandi baru"
                placeholderTextColor={TodoColors.faint}
                value={passwordDraft}
                onChangeText={setPasswordDraft}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="Ulangi kata sandi baru"
                placeholderTextColor={TodoColors.faint}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                secureTextEntry
              />
              <PasswordConfirm value={confirmDraft} onChange={setConfirmDraft} label="Kata sandi saat ini" />
              {formError ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={14} color={TodoColors.danger} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}
              <SaveRow onSave={savePassword} onCancel={() => toggleSection(null)} saving={isSaving} />
            </View>
          ) : null}
        </View>

        {/* 4. Keluar Akun */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
          accessibilityLabel="Keluar dari akun"
        >
          <LogOut size={16} color={TodoColors.danger} />
          <Text style={styles.logoutText}>Keluar Akun</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Field konfirmasi kata sandi yang dipakai ketiga form. */
const PasswordConfirm: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label?: string;
}> = ({ value, onChange, label = 'Konfirmasi kata sandi saat ini' }) => (
  <TextInput
    style={styles.input}
    placeholder={label}
    placeholderTextColor={TodoColors.faint}
    value={value}
    onChangeText={onChange}
    secureTextEntry
    autoCapitalize="none"
  />
);

const SaveRow: React.FC<{ onSave: () => void; onCancel: () => void; saving: boolean }> = ({
  onSave,
  onCancel,
  saving,
}) => (
  <View style={styles.saveRow}>
    <TouchableOpacity
      style={styles.cancelBtn}
      onPress={onCancel}
      disabled={saving}
      activeOpacity={0.7}
    >
      <Text style={styles.cancelText}>Batal</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
      onPress={onSave}
      disabled={saving}
      activeOpacity={0.7}
    >
      <Text style={styles.saveText}>{saving ? 'Menyimpan...' : 'Simpan'}</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  identityCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  identityName: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: TodoColors.title,
  },
  identityEmail: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: TodoColors.muted,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: TodoColors.accentSoft,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: TodoColors.accent,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: TodoColors.muted,
  },
  sectionTitleSpacing: {
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  periodToggle: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  periodBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  periodText: {
    fontSize: 11,
    fontWeight: '700',
    color: TodoColors.muted,
  },
  periodTextActive: {
    color: TodoColors.accent,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  summaryLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F1F5F9',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: TodoColors.title,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TodoColors.muted,
    marginTop: 2,
  },
  summaryRange: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: '500',
    color: TodoColors.faint,
    textAlign: 'center',
  },
  progressSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TodoColors.muted,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '800',
    color: TodoColors.accent,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: 7,
    borderRadius: 4,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  settingRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TodoColors.accentSoft,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TodoColors.muted,
  },
  settingValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TodoColors.title,
    marginTop: 1,
  },
  form: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    backgroundColor: '#F8FAFC',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: TodoColors.title,
    backgroundColor: '#FFFFFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TodoColors.danger,
    flex: 1,
  },
  saveRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: TodoColors.muted,
  },
  saveBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  logoutText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: TodoColors.danger,
  },
});
