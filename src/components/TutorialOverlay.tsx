import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useTutorial } from '../context/TutorialContext';
import { TUTORIAL_STEPS, TutorialStep } from '../tutorial/tutorialSteps';

const SPOTLIGHT_PAD = 8;
const TOOLTIP_MAX_W = 340;
const TOOLTIP_MARGIN = 16;
const TOOLTIP_GAP = 16;

function paddedRect(rect: { x: number; y: number; width: number; height: number }) {
  return {
    x: Math.max(0, rect.x - SPOTLIGHT_PAD),
    y: Math.max(0, rect.y - SPOTLIGHT_PAD),
    width: rect.width + SPOTLIGHT_PAD * 2,
    height: rect.height + SPOTLIGHT_PAD * 2,
  };
}

function estimatePanelHeight(step: TutorialStep): number {
  const bodyLines = Math.ceil((step.body?.length ?? 0) / 42);
  const base = 118 + bodyLines * 20;
  if (step.requireTargetClick) return base + 24;
  return Math.min(280, Math.max(168, base));
}

function clampTop(top: number, panelH: number, screenH: number): number {
  return Math.max(
    TOOLTIP_MARGIN,
    Math.min(top, screenH - panelH - TOOLTIP_MARGIN)
  );
}

function horizontalCenter(
  highlight: { x: number; width: number },
  panelW: number,
  screenW: number
): number {
  return Math.min(
    Math.max(TOOLTIP_MARGIN, highlight.x + highlight.width / 2 - panelW / 2),
    screenW - panelW - TOOLTIP_MARGIN
  );
}

function computeTooltipLayout(
  step: TutorialStep,
  highlight: { x: number; y: number; width: number; height: number } | null,
  screenW: number,
  screenH: number
): { left: number; top: number; width: number } {
  const panelW = Math.min(TOOLTIP_MAX_W, screenW - TOOLTIP_MARGIN * 2);
  const panelH = estimatePanelHeight(step);

  if (!highlight || step.placement === 'center') {
    return {
      left: (screenW - panelW) / 2,
      top: clampTop(screenH * 0.18, panelH, screenH),
      width: panelW,
    };
  }

  const placement = step.placement ?? 'bottom';

  if (placement === 'top') {
    let top = highlight.y - TOOLTIP_GAP - panelH;
    top = Math.max(TOOLTIP_MARGIN, top);
    if (top + panelH + TOOLTIP_GAP > highlight.y) {
      top = Math.max(TOOLTIP_MARGIN, highlight.y - TOOLTIP_GAP - panelH);
    }
    return {
      left: horizontalCenter(highlight, panelW, screenW),
      top: clampTop(top, panelH, screenH),
      width: panelW,
    };
  }

  if (placement === 'bottom') {
    return {
      left: horizontalCenter(highlight, panelW, screenW),
      top: clampTop(highlight.y + highlight.height + TOOLTIP_GAP, panelH, screenH),
      width: panelW,
    };
  }

  if (placement === 'left') {
    const left = Math.max(
      TOOLTIP_MARGIN,
      highlight.x - panelW - TOOLTIP_GAP
    );
    let top = step.anchorHigh
      ? highlight.y - panelH * 0.55
      : highlight.y + highlight.height / 2 - panelH / 2;
    if (step.anchorHigh) {
      top = Math.min(top, screenH * 0.42);
    }
    return {
      left,
      top: clampTop(top, panelH, screenH),
      width: panelW,
    };
  }

  // right
  const left = Math.min(
    highlight.x + highlight.width + TOOLTIP_GAP,
    screenW - panelW - TOOLTIP_MARGIN
  );
  let top = step.anchorHigh
    ? highlight.y - panelH * 0.55
    : highlight.y + highlight.height / 2 - panelH / 2;
  if (step.anchorHigh) {
    top = Math.min(top, screenH * 0.42);
  }
  return {
    left,
    top: clampTop(top, panelH, screenH),
    width: panelW,
  };
}

