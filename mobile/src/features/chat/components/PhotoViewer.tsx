import React from 'react';
import { Modal, View, Text, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function PhotoViewer({
  urls,
  startIndex,
  onClose,
}: {
  urls: string[] | null;
  startIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = React.useState(startIndex);

  React.useEffect(() => {
    setIndex(startIndex);
  }, [startIndex, urls]);

  if (!urls) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <FlatList
          data={urls}
          horizontal
          pagingEnabled
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(u, i) => `${i}_${u}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: item }} style={{ width, height }} contentFit="contain" cachePolicy="memory-disk" />
            </View>
          )}
        />
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 12,
            right: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          {urls.length > 1 ? (
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
              {index + 1} / {urls.length}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
