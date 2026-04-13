import React from "react";
import { View, Text } from "react-native";
import { UserRole } from "../services/auth";
import { SEARCH_PLACEHOLDERS } from "../constants/config";
import { Colors } from "../constants/colors";
import { getInitial } from "../lib/utils";

type Props = {
  role: UserRole;
  userName: string;
};

export const Header = ({ role, userName }: Props) => {
  const initial = getInitial(userName);

  return (
    <View
      style={{ borderBottomColor: Colors.border }}
      className="bg-white px-4 pt-4 pb-3 flex-row items-center justify-between border-b"
    >
      {/* Search Bar */}
      <View className="flex-1 mr-3">
        <View
          style={{ borderColor: Colors.border, backgroundColor: Colors.bgMuted }}
          className="rounded-xl border px-3 py-2.5"
        >
          <Text style={{ color: Colors.textPlaceholder }} className="text-xs">
            {SEARCH_PLACEHOLDERS[role]}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-3">
        {/* Notification Bell */}
        <View className="relative">
          <View style={{ backgroundColor: Colors.primaryLight }} className="h-9 w-9 rounded-full items-center justify-center">
            <Text>🔔</Text>
          </View>
          <View
            style={{ backgroundColor: Colors.danger, borderColor: Colors.bgCard }}
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
          />
        </View>

        {/* Avatar */}
        <View style={{ backgroundColor: Colors.primary }} className="h-9 w-9 rounded-full items-center justify-center">
          <Text className="text-white font-bold text-sm">{initial}</Text>
        </View>
      </View>
    </View>
  );
};
