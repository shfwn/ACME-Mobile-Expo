import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FileSpreadsheet } from 'lucide-react-native';
import { TodoColors } from '../../constants/theme';

/**
 * Halaman Sheets dikosongkan.
 *
 * Isi sebelumnya (ringkasan jam kerja, ekspor .xlsx/.csv, daftar tautan) sudah
 * dipindahkan atau dicabut: ringkasan kini tinggal di halaman Profil, sedangkan
 * ekspor dan tautan menunggu keputusan desain berikutnya.
 */
export default function ExecutiveSheetsScreen() {
  return (
    <View style={styles.container}>
      <FileSpreadsheet size={44} color="#CBD5E1" />
      <Text style={styles.title}>Belum ada isi</Text>
      <Text style={styles.subtitle}>Halaman ini sengaja dikosongkan untuk penataan ulang.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: TodoColors.body,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: TodoColors.faint,
    textAlign: 'center',
  },
});
