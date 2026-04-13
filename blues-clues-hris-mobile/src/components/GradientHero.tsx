import React from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Matches web: linear-gradient(135deg, #0f172a 0%, #172554 52%, #134e4a 100%)
const GRADIENT_COLORS: [string, string, string] = ["#0f172a", "#172554", "#134e4a"];
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END   = { x: 1, y: 1 };

type Props = {
  readonly children: React.ReactNode;
  readonly style?: ViewStyle;
  readonly borderRadius?: number;
  readonly padding?: number;
};

export function GradientHero({ children, style, borderRadius = 20, padding = 20 }: Props) {
  return (
    <LinearGradient
      colors={GRADIENT_COLORS}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.base, { borderRadius, padding }, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    marginBottom: 16,
    overflow: "hidden",
  },
});
