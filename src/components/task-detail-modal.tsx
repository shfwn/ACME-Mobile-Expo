import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TaskItem, CustomStatus, SubtaskItem, CommentItem } from '../types/team.types';
import { BrandColors } from '../constants/theme';
import { teamRepository } from '../db/team.repository';
import { X, Check, Plus, MessageSquare, Clock, Calendar, CheckSquare } from 'lucide-react-native';

interface TaskDetailModalProps {
  visible: boolean;
  task: TaskItem | null;
  statuses: CustomStatus[];
  currentUserId: string;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  visible,
  task,
  statuses,
  currentUserId,
  onClose,
  onTaskUpdated,
}) => {
  if (!task) return null;

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');

  const priorityColor =
    task.priority === 'URGENT'
      ? BrandColors.urgent
      : task.priority === 'HIGH'
      ? BrandColors.high
      : task.priority === 'LOW'
      ? BrandColors.low
      : BrandColors.medium;

  const handleStatusChange = async (statusId: string) => {
    await teamRepository.updateTaskStatus(task.id, statusId);
    onTaskUpdated();
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    await teamRepository.toggleSubtask(subtaskId);
    onTaskUpdated();
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await teamRepository.addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    onTaskUpdated();
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;
    await teamRepository.addComment(task.id, currentUserId, newCommentText.trim());
    setNewCommentText('');
    onTaskUpdated();
  };

  const handleQuickLogTime = async (minutes: number) => {
    await teamRepository.addTimeLog(task.id, currentUserId, minutes, `Log cepat ${minutes} menit`);
    onTaskUpdated();
  };

  const completedSubtasks = task.subtasks.filter((s) => s.isCompleted).length;
  const totalSubtasks = task.subtasks.length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '18' }]}>
                <Text style={[styles.priorityText, { color: priorityColor }]}>{task.priority}</Text>
              </View>
              {task.dueDate && (
                <View style={styles.dueDateBadge}>
                  <Calendar size={12} color="#64748B" />
                  <Text style={styles.dueDateText}>{task.dueDate}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Subheader / Tabs */}
          <View style={styles.subHeader}>
            <Text style={styles.title}>{task.title}</Text>
            {task.description ? <Text style={styles.description}>{task.description}</Text> : null}

            {/* Status Switcher Bar */}
            <View style={styles.statusSection}>
              <Text style={styles.sectionLabel}>Status Pengerjaan:</Text>
              <View style={styles.statusPills}>
                {statuses.map((s) => {
                  const isCurrent = task.statusId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.statusPill,
                        isCurrent && { backgroundColor: s.color, borderColor: s.color },
                      ]}
                      onPress={() => handleStatusChange(s.id)}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isCurrent && { color: '#FFFFFF', fontWeight: '800' },
                        ]}
                      >
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Segment Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'details' && styles.tabBtnActive]}
                onPress={() => setActiveTab('details')}
              >
                <CheckSquare size={14} color={activeTab === 'details' ? BrandColors.primary : '#64748B'} />
                <Text style={[styles.tabBtnText, activeTab === 'details' && styles.tabBtnTextActive]}>
                  Checklist & Waktu ({completedSubtasks}/{totalSubtasks})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'comments' && styles.tabBtnActive]}
                onPress={() => setActiveTab('comments')}
              >
                <MessageSquare size={14} color={activeTab === 'comments' ? BrandColors.primary : '#64748B'} />
                <Text style={[styles.tabBtnText, activeTab === 'comments' && styles.tabBtnTextActive]}>
                  Diskusi ({task.comments.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Body Content */}
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            {activeTab === 'details' ? (
              <View style={styles.detailsContent}>
                {/* 1. Subtasks Checklist */}
                <View style={styles.sectionBox}>
                  <Text style={styles.boxTitle}>Subtasks Checklist</Text>
                  {task.subtasks.map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={styles.subtaskRow}
                      onPress={() => handleToggleSubtask(sub.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.subCheck, sub.isCompleted && styles.subCheckDone]}>
                        {sub.isCompleted && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                      <Text style={[styles.subText, sub.isCompleted && styles.subTextDone]}>
                        {sub.title}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* Add Subtask Input */}
                  <View style={styles.addSubtaskBox}>
                    <TextInput
                      style={styles.addSubtaskInput}
                      placeholder="Tambah subtask..."
                      placeholderTextColor="#94A3B8"
                      value={newSubtaskTitle}
                      onChangeText={setNewSubtaskTitle}
                      onSubmitEditing={handleAddSubtask}
                    />
                    <TouchableOpacity style={styles.addSubtaskBtn} onPress={handleAddSubtask}>
                      <Plus size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Quick Log Time */}
                <View style={styles.sectionBox}>
                  <Text style={styles.boxTitle}>Catat Waktu Kerja (Time Log)</Text>
                  <Text style={styles.boxSubtitle}>
                    Pilih durasi kerja yang telah Anda selesaikan untuk tugas ini:
                  </Text>
                  <View style={styles.quickTimeRow}>
                    <TouchableOpacity
                      style={styles.timePill}
                      onPress={() => handleQuickLogTime(15)}
                    >
                      <Clock size={12} color={BrandColors.primary} />
                      <Text style={styles.timePillText}>+15 Menit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.timePill}
                      onPress={() => handleQuickLogTime(30)}
                    >
                      <Clock size={12} color={BrandColors.primary} />
                      <Text style={styles.timePillText}>+30 Menit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.timePill}
                      onPress={() => handleQuickLogTime(60)}
                    >
                      <Clock size={12} color={BrandColors.primary} />
                      <Text style={styles.timePillText}>+1 Jam</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.commentsContent}>
                {task.comments.length === 0 ? (
                  <View style={styles.emptyComments}>
                    <Text style={styles.emptyCommentsText}>Belum ada komentar pada tugas ini.</Text>
                  </View>
                ) : (
                  task.comments.map((comment) => (
                    <View key={comment.id} style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUser}>Rekan Tim</Text>
                        <Text style={styles.commentDate}>
                          {new Date(comment.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.commentBody}>{comment.content}</Text>
                    </View>
                  ))
                )}

                {/* Add Comment Input */}
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Tulis tanggapan atau pembaruan..."
                    placeholderTextColor="#94A3B8"
                    value={newCommentText}
                    onChangeText={setNewCommentText}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.sendCommentBtn, !newCommentText.trim() && styles.btnDisabled]}
                    onPress={handleAddComment}
                    disabled={!newCommentText.trim()}
                  >
                    <Text style={styles.sendCommentBtnText}>Kirim</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dueDateText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  closeBtn: {
    padding: 4,
  },
  subHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 10,
  },
  statusSection: {
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  statusPills: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: BrandColors.periwinkle,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: BrandColors.primary,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  detailsContent: {
    gap: 16,
    paddingBottom: 40,
  },
  sectionBox: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  boxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  boxSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCheckDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  subText: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  subTextDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  addSubtaskBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  addSubtaskInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
  },
  addSubtaskBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTimeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  commentsContent: {
    paddingBottom: 40,
  },
  emptyComments: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  commentItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.primary,
  },
  commentDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  commentBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    maxHeight: 80,
  },
  sendCommentBtn: {
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  sendCommentBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
