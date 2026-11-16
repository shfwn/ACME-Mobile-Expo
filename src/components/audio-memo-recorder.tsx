import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import { Mic, Play, Square, Trash2 } from 'lucide-react-native';
import { BrandColors, Spacing } from '../constants/theme';

interface AudioMemoRecorderProps {
  /** URI rekaman yang sudah tersimpan (saat mengedit catatan lama). */
  value?: string | null;
  onChange: (uri: string | null) => void;
}

const formatSeconds = (total: number) => {
  const safe = Math.max(0, Math.floor(total));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

/**
 * Perekam memo suara untuk Catatan Harian.
 *
 * Hasil rekaman disimpan ke file cache (URI dipegang parent lalu dipersist ke
 * `personal_notes.audio_url`). Player dipakai bergantian dengan recorder.
 */
export function AudioMemoRecorder({ value, onChange }: AudioMemoRecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(value ? { uri: value } : null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    setError(null);
    setIsPreparing(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Izin mikrofon ditolak. Aktifkan di pengaturan perangkat.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setSeconds(0);
      setIsRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memulai rekaman');
    } finally {
      setIsPreparing(false);
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (uri) onChange(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan rekaman');
    } finally {
      setIsRecording(false);
    }
  }, [onChange, recorder]);

  const discard = useCallback(() => {
    player.pause();
    onChange(null);
    setSeconds(0);
  }, [onChange, player]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Mic size={16} color={BrandColors.primary} />
        <Text style={styles.label}>Memo suara</Text>
        {isRecording ? <Text style={styles.recording}>● {formatSeconds(seconds)}</Text> : null}
      </View>

      <View style={styles.controls}>
        {isRecording ? (
          <Pressable style={styles.stopBtn} onPress={stopRecording}>
            <Square size={16} color="#FFFFFF" />
            <Text style={styles.stopText}>Stop & simpan</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.recordBtn} onPress={startRecording} disabled={isPreparing}>
            {isPreparing ? (
              <ActivityIndicator size="small" color={BrandColors.primary} />
            ) : (
              <Mic size={16} color={BrandColors.primary} />
            )}
            <Text style={styles.recordText}>
              {value ? 'Rekam ulang' : 'Mulai rekam'}
            </Text>
          </Pressable>
        )}

        {value && !isRecording ? (
          <>
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                if (player.playing) player.pause();
                else player.play();
              }}
              accessibilityLabel="Putar memo"
            >
              <Play size={16} color={BrandColors.primary} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={discard} accessibilityLabel="Hapus memo">
              <Trash2 size={16} color="#EF4444" />
            </Pressable>
          </>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: Spacing.md,
    backgroundColor: '#F8FAFC',
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  recording: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  recordText: {
    fontSize: 12,
    fontWeight: '600',
    color: BrandColors.primary,
  },
  stopBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: '#EF4444',
  },
  stopText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  error: {
    fontSize: 11,
    color: '#EF4444',
  },
});
