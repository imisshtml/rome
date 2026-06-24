import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { GAME_RULES, GAME_RULES_TITLE } from '../content/gameRules';

interface RulesModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ visible, onClose }) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const panelW = Math.min(520, screenW - 32);
  const panelMaxH = Math.min(640, screenH * 0.85);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { width: panelW, maxHeight: panelMaxH }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{GAME_RULES_TITLE}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {GAME_RULES.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.body ? (
                  <Text style={styles.sectionBody}>{section.body}</Text>
                ) : null}
                {section.bullets?.map((bullet) => (
                  <View key={bullet.slice(0, 40)} style={styles.bulletRow}>
                    <Text style={styles.bulletMark}>•</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  sectionBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 19,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 2,
  },
  bulletMark: {
    color: 'rgba(241,196,15,0.85)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  bulletText: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 19,
  },
  doneBtn: {
    marginHorizontal: 16,
    marginBottom: 14,
    marginTop: 4,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#F1C40F',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default RulesModal;
