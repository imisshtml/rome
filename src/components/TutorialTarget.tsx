import React, { useCallback, useEffect, useRef } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useTutorialOptional } from '../context/TutorialContext';

interface TutorialTargetProps {
  targetKey: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Registers a screen-space highlight region for the tutorial overlay. */
export const TutorialTarget: React.FC<TutorialTargetProps> = ({
  targetKey,
  children,
  style,
}) => {
  const tutorial = useTutorialOptional();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    if (!tutorial?.isActive) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        tutorial.registerTarget(targetKey, { x, y, width, height });
      }
    });
  }, [targetKey, tutorial]);

  useEffect(() => {
    if (!tutorial?.isActive) {
      tutorial?.unregisterTarget(targetKey);
      return;
    }
    measure();
    return () => tutorial.unregisterTarget(targetKey);
  }, [tutorial?.isActive, measure, targetKey, tutorial]);

  return (
    <View ref={ref} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
};

export default TutorialTarget;
