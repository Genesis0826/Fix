import React from "react";
import { View, Text } from "react-native";
import { Colors } from "../constants/colors";

type Props = {
  label: string;
  value: string;
  sub: string;
  trend: string;
  alert?: boolean;
};

export const MetricCard = ({ label, value, sub, trend, alert = false }: Props) => {
  return (
    <View className="flex-1 rounded-2xl bg-white p-4 shadow-sm min-h-[128px]">
      <View className="flex-row justify-between items-start mb-3">
        <View
          style={{ backgroundColor: alert ? Colors.dangerLight : Colors.primaryLight }}
          className="h-8 w-8 rounded-lg items-center justify-center"
        >
          <Text style={{ color: alert ? Colors.dangerText : Colors.primary }} className="text-xs font-bold">
            {alert ? "!" : "HR"}
          </Text>
        </View>

        {trend ? (
          <View
            style={{ backgroundColor: alert ? Colors.dangerLight : Colors.bgSubtle }}
            className="rounded-lg px-2 py-1"
          >
            <Text
              style={{ color: alert ? Colors.dangerText : Colors.textMuted }}
              className="text-[9px] font-bold uppercase"
            >
              {trend}
            </Text>
          </View>
        ) : (
          <View />
        )}
      </View>

      <Text style={{ color: Colors.textPlaceholder }} className="text-[9px] font-bold uppercase tracking-widest mb-1">
        {label}
      </Text>
      <Text style={{ color: Colors.textPrimary }} className="text-2xl font-bold">
        {value}
      </Text>
      <Text style={{ color: Colors.textMuted }} className="text-xs">
        {sub}
      </Text>
    </View>
  );
};
