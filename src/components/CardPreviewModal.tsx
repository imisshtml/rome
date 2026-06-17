import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  useWindowDimensions,
  Image,
} from 'react-native';
import { CardInstance, FACTION_COLORS } from '../types/cardTypes';
import { getCardImage } from '../assets/images';

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

  const { definition } = card;
  const bgColor = FACTION_COLORS[definition.faction] ?? '#555';
  const cardImage = getCardImage(definition.image);
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
          {cardImage ? (
            <View style={[styles.imageCard, { width: cardW, height: cardH }]}>
              <Image source={cardImage} style={styles.imageFill} resizeMode="contain" />
            </View>
          ) : (
          <View
            style={[
              styles.card,
              { width: cardW, height: cardH, backgroundColor: bgColor },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.costBadge}>
                <Text style={styles.costText}>{definition.cost}</Text>
              </View>
              <Text style={styles.factionTag}>{definition.faction}</Text>
              <View style={styles.valorBadge}>
                <Text style={styles.valorText}>⚔ {definition.valor}</Text>
              </View>
            </View>

            <View style={styles.titleArea}>
              <Text style={styles.nameText}>{definition.name}</Text>
              <Text style={styles.typeText}>{definition.type}</Text>
            </View>

            <View style={styles.artPlaceholder}>
              <Text style={styles.artEmoji}>
                {definition.faction === 'Ludus' && '🗡'}
                {definition.faction === 'Legion' && '🛡'}
                {definition.faction === 'Senate' && '📜'}
                {definition.faction === 'Arena' && '🏟'}
                {definition.faction === 'Event' && '⚡'}
                {definition.faction === 'Epic' && '👑'}
                {definition.faction === 'Item' && '⚒'}
                {definition.faction === 'Favor' && '🌿'}
                {definition.faction === 'CrowdDisfavor' && '👎'}
              </Text>
            </View>

            <View style={styles.textBox}>
              <Text style={styles.descText}>{definition.text}</Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerType}>{definition.type}</Text>
              {definition.victoryPoints !== 0 && (
                <Text style={styles.vpText}>
                  ★ {definition.victoryPoints} VP
                </Text>
              )}
            </View>
          </View>
          )}

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
  imageCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: '#12122a',
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  costBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  costText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  factionTag: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  valorBadge: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  valorText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  titleArea: {
    alignItems: 'center',
    marginBottom: 12,
  },
  nameText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  typeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  artPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    marginBottom: 12,
    minHeight: 80,
  },
  artEmoji: {
    fontSize: 48,
  },
  textBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  descText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerType: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  vpText: {
    color: '#FFD700',
    fontWeight: '800',
    fontSize: 16,
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
