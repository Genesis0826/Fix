import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { isValidEmail } from "../lib/utils";
import { Colors } from "../constants/colors";

export const ForgotPasswordScreen = ({ navigation }: any) => {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = isValidEmail(email) && !loading;

  async function onSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <View style={{ backgroundColor: Colors.bgApp }} className="flex-1 px-6 justify-center">
      <View className="rounded-2xl bg-white p-6 shadow-sm">
        {submitted ? (
          <View className="items-center py-4">
            <View style={{ backgroundColor: Colors.successLight }} className="h-16 w-16 rounded-full items-center justify-center mb-4">
              <Text className="text-3xl">✅</Text>
            </View>
            <Text style={{ color: Colors.textPrimary }} className="text-xl font-bold">Check your email</Text>
            <Text style={{ color: Colors.textMuted }} className="mt-2 text-sm text-center">
              If an account exists for{" "}
              <Text style={{ color: Colors.textPrimary }} className="font-semibold">{email}</Text>,
              a reset link has been sent.
            </Text>
            <Pressable
              style={{ backgroundColor: Colors.primary }}
              className="mt-6 rounded-xl px-6 py-3"
              onPress={() => navigation.replace("Login")}
            >
              <Text className="font-semibold text-white">Return to Login</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable className="mb-4" onPress={() => navigation.goBack()}>
              <Text style={{ color: Colors.primary }} className="text-sm font-semibold">← Back to Login</Text>
            </Pressable>

            <Text style={{ color: Colors.textPrimary }} className="text-2xl font-bold">Reset Password</Text>
            <Text style={{ color: Colors.textMuted }} className="mt-1 text-sm">
              Enter your email and we'll send reset instructions.
            </Text>

            <View className="mt-6">
              <Text style={{ color: Colors.textSecondary }} className="text-sm font-semibold">Email Address</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address"
                placeholder="name@company.com"
                placeholderTextColor={Colors.textPlaceholder}
                style={{ borderColor: Colors.border, color: Colors.textPrimary }}
                className="mt-2 rounded-xl border bg-white px-4 py-3"
              />
            </View>

            <Pressable
              style={{ backgroundColor: canSubmit ? Colors.primary : Colors.primaryDisabled }}
              className="mt-6 rounded-xl px-5 py-3"
              disabled={!canSubmit}
              onPress={onSubmit}
            >
              <Text className="text-center font-semibold text-white">
                {loading ? "Sending Link..." : "Send Reset Link →"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};
