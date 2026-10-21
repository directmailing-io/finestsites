import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { uploadAvatar } from '@/api/endpoints';

/** Profilfoto wählen (Kamera oder Fotos), quadratisch zuschneiden lassen, hochladen. */
export function pickAndUploadAvatar(onStart: () => void, onDone: (url: string | null) => void) {
  const run = async (source: 'camera' | 'library') => {
    const perm =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Kein Zugriff', 'Bitte erlaube den Zugriff in den Einstellungen deines Geräts.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    onStart();
    try {
      const { url } = await uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg');
      onDone(`${url}?t=${Date.now()}`);
    } catch {
      Alert.alert('Upload fehlgeschlagen', 'Bitte versuche es nochmal.');
      onDone(null);
    }
  };
  Alert.alert('Profilfoto', 'JPG, PNG oder WebP, max. 5 MB. Das Foto wird quadratisch zugeschnitten.', [
    { text: 'Foto aufnehmen', onPress: () => void run('camera') },
    { text: 'Aus Fotos wählen', onPress: () => void run('library') },
    { text: 'Abbrechen', style: 'cancel' },
  ]);
}
