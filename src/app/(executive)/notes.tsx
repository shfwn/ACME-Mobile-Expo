import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { useFocusEffect } from 'expo-router';
import { notesRepository } from '../../db/repository';
import { toIsoDate } from '../../components/date-picker-sheet';
import { PersonalNote } from '../../types/todo.types';
import { BrandColors, TodoColors } from '../../constants/theme';
import { Search, Plus, X, Calendar, Trash2, BookOpen, Clock3, ArrowLeft } from 'lucide-react-native';

export default function ExecutiveNotesScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** null = form membuat catatan baru; string = id catatan yang sedang diedit. */
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await notesRepository.getAll(userId);
      setNotes(data);
    } catch (e) {
      console.warn('Gagal memuat catatan:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(q) || note.contentMarkdown.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const handleCreateNote = async () => {
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    const todayIso = toIsoDate(new Date());

    try {
      if (editingNoteId) {
        await notesRepository.update(editingNoteId, {
          title: newTitle.trim(),
          contentMarkdown: newContent.trim(),
        });
      } else {
        await notesRepository.create({
          userId,
          title: newTitle.trim(),
          contentMarkdown: newContent.trim(),
          linkedDate: todayIso,
        });
      }

      setNewTitle('');
      setNewContent('');
      setEditingNoteId(null);
      setIsModalOpen(false);
      loadNotes();
    } catch (e) {
      console.warn('Gagal menyimpan catatan:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingNoteId(null);
    setNewTitle('');
    setNewContent('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (note: PersonalNote) => {
    setEditingNoteId(note.id);
    setNewTitle(note.title);
    setNewContent(note.contentMarkdown);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingNoteId(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Hapus Catatan', 'Apakah Anda yakin ingin menghapus catatan ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await notesRepository.softDelete(id);
          setNotes((prev) => prev.filter((n) => n.id !== id));
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBox}>
          <Search size={16} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari catatan atau isi memo..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Notes List */}
      {isLoading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : filteredNotes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <BookOpen size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Belum Ada Catatan</Text>
          <Text style={styles.emptySubtitle}>
            Catat ringkasan meeting, ide strategis, atau logbook kerja harian di sini.
          </Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={handleOpenCreate}>
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.emptyAddBtnText}>Buat Catatan Baru</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.noteCard}
              activeOpacity={0.8}
              onPress={() => handleOpenEdit(item)}
              accessibilityLabel={`Edit catatan ${item.title}`}
            >
              <View style={styles.noteCardHeader}>
                <View style={styles.noteDateRow}>
                  <Calendar size={12} color="#64748B" />
                  <Text style={styles.noteDateText}>{item.linkedDate || 'Umum'}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={15} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.noteTitle}>{item.title}</Text>

              {item.contentMarkdown ? (
                <Text style={styles.noteContent} numberOfLines={3}>
                  {item.contentMarkdown}
                </Text>
              ) : null}

            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB: membuka editor satu layar penuh */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenCreate}
        activeOpacity={0.85}
        accessibilityLabel="Tulis catatan baru"
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Editor catatan. Satu layar penuh agar menulis terasa seperti halaman,
          bukan formulir kecil di dalam modal. */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        onRequestClose={handleCloseModal}
        presentationStyle="fullScreen"
      >
        <View style={styles.editorContainer}>
          <View style={styles.editorHeader}>
            <TouchableOpacity
              style={styles.editorIconBtn}
              onPress={handleCloseModal}
              accessibilityLabel="Tutup editor"
            >
              <ArrowLeft size={18} color={TodoColors.muted} />
            </TouchableOpacity>

            <Text style={styles.editorHeaderTitle}>
              {editingNoteId ? 'Ubah catatan' : 'Catatan baru'}
            </Text>

            <TouchableOpacity
              style={[styles.editorSaveBtn, (!newTitle.trim() || isSubmitting) && styles.editorSaveBtnDisabled]}
              onPress={handleCreateNote}
              disabled={!newTitle.trim() || isSubmitting}
            >
              <Text style={styles.editorSaveText}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.editorTitle}
            placeholder="Judul catatan"
            placeholderTextColor={TodoColors.faint}
            value={newTitle}
            onChangeText={setNewTitle}
            maxLength={120}
          />

          <View style={styles.editorMeta}>
            <Clock3 size={12} color={TodoColors.faint} />
            <Text style={styles.editorMetaText}>
              {toIsoDate(new Date())} · tersimpan otomatis saat menekan Simpan
            </Text>
          </View>

          <TextInput
            style={styles.editorBody}
            placeholder="Mulai menulis..."
            placeholderTextColor={TodoColors.faint}
            multiline
            textAlignVertical="top"
            value={newContent}
            onChangeText={setNewContent}
            autoFocus
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  tagsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 8,
  },
  tagScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  tagPillActive: {
    backgroundColor: BrandColors.primary,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tagPillTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  noteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 20,
  },
  noteContent: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 10,
  },
  noteCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  noteTagBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  noteTagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  editorContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  editorIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F7F9',
  },
  editorHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TodoColors.muted,
  },
  editorSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: BrandColors.primary,
  },
  editorSaveBtnDisabled: {
    opacity: 0.4,
  },
  editorSaveText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TodoColors.title,
    letterSpacing: -0.4,
    paddingVertical: 4,
  },
  editorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    marginBottom: 12,
  },
  editorMetaText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: TodoColors.faint,
  },
  editorBody: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    color: TodoColors.body,
    paddingTop: 4,
    paddingBottom: 24,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  modalTextArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  addTagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addTagBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChipsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagChipEditable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagChipEditableText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  memoSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  saveBtn: {
    backgroundColor: BrandColors.primary,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
