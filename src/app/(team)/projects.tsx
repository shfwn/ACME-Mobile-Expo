import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';
import { teamRepository } from '../../db/team.repository';
import { TaskItem, CustomStatus, Project } from '../../types/team.types';
import { Priority } from '../../types/auth.types';
import { BrandColors } from '../../constants/theme';
import { TaskDetailModal } from '../../components/task-detail-modal';
import {
  LayoutDashboard,
  Plus,
  Calendar,
  Clock,
  CheckSquare,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  X,
  Layers,
} from 'lucide-react-native';

export default function TeamProjectsScreen() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || 'u-default';

  const [project, setProject] = useState<Project | null>(null);
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [activeStatusId, setActiveStatusId] = useState<string>('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTaskDetail, setActiveTaskDetail] = useState<TaskItem | null>(null);

  // Create Task Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('MEDIUM');
  const [newHours, setNewHours] = useState('2');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProjectData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { project: defaultProj, statuses: defaultStatuses } =
        await teamRepository.ensureDefaultProject();
      setProject(defaultProj);
      setStatuses(defaultStatuses);

      if (!activeStatusId && defaultStatuses.length > 0) {
        setActiveStatusId(defaultStatuses[0].id);
      }

      const allTasks = await teamRepository.getTasksByProject(defaultProj.id);
      setTasks(allTasks);
    } catch (e) {
      console.warn('Gagal memuat papan proyek:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeStatusId]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // Tasks in currently selected status column
  const currentColumnTasks = useMemo(() => {
    return tasks.filter((t) => t.statusId === activeStatusId);
  }, [tasks, activeStatusId]);

  // Overall Project Progress
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status?.isDoneState).length;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const handleMoveStatus = async (task: TaskItem, direction: 'prev' | 'next') => {
    const currentIndex = statuses.findIndex((s) => s.id === task.statusId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= 0 && targetIndex < statuses.length) {
      const targetStatus = statuses[targetIndex];
      await teamRepository.updateTaskStatus(task.id, targetStatus.id);
      loadProjectData();
    }
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim() || !project) return;
    setIsSubmitting(true);
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      await teamRepository.createTask({
        projectId: project.id,
        statusId: activeStatusId || statuses[0].id,
        creatorId: userId,
        assigneeId: userId,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        priority: newPriority,
        estimatedHours: parseFloat(newHours) || 0,
        dueDate: todayIso,
      });

      setNewTitle('');
      setNewDesc('');
      setIsCreateModalOpen(false);
      loadProjectData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityOptions: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  return (
    <View style={styles.container}>
      {/* 1. Project Progress Roll-up Header */}
      <View style={styles.projectHeaderCard}>
        <View style={styles.projectHeaderTop}>
          <View style={styles.projectTitleRow}>
            <View style={[styles.projectBadge, { backgroundColor: project?.color || BrandColors.primary }]}>
              <Layers size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.projectName}>{project?.name || 'Papan Proyek'}</Text>
              <Text style={styles.projectSubtitle}>
                {doneTasks} dari {totalTasks} selesai dikerjakan
              </Text>
            </View>
          </View>
          <Text style={styles.projectProgressNumber}>{progressPercent}%</Text>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarIndicator,
              { width: `${progressPercent}%`, backgroundColor: '#10B981' },
            ]}
          />
        </View>
      </View>

      {/* 2. Mobile Status Column Switcher Bar */}
      <View style={styles.statusTabsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusTabsContent}>
          {statuses.map((s, idx) => {
            const isActive = activeStatusId === s.id;
            const count = tasks.filter((t) => t.statusId === s.id).length;

            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.statusTabItem,
                  isActive && { backgroundColor: s.color, borderColor: s.color },
                ]}
                onPress={() => setActiveStatusId(s.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statusTabItemName, isActive && { color: '#FFFFFF', fontWeight: '800' }]}>
                  {s.name}
                </Text>
                <View style={[styles.statusCountTag, isActive && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={[styles.statusCountTagText, isActive && { color: '#FFFFFF' }]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Task Cards in Current Column */}
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      ) : currentColumnTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <LayoutDashboard size={44} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>Kolom Kosong</Text>
          <Text style={styles.emptySubtitle}>Belum ada tugas di kolom status ini.</Text>
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.emptyCreateBtnText}>Tambah Tugas di Kolom Ini</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={currentColumnTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const priorityColor =
              item.priority === 'URGENT'
                ? BrandColors.urgent
                : item.priority === 'HIGH'
                ? BrandColors.high
                : item.priority === 'LOW'
                ? BrandColors.low
                : BrandColors.medium;

            const currentIndex = statuses.findIndex((s) => s.id === item.statusId);
            const canPrev = currentIndex > 0;
            const canNext = currentIndex < statuses.length - 1;
            const completedSubs = item.subtasks.filter((s) => s.isCompleted).length;

            return (
              <View style={styles.kanbanCard}>
                <TouchableOpacity onPress={() => setActiveTaskDetail(item)} activeOpacity={0.7}>
                  {/* Card Meta Header */}
                  <View style={styles.cardMetaRow}>
                    <View style={[styles.cardPriorityBadge, { backgroundColor: priorityColor + '18' }]}>
                      <Text style={[styles.cardPriorityText, { color: priorityColor }]}>
                        {item.priority}
                      </Text>
                    </View>
                    {item.dueDate && (
                      <View style={styles.cardDueDate}>
                        <Calendar size={11} color="#64748B" />
                        <Text style={styles.cardDueDateText}>{item.dueDate}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardTitle}>{item.title}</Text>

                  {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  {/* Footnote Counts */}
                  <View style={styles.cardFootnotes}>
                    {item.subtasks.length > 0 && (
                      <View style={styles.footnoteBadge}>
                        <CheckSquare size={11} color="#64748B" />
                        <Text style={styles.footnoteText}>
                          {completedSubs}/{item.subtasks.length}
                        </Text>
                      </View>
                    )}
                    {item.comments.length > 0 && (
                      <View style={styles.footnoteBadge}>
                        <MessageSquare size={11} color="#64748B" />
                        <Text style={styles.footnoteText}>{item.comments.length}</Text>
                      </View>
                    )}
                    {item.estimatedHours > 0 && (
                      <View style={styles.footnoteBadge}>
                        <Clock size={11} color="#64748B" />
                        <Text style={styles.footnoteText}>{item.estimatedHours} Jam</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Quick Transition Bar */}
                <View style={styles.cardActionBar}>
                  {canPrev ? (
                    <TouchableOpacity
                      style={styles.actionShiftBtn}
                      onPress={() => handleMoveStatus(item, 'prev')}
                    >
                      <ArrowLeft size={13} color="#64748B" />
                      <Text style={styles.actionShiftText}>Mundur</Text>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}

                  {canNext && (
                    <TouchableOpacity
                      style={[styles.actionShiftBtn, styles.actionShiftBtnNext]}
                      onPress={() => handleMoveStatus(item, 'next')}
                    >
                      <Text style={[styles.actionShiftText, styles.actionShiftTextNext]}>
                        Pindah Maju
                      </Text>
                      <ArrowRight size={13} color={BrandColors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsCreateModalOpen(true)}
        activeOpacity={0.8}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Task Detail Modal */}
      <TaskDetailModal
        visible={!!activeTaskDetail}
        task={activeTaskDetail}
        statuses={statuses}
        currentUserId={userId}
        onClose={() => setActiveTaskDetail(null)}
        onTaskUpdated={() => {
          loadProjectData();
          if (activeTaskDetail && project) {
            teamRepository.getTasksByProject(project.id).then((all) => {
              const ref = all.find((t) => t.id === activeTaskDetail.id);
              if (ref) setActiveTaskDetail(ref);
            });
          }
        }}
      />

      {/* Create Task Modal */}
      <Modal visible={isCreateModalOpen} animationType="slide" transparent onRequestClose={() => setIsCreateModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tambah Tugas Proyek Baru</Text>
              <TouchableOpacity onPress={() => setIsCreateModalOpen(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Judul Tugas *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Contoh: Desain Antarmuka Bottom Sheet"
                  placeholderTextColor="#94A3B8"
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Deskripsi</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Instruksi pengerjaan tugas..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                  value={newDesc}
                  onChangeText={setNewDesc}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tingkat Prioritas</Text>
                <View style={styles.pillsRow}>
                  {priorityOptions.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.pill, newPriority === p && styles.pillActive]}
                      onPress={() => setNewPriority(p)}
                    >
                      <Text style={[styles.pillText, newPriority === p && styles.pillTextActive]}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Estimasi Jam Kerja</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="2"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={newHours}
                  onChangeText={setNewHours}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, (!newTitle.trim() || isSubmitting) && styles.btnDisabled]}
                onPress={handleCreateTask}
                disabled={!newTitle.trim() || isSubmitting}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan ke Papan Proyek'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
  projectHeaderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  projectHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  projectTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  projectBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  projectSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  projectProgressNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarIndicator: {
    height: '100%',
    borderRadius: 3,
  },
  statusTabsBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusTabItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statusCountTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  statusCountTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  kanbanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardPriorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardPriorityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardDueDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDueDateText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 19,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 8,
  },
  cardFootnotes: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
  },
  footnoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  footnoteText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  cardActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionShiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },
  actionShiftBtnNext: {
    backgroundColor: '#EEF2FF',
  },
  actionShiftText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  actionShiftTextNext: {
    color: BrandColors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
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
  modalCard: {
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
    paddingBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillActive: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: BrandColors.primary,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
