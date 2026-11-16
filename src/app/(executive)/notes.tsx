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
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { useFocusEffect } from 'expo-router';
import { notesRepository } from '../../db/repository';
import { AudioMemoRecorder } from '../../components/audio-memo-recorder';
import { toIsoDate } from '../../components/date-picker-sheet';
import { PersonalNote } from '../../types/todo.types';
import { BrandColors } from '../../constants/theme';
import { Search, Plus, X, Calendar, Tag, Trash2, BookOpen } from 'lucide-react-native';

export default function ExecutiveNotesScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
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

  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      for (const t of n.tags) {
        if (t.trim()) set.add(t.trim());
      }
    }
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesSearch =
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.contentMarkdown.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTag =
        selectedTag === 'all' || note.tags.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }, [notes, searchQuery, selectedTag]);

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed || newTags.includes(trimmed)) return;
    setNewTags([...newTags, trimmed]);
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNewTags(newTags.filter((t) => t !== tagToRemove));
  };

  const handleCreateNote = async () => {
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    const todayIso = toIsoDate(new Date());

    try {
      if (editingNoteId) {
        await notesRepository.update(editingNoteId, {
          title: newTitle.trim(),
          contentMarkdown: newContent.trim(),
          tags: newTags,
          audioUrl: audioUri,
        });
      } else {
        await notesRepository.create({
          userId,
          title: newTitle.trim(),
          contentMarkdown: newContent.trim(),
          linkedDate: todayIso,
          tags: newTags,
          audioUrl: audioUri ?? undefined,
        });
      }

      setNewTitle('');
      setNewContent('');
      setNewTags([]);
      setAudioUri(null);
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
    setNewTags([]);
    setAudioUri(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (note: PersonalNote) => {
    setEditingNoteId(note.id);
    setNewTitle(note.title);
    setNewContent(note.contentMarkdown);
    setNewTags(note.tags);
    setAudioUri(note.audioUrl ?? null);
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

      {/* Tag Filters */}
      {allAvailableTags.length > 0 && (
        <View style={styles.tagsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll}>
            <TouchableOpacity
              style={[styles.tagPill, selectedTag === 'all' && styles.tagPillActive]}
              onPress={() => setSelectedTag('all')}
            >
              <Text style={[styles.tagPillText, selectedTag === 'all' && styles.tagPillTextActive]}>
                Semua ({notes.length})
              </Text>
            </TouchableOpacity>
            {allAvailableTags.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tagPill, selectedTag === t && styles.tagPillActive]}
                onPress={() => setSelectedTag(t)}
              >
                <Tag size={10} color={selectedTag === t ? '#FFFFFF' : '#64748B'} style={{ marginRight: 4 }} />
                <Text style={[styles.tagPillText, selectedTag === t && styles.tagPillTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

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

              {item.tags.length > 0 && (
                <View style={styles.noteCardTags}>
                  {item.tags.map((tg) => (
                    <View key={tg} style={styles.noteTagBadge}>
                      <Text style={styles.noteTagBadgeText}>#{tg}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenCreate} activeOpacity={0.8}>
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Note Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={handleCloseModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingNoteId ? 'Edit Catatan' : 'Catatan Harian Baru'}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Judul Catatan *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Contoh: Log Diskusi Proyek ACME Mobile"
                  placeholderTextColor="#94A3B8"
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Tags / Kategori</Text>
                <View style={styles.addTagRow}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder="Tambah tag (misal: Meeting)"
                    placeholderTextColor="#94A3B8"
                    value={newTagInput}
                    onChangeText={setNewTagInput}
                    onSubmitEditing={handleAddTag}
                  />
                  <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                    <Plus size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {newTags.length > 0 && (
                  <View style={styles.tagChipsList}>
                    {newTags.map((tg) => (
                      <View key={tg} style={styles.tagChipEditable}>
                        <Text style={styles.tagChipEditableText}>#{tg}</Text>
                        <TouchableOpacity onPress={() => handleRemoveTag(tg)}>
                          <X size={12} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Isi Catatan (Markdown)</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  placeholder="Tulis poin-poin penting catatan di sini..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={6}
                  value={newContent}
                  onChangeText={setNewContent}
                />
              </View>
            </ScrollView>

            <View style={styles.memoSection}>
              <AudioMemoRecorder value={audioUri} onChange={setAudioUri} />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveBtn, (!newTitle.trim() || isSubmitting) && styles.saveBtnDisabled]}
                onPress={handleCreateNote}
                disabled={!newTitle.trim() || isSubmitting}
              >
                <Text style={styles.saveBtnText}>
                  {isSubmitting ? 'Menyimpan...' : editingNoteId ? 'Simpan Perubahan' : 'Simpan Catatan'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
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