export const TutorialOverlay: React.FC = () => {
  const {
    isActive,
    currentStep,
    stepIndex,
    getTargetRect,
    nextStep,
    prevStep,
    skipTutorial,
    completeTutorial,
  } = useTutorial();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [isActive, stepIndex]);

  const highlight = useMemo(() => {
    if (!currentStep?.targetKey) return null;
    void tick;
    const raw = getTargetRect(currentStep.targetKey);
    if (!raw) return null;
    return paddedRect(raw);
  }, [currentStep?.targetKey, getTargetRect, tick]);

  const tooltipLayout = useMemo(() => {
    if (!currentStep) {
      return { left: TOOLTIP_MARGIN, top: TOOLTIP_MARGIN, width: TOOLTIP_MAX_W };
    }
    return computeTooltipLayout(currentStep, highlight, screenW, screenH);
  }, [currentStep, highlight, screenH, screenW]);

  if (!isActive || !currentStep) return null;

  const isLast = stepIndex >= TUTORIAL_STEPS.length - 1;
  const requiresClick = !!currentStep.requireTargetClick;

  return (
    <View
      style={[styles.root, Platform.OS === 'web' ? styles.rootWeb : null]}
      pointerEvents="box-none"
    >
      {highlight ? (
        <>
          <View
            style={[styles.shade, { left: 0, top: 0, width: screenW, height: highlight.y }]}
            pointerEvents="auto"
          />
          <View
            style={[
              styles.shade,
              {
                left: 0,
                top: highlight.y,
                width: highlight.x,
                height: highlight.height,
              },
            ]}
            pointerEvents="auto"
          />
          <View
            style={[
              styles.shade,
              {
                left: highlight.x + highlight.width,
                top: highlight.y,
                width: screenW - highlight.x - highlight.width,
                height: highlight.height,
              },
            ]}
            pointerEvents="auto"
          />
          <View
            style={[
              styles.shade,
              {
                left: 0,
                top: highlight.y + highlight.height,
                width: screenW,
                height: screenH - highlight.y - highlight.height,
              },
            ]}
            pointerEvents="auto"
          />
          <View
            style={[
              styles.ring,
              {
                left: highlight.x,
                top: highlight.y,
                width: highlight.width,
                height: highlight.height,
              },
            ]}
            pointerEvents="none"
          />
        </>
      ) : (
        <View style={[styles.fullShade]} pointerEvents="auto" />
      )}

      <View style={[styles.panel, tooltipLayout]} pointerEvents="auto">
        <Text style={styles.stepLabel}>
          Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
        </Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.body}</Text>

        {requiresClick ? (
          <Text style={styles.hint}>Tap the highlighted control to continue.</Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable onPress={skipTutorial} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <View style={styles.navRow}>
            {stepIndex > 0 ? (
              <Pressable onPress={prevStep} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.navSpacer} />
            )}
            {!requiresClick ? (
              <Pressable
                onPress={isLast ? completeTutorial : nextStep}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>{isLast ? 'Finish' : 'Next'}</Text>
              </Pressable>
            ) : (
              <View style={styles.navSpacer} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200000,
    elevation: 200000,
  },
  rootWeb: {
    position: 'fixed' as unknown as 'absolute',
  },
  fullShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  shade: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  ring: {
    position: 'absolute',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#F1C40F',
    shadowColor: '#F1C40F',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  panel: {
    position: 'absolute',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    gap: 8,
  },
  stepLabel: {
    color: 'rgba(241,196,15,0.75)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },
  body: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
  },
  hint: {
    color: 'rgba(241,196,15,0.9)',
    fontSize: 11,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  actions: {
    marginTop: 4,
    gap: 8,
  },
  skipBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  skipText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  navSpacer: {
    flex: 1,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#C0392B',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default TutorialOverlay;
