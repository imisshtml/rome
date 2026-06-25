import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { Card } from './Card';
import CardPreviewModal from './CardPreviewModal';

interface MarketPickModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  cards: CardInstance[];
  onChoose: (card: CardInstance) => void;
  onSkip?: () => void;
  skipLabel?: string;
}

const CARD_W = 104;
const CARD_H = Math.round(CARD_W * 1.4);

export const MarketPickModal: React.FC<MarketPickModalProps> = ({
  visible,
  title,
  subtitle,
  cards,
  onChoose,
  onSkip,
  skipLabel = 'Skip',
}) => {
  const [previewCard, setPreviewCard] = useState<CardInstance | null>(null);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {cards.length === 0 ? (
              <Text style={styles.empty}>No valid cards available.</Text>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator
              >
                {cards.map((card) => (
                  <View key={card.instanceId} style={styles.cardWrap}>
                    <Card
                      card={card}
                      width={CARD_W}
                      height={CARD_H}
                      hoverPreview
                      onPress={() => onChoose(card)}
                      onLongPress={() => setPreviewCard(card)}
                    />
                    <Text style={styles.cost}>{card.definition.cost}c</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            {onSkip ? (
              <Pressable style={styles.skipBtn} onPress={onSkip}>
                <Text style={styles.skipBtnText}>{skipLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <CardPreviewModal
        card={previewCard}
        visible={previewCard != null}
        onClose={() => setPreviewCard(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 760,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
  },
  title: {
    color: '#f1c40f',
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  empty: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginBottom: 12,
  },
  scroll: {
    width: '100%',
    maxHeight: 520,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cardWrap: {
    alignItems: 'center',
    gap: 4,
  },
  cost: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
  },
  skipBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  skipBtnText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default MarketPickModal;
