import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { todoRepository } from '../../db/repository';
import { PersonalTodo } from '../../types/todo.types';
import { BrandColors } from '../../constants/theme';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import * as WebBrowser from 'expo-web-browser';
import {
  FileSpreadsheet,
  Share2,
  ExternalLink,
  Plus,
  X,
  Clock,
  CheckCircle,
  ListTodo,
  Download,
} from 'lucide-react-native';

interface SavedLink {
  id: string;
  title: string;
  url: string;
  category: string;
}

export default function ExecutiveSheetsScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || 'u-default';

  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Link Modal
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([
    {
      id: 'link-1',
      title: 'Laporan Rekap Kinerja Q4 (Google Sheets)',
      url: 'https://docs.google.com/spreadsheets',
      category: 'Keuangan & KPI',
    },
    {
      id: 'link-2',
      title: 'Database Roadmap Produk 2026',
      url: 'https://docs.google.com/spreadsheets',
      category: 'Produk',
    },
  ]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const allTodos = await todoRepository.getAllByUser(userId);
      setTodos(allTodos);
    } catch (e) {
      console.warn('Gagal memuat rekap:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Kalkulasi statistik kerja
  const totalTasks = todos.length;
  const completedTasks = todos.filter((t) => t.isCompleted).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Total estimasi menit kerja
  const totalEstimatedMinutes = useMemo(() => {
    let mins = 0;
    for (const t of todos) {
      if (t.startTime && t.endTime) {
        const [sh, sm] = t.startTime.split(':').map((n) => parseInt(n, 10));
        const [eh, em] = t.endTime.split(':').map((n) => parseInt(n, 10));
        if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
          const diff = eh * 60 + em - (sh * 60 + sm);
          if (diff > 0) mins += diff;
        }
      }
    }
    return mins;
  }, [todos]);

  const totalHoursStr = (totalEstimatedMinutes / 60).toFixed(1);

  // Ekspor ke Spreadsheet & Native Sharing
  const handleExportSpreadsheet = async (format: 'xlsx' | 'csv') => {
    if (todos.length === 0) {
      Alert.alert('Perhatian', 'Belum ada data to-do untuk diekspor.');
      return;
    }

    setIsExporting(true);
    try {
      // 1. Bentuk dataset tabel
      const rows = todos.map((t, idx) => ({
        No: idx + 1,
        'Tanggal Target': t.targetDate,
        'Judul To-Do': t.title,
        Kategori: t.category,
        Prioritas: t.priority,
        'Jam Mulai': t.startTime || '-',
        'Jam Selesai': t.endTime || '-',
        Status: t.isCompleted ? 'SELESAI' : 'PENDING',
        Deskripsi: t.description || '-',
        Subtasks: t.subtasks?.map((s) => `[${s.isCompleted ? 'v' : ' '}] ${s.title}`).join('; ') || '-',
      }));

      // 2. Buat Workbook dengan SheetJS
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Aktivitas');

      const fileName = `Rekap_ACME_${new Date().toISOString().split('T')[0]}.${format}`;

      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, fileName);
        Alert.alert('Berhasil', `File ${fileName} berhasil diunduh.`);
      } else {
        // Platform Mobile Native (iOS / Android)
        const wbout = XLSX.write(wb, {
          type: 'base64',
          bookType: format === 'xlsx' ? 'xlsx' : 'csv',
        });
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType:
              format === 'xlsx'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv',
            dialogTitle: 'Bagikan Rekap Spreadsheet ACME',
          });
        } else {
          Alert.alert('Sukses', `File tersimpan di: ${fileUri}`);
        }
      }
    } catch (err: unknown) {
      console.warn('Gagal ekspor sheet:', err);
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat menyusun spreadsheet';
      Alert.alert('Gagal Ekspor', msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenLink = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Error', 'Gagal membuka browser');
    }
  };

  const handleAddLink = () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    const newL: SavedLink = {
      id: 'link-' + Date.now().toString(36),
      title: linkTitle.trim(),
      url: linkUrl.trim().startsWith('http') ? linkUrl.trim() : 'https://' + linkUrl.trim(),
      category: 'Spreadsheet',
    };
    setSavedLinks([...savedLinks, newL]);
    setLinkTitle('');
    setLinkUrl('');
    setIsLinkModalOpen(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Header Ringkasan Produktivitas */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Rekapitulasi Jam Kerja</Text>
        <Text style={styles.summarySubtitle}>
          Akumulasi waktu dan progres aktivitas dari seluruh catatan to-do Anda
        </Text>

        <View style={styles.metricGrid}>
          <View style={styles.metricItem}>
            <View style={[styles.metricIcon, { backgroundColor: '#EEF2FF' }]}>
              <ListTodo size={18} color={BrandColors.primary} />
            </View>
            <Text style={styles.metricValue}>{totalTasks}</Text>
            <Text style={styles.metricLabel}>Total Tugas</Text>
          </View>

          <View style={styles.metricItem}>
            <View style={[styles.metricIcon, { backgroundColor: '#E8FAF5' }]}>
              <CheckCircle size={18} color="#10B981" />
            </View>
            <Text style={styles.metricValue}>{completedTasks}</Text>
            <Text style={styles.metricLabel}>Tugas Selesai</Text>
          </View>

          <View style={styles.metricItem}>
            <View style={[styles.metricIcon, { backgroundColor: '#FFF8E1' }]}>
              <Clock size={18} color="#D97706" />
            </View>
            <Text style={styles.metricValue}>{totalHoursStr} Jam</Text>
            <Text style={styles.metricLabel}>Waktu Terjadwal</Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Tingkat Penyelesaian:</Text>
          <Text style={styles.progressPercent}>{completionRate}%</Text>
        </View>
      </View>

      {/* 2. Action Ekspor Spreadsheet */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Ekspor Rekapitulasi</Text>
      </View>

      <View style={styles.exportCard}>
        <View style={styles.exportInfo}>
          <FileSpreadsheet size={32} color={BrandColors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.exportCardTitle}>Konversi Rekap ke File</Text>
            <Text style={styles.exportCardSubtitle}>
              Ekspor seluruh data to-do, subtask, dan jam kerja langsung ke Excel atau CSV.
            </Text>
          </View>
        </View>

        <View style={styles.exportButtonsRow}>
          <TouchableOpacity
            style={[styles.exportBtn, isExporting && styles.btnDisabled]}
            onPress={() => handleExportSpreadsheet('xlsx')}
            disabled={isExporting}
          >
            <Download size={16} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Ekspor Excel (.xlsx)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtnSecondary, isExporting && styles.btnDisabled]}
            onPress={() => handleExportSpreadsheet('csv')}
            disabled={isExporting}
          >
            <Share2 size={16} color={BrandColors.primary} />
            <Text style={styles.exportBtnSecondaryText}>Ekspor CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Tautan Spreadsheet Tersimpan */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Tautan Spreadsheet Tersimpan</Text>
        <TouchableOpacity
          style={styles.addLinkBtn}
          onPress={() => setIsLinkModalOpen(true)}
        >
          <Plus size={16} color={BrandColors.primary} />
          <Text style={styles.addLinkBtnText}>Tambah Link</Text>
        </TouchableOpacity>
      </View>

      {savedLinks.map((link) => (
        <TouchableOpacity
          key={link.id}
          style={styles.linkCard}
          onPress={() => handleOpenLink(link.url)}
          activeOpacity={0.7}
        >
          <View style={styles.linkLeft}>
            <View style={styles.linkIconBadge}>
              <FileSpreadsheet size={20} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkCardTitle}>{link.title}</Text>
              <Text style={styles.linkCardCategory}>{link.category}</Text>
            </View>
          </View>
          <ExternalLink size={16} color="#94A3B8" />
        </TouchableOpacity>
      ))}

      {/* Modal Tambah Link */}
      <Modal visible={isLinkModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Tautan Spreadsheet</Text>
              <TouchableOpacity onPress={() => setIsLinkModalOpen(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>Judul Spreadsheet</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: Laporan Penjualan 2026"
                  placeholderTextColor="#94A3B8"
                  value={linkTitle}
                  onChangeText={setLinkTitle}
                />
              </View>

              <View style={styles.inputField}>
                <Text style={styles.inputLabel}>URL / Tautan Dokumen</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://docs.google.com/spreadsheets/..."
                  placeholderTextColor="#94A3B8"
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.saveLinkBtn,
                  (!linkTitle.trim() || !linkUrl.trim()) && styles.btnDisabled,
                ]}
                onPress={handleAddLink}
                disabled={!linkTitle.trim() || !linkUrl.trim()}
              >
                <Text style={styles.saveLinkBtnText}>Simpan Tautan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 90,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 16,
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  exportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  exportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  exportCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  exportCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: BrandColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  exportBtnSecondary: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BrandColors.periwinkle,
  },
  exportBtnSecondaryText: {
    color: BrandColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  addLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addLinkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  linkIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8FAF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  linkCardCategory: {
    fontSize: 11,
    color: '#64748B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBody: {
    gap: 14,
  },
  inputField: {},
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  saveLinkBtn: {
    backgroundColor: BrandColors.primary,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveLinkBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
