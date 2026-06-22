import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LayoutRectangle } from 'react-native';
import {
  FIRST_ACTIVE_STEP_INDEX,
  TUTORIAL_STEPS,
  TutorialStep,
} from '../tutorial/tutorialSteps';
import {
  isTutorialCompleted,
  markTutorialCompleted,
} from '../tutorial/tutorialStorage';

export type TutorialTargetRect = LayoutRectangle;

interface TutorialContextValue {
  isActive: boolean;
  isCompleted: boolean;
  stepIndex: number;
  currentStep: TutorialStep | null;
  pendingActivePhase: boolean;
  startTutorial: () => void;
  completeTutorial: () => void;
  skipTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  registerTarget: (key: string, rect: TutorialTargetRect) => void;
  unregisterTarget: (key: string) => void;
  getTargetRect: (key: string) => TutorialTargetRect | null;
  notifyTargetClicked: (key: string) => boolean;
  requestActivePhaseResume: () => void;
  resumeActivePhase: () => void;
  isTargetClickRequired: (key: string) => boolean;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(isTutorialCompleted);
  const [stepIndex, setStepIndex] = useState(0);
  const [pendingActivePhase, setPendingActivePhase] = useState(false);
  const targetsRef = useRef<Map<string, TutorialTargetRect>>(new Map());
  const [, bumpTargets] = useState(0);

  const currentStep = isActive ? TUTORIAL_STEPS[stepIndex] ?? null : null;

  const finish = useCallback(() => {
    markTutorialCompleted();
    setIsCompleted(true);
    setIsActive(false);
    setPendingActivePhase(false);
    setStepIndex(0);
  }, []);

  const startTutorial = useCallback(() => {
    if (isTutorialCompleted()) return;
    setIsActive(true);
    setStepIndex(0);
    setPendingActivePhase(false);
  }, []);

  const completeTutorial = useCallback(() => {
    finish();
  }, [finish]);

  const skipTutorial = useCallback(() => {
    finish();
  }, [finish]);

  const nextStep = useCallback(() => {
    setStepIndex((idx) => {
      const step = TUTORIAL_STEPS[idx];
      if (step?.requireTargetClick) return idx;
      if (idx >= TUTORIAL_STEPS.length - 1) {
        finish();
        return idx;
      }
      return idx + 1;
    });
  }, [finish]);

  const prevStep = useCallback(() => {
    setStepIndex((idx) => Math.max(0, idx - 1));
  }, []);

  const registerTarget = useCallback((key: string, rect: TutorialTargetRect) => {
    targetsRef.current.set(key, rect);
    bumpTargets((n) => n + 1);
  }, []);

  const unregisterTarget = useCallback((key: string) => {
    targetsRef.current.delete(key);
    bumpTargets((n) => n + 1);
  }, []);

  const getTargetRect = useCallback((key: string) => {
    return targetsRef.current.get(key) ?? null;
  }, []);

  const isTargetClickRequired = useCallback(
    (key: string) => {
      if (!isActive || !currentStep?.requireTargetClick) return false;
      return currentStep.targetKey === key;
    },
    [isActive, currentStep]
  );

  const notifyTargetClicked = useCallback(
    (key: string) => {
      if (!isActive || !currentStep?.requireTargetClick) return false;
      if (currentStep.targetKey !== key) return false;
      if (currentStep.id === 'start-game') {
        setPendingActivePhase(true);
        return true;
      }
      nextStep();
      return true;
    },
    [isActive, currentStep, nextStep]
  );

  const requestActivePhaseResume = useCallback(() => {
    setPendingActivePhase(true);
  }, []);

  const resumeActivePhase = useCallback(() => {
    if (!isActive || !pendingActivePhase) return;
    if (FIRST_ACTIVE_STEP_INDEX >= 0) {
      setStepIndex(FIRST_ACTIVE_STEP_INDEX);
    }
    setPendingActivePhase(false);
  }, [isActive, pendingActivePhase]);

  const value = useMemo(
    (): TutorialContextValue => ({
      isActive,
      isCompleted,
      stepIndex,
      currentStep,
      pendingActivePhase,
      startTutorial,
      completeTutorial,
      skipTutorial,
      nextStep,
      prevStep,
      registerTarget,
      unregisterTarget,
      getTargetRect,
      notifyTargetClicked,
      requestActivePhaseResume,
      resumeActivePhase,
      isTargetClickRequired,
    }),
    [
      isActive,
      isCompleted,
      stepIndex,
      currentStep,
      pendingActivePhase,
      startTutorial,
      completeTutorial,
      skipTutorial,
      nextStep,
      prevStep,
      registerTarget,
      unregisterTarget,
      getTargetRect,
      notifyTargetClicked,
      requestActivePhaseResume,
      resumeActivePhase,
      isTargetClickRequired,
    ]
  );

  return (
    <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>
  );
};

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return ctx;
}

export function useTutorialOptional(): TutorialContextValue | null {
  return useContext(TutorialContext);
}
