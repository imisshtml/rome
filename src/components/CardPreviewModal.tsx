import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { CardInstance } from '../types/cardTypes';
import CardFace from './CardFace';

interface CardPreviewModalProps {
  card: CardInstance | null;
  visible: boolean;
  onClose: () => void;
}

export const CardPreviewModal: React.FC<CardPreviewModalProps> = ({
  card,
  visible,
  onClose,
}) => {
  const { width: screenW } = useWindowDimensions();
  if (!card) return null;

  const cardW = Math.min(280, screenW * 0.7);
  const cardH = cardW * 1.45;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.centered} onPress={(e) => e.stopPropagation()}>
          <CardFace
            definition={card.definition}
            faceUp={card.faceUp}
            width={cardW}
            height={cardH}
            anchorArtTop={false}
          />

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕ Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    alignItems: 'center',
  },
  closeBtn: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

export default CardPreviewModal;
