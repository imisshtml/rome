import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, LayoutRectangle, ViewStyle } from 'react-native';
import { CardLocation } from '../types/cardTypes';
import { useDraggedCard, useHoveredZone } from '../store/useGameStore';
import { canDropCard } from '../utils/dragHelpers';

export interface DropZoneProps {
  id: string;
  zoneType: CardLocation;
  label: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  onLayout?: (layout: LayoutRectangle) => void;
  highlight?: boolean;
  activePhase?: boolean;
  emptyText?: string;
  showGlow?: boolean;
  contentColumn?: boolean;
  contentCenter?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  id,
  zoneType,
  label,
  children,
  style,
  onLayout,
  highlight = false,
  activePhase = false,
  emptyText,
  showGlow = false,
  contentColumn = false,
  contentCenter = false,
}) => {
  const [hoveredZone] = useHoveredZone();
  const [draggedCard] = useDraggedCard();
  const isHovered = hoveredZone === id;

  const canAccept =
    draggedCard != null &&
    canDropCard(draggedCard, draggedCard.location, zoneType);

  const isActive = isHovered || highlight;
  const showAcceptGlow = (isActive && canAccept) || (highlight && !draggedCard);

  const glowColor = showAcceptGlow
    ? '#2ECC71'
    : isActive
    ? 'rgba(255,255,255,0.3)'
    : activePhase
    ? 'rgba(241,196,15,0.3)'
    : 'rgba(255,255,255,0.1)';

  const borderW = isActive || highlight ? 2 : activePhase ? 1.5 : 1;

  const zoneRef = useRef<View>(null);

  const reportWindowLayout = useCallback(() => {
    zoneRef.current?.measureInWindow((x, y, width, height) => {
      onLayout?.({ x, y, width, height });
    });
  }, [onLayout]);

  const handleLayout = useCallback(() => {
    reportWindowLayout();
  }, [reportWindowLayout]);

  useEffect(() => {
    if (draggedCard) reportWindowLayout();
  }, [draggedCard, reportWindowLayout]);

  const hasChildren = React.Children.count(children) > 0;

  return (
    <View
      ref={zoneRef}
      onLayout={handleLayout}
      style={[
        styles.zone,
        {
          borderColor: glowColor,
          borderWidth: borderW,
        },
        activePhase && styles.activePhaseZone,
        isActive && canAccept && styles.canAcceptZone,
        highlight && !draggedCard && styles.canAcceptZone,
        showGlow && styles.glowZone,
        style,
      ]}
    >
      {label.length > 0 && (
        <Text
          style={[
            styles.zoneLabel,
            activePhase && styles.zoneLabelActive,
          ]}
        >
          {label}
        </Text>
      )}
      <View
        style={[
          styles.content,
          contentColumn && styles.contentColumn,
          contentCenter && styles.contentCenter,
        ]}
      >
        {children}
        {!hasChildren && emptyText && (
          <Text style={styles.emptyText}>{emptyText}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  zone: {
    borderRadius: 10,
    borderStyle: 'dashed',
    padding: 8,
    minHeight: 60,
    backgroundColor: 'transparent',
  },
  activePhaseZone: {
    borderStyle: 'dashed',
  },
  canAcceptZone: {
    borderStyle: 'solid',
  },
  glowZone: {
    shadowColor: '#F1C40F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  zoneLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    textAlign: 'center',
  },
  zoneLabelActive: {
    color: 'rgba(241,196,15,0.7)',
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 30,
  },
  contentColumn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  contentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 10,
    fontStyle: 'italic',
  },
});

export default DropZone;
