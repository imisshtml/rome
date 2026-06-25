import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { CardInstance } from '../types/cardTypes';
import { getCardDefinition } from '../game/CardDefinitions';
import { CardFace } from './CardFace';

interface MarketPickModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  cards: CardInstance[];
  onChoose: (card: CardInstance) => void;
}

const CARD_W = 96;
const CARD_H = Math.round(CARD_W * 1.4);

export const MarketPickModal: React.FC<MarketPickModalProps> = ({
  visible,
  title,
  subtitle,
  cards,
  onChoose,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {cards.map((card) => (
            <Pressable
              key={card.instanceId}
              onPress={() => onChoose(card)}
              style={styles.cardBtn}
            >
              <CardFace
                definition={card.definition ?? getCardDefinition(card.definitionId)}
                faceUp={card.faceUp}
                width={CARD_W}
                height={CARD_H}
                chosenFaction={card.chosenFaction}
              />
              <Text style={styles.cost}>{card.definition.cost}c</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 420,
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
  row: {
    gap: 10,
    paddingVertical: 4,
  },
  cardBtn: {
    alignItems: 'center',
    gap: 4,
  },
  cost: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default MarketPickModal;
