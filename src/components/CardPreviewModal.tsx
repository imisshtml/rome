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
import { getCardDefinition, isGratiaSupplyDefinition } from '../game/CardDefinitions';
import { getClickPreviewSize } from '../utils/cardDisplayUtils';
import CardFace from './CardFace';
import GratiaSupplyCard from './GratiaSupplyCard';

/** Stat badges on click preview — smaller than board cards at the same ratio. */
const ZOOM_BADGE_SCALE = 0.78;

interface CardPreviewModalProps {
  card: CardInstance | null;
  visible: boolean;
  onClose: () => void;
  showPurchase?: boolean;
  canPurchase?: boolean;
  purchaseBlockedReason?: string;
  onPurchase?: () => void;
}

export const CardPreviewModal: React.FC<CardPreviewModalProps> = ({
  card,
  visible,
  onClose,
  showPurchase = false,
  canPurchase = false,
  purchaseBlockedReason,
  onPurchase,
}) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  if (!card) return null;

  const definition = card.definition ?? getCardDefinition(card.definitionId);
  const { width: cardW, height: cardH } = getClickPreviewSize(
    screenW,
    definition,
    screenH
  );
  const cost = definition.cost ?? 0;

  const cardPreview = isGratiaSupplyDefinition(card) ? (
    <GratiaSupplyCard width={cardW} height={cardH} />
  ) : (
    <CardFace
      definition={definition}
      faceUp={card.faceUp}
      width={cardW}
      height={cardH}
      badgeScale={ZOOM_BADGE_SCALE}
      chosenFaction={card.chosenFaction}
    />
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.centered} onPress={(e) => e.stopPropagation()}>
          {cardPreview}

          {showPurchase ? (
            canPurchase && onPurchase ? (
              <Pressable style={styles.buyBtn} onPress={onPurchase}>
                <Text style={styles.buyBtnText}>Buy ({cost} coins)</Text>
              </Pressable>
            ) : purchaseBlockedReason ? (
              <Text style={styles.blockedText}>{purchaseBlockedReason}</Text>
            ) : null
          ) : null}

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
  buyBtn: {
    marginTop: 14,
    backgroundColor: 'rgba(46, 204, 113, 0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(46, 204, 113, 0.75)',
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 8,
  },
  buyBtnText: {
    color: '#2ECC71',
    fontWeight: '800',
    fontSize: 15,
  },
  blockedText: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 280,
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
