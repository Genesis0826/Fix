import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from "react-native";

export type TimekeepingLog = {
  id: string;
  employeeName: string;
  date: string;
  timeIn: string;
  timeOut: string;
  totalHours: string;
  status: "Present" | "Late" | "Undertime" | "Absent" | "On Leave";
};

type Props = {
  readonly logs: TimekeepingLog[];
  readonly title?: string;
  readonly subtitle?: string;
};

const FILTER_OPTIONS = [
  "All",
  "Present",
  "Late",
  "Undertime",
  "Absent",
  "On Leave",
] as const;

type FilterOption = (typeof FILTER_OPTIONS)[number];

export function TimekeepingTable({ logs, title, subtitle }: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterOption>("All");

  const filteredLogs = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch =
        keyword.length === 0 ||
        log.employeeName.toLowerCase().includes(keyword) ||
        log.date.toLowerCase().includes(keyword) ||
        log.status.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "All" || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [logs, searchValue, statusFilter]);

  const getStatusStyle = (status: TimekeepingLog["status"]) => {
    switch (status) {
      case "Present":
        return {
          backgroundColor: "#DCFCE7",
          borderColor: "#BBF7D0",
          textColor: "#166534",
        };
      case "Late":
        return {
          backgroundColor: "#FEF3C7",
          borderColor: "#FDE68A",
          textColor: "#92400E",
        };
      case "Undertime":
        return {
          backgroundColor: "#FEE2E2",
          borderColor: "#FECACA",
          textColor: "#B91C1C",
        };
      case "On Leave":
        return {
          backgroundColor: "#DBEAFE",
          borderColor: "#BFDBFE",
          textColor: "#1D4ED8",
        };
      case "Absent":
      default:
        return {
          backgroundColor: "#E5E7EB",
          borderColor: "#D1D5DB",
          textColor: "#374151",
        };
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>{title || "Timekeeping Logs"}</Text>
        <Text style={styles.subtitle}>
          {subtitle || "Monitor daily employee attendance and time records."}
        </Text>
      </View>

      <View style={styles.filterCard}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by employee, date, or status"
          placeholderTextColor="#94A3B8"
          value={searchValue}
          onChangeText={setSearchValue}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = statusFilter === option;

            return (
              <Pressable
                key={option}
                onPress={() => setStatusFilter(option)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isMobile ? (
        <View>
          {filteredLogs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No logs found</Text>
              <Text style={styles.emptySubtitle}>
                Try changing the search or filter.
              </Text>
            </View>
          ) : (
            filteredLogs.map((log) => {
              const statusStyle = getStatusStyle(log.status);

              return (
                <View key={log.id} style={styles.mobileCard}>
                  <View style={styles.mobileHeader}>
                    <View style={styles.mobileHeaderText}>
                      <Text style={styles.mobileName}>{log.employeeName}</Text>
                      <Text style={styles.mobileDate}>{log.date}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusStyle.backgroundColor,
                          borderColor: statusStyle.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: statusStyle.textColor },
                        ]}
                      >
                        {log.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mobileInfoRow}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Time In</Text>
                      <Text style={styles.infoValue}>{log.timeIn}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Time Out</Text>
                      <Text style={styles.infoValue}>{log.timeOut}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Total Hours</Text>
                      <Text style={styles.infoValue}>{log.totalHours}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.desktopCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, styles.nameCol]}>
                  Employee / Group Head
                </Text>
                <Text style={[styles.headerCell, styles.dateCol]}>Date</Text>
                <Text style={[styles.headerCell, styles.timeCol]}>Time In</Text>
                <Text style={[styles.headerCell, styles.timeCol]}>Time Out</Text>
                <Text style={[styles.headerCell, styles.hoursCol]}>
                  Total Hours
                </Text>
                <Text style={[styles.headerCell, styles.statusCol]}>
                  Status
                </Text>
              </View>

              {filteredLogs.length === 0 ? (
                <View style={styles.emptyTableBox}>
                  <Text style={styles.emptyTitle}>No logs found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try changing the search or filter.
                  </Text>
                </View>
              ) : (
                filteredLogs.map((log, index) => {
                  const statusStyle = getStatusStyle(log.status);

                  return (
                    <View
                      key={log.id}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 && styles.altRow,
                      ]}
                    >
                      <Text style={[styles.bodyCell, styles.nameCol]}>
                        {log.employeeName}
                      </Text>
                      <Text style={[styles.bodyCell, styles.dateCol]}>
                        {log.date}
                      </Text>
                      <Text style={[styles.bodyCell, styles.timeCol]}>
                        {log.timeIn}
                      </Text>
                      <Text style={[styles.bodyCell, styles.timeCol]}>
                        {log.timeOut}
                      </Text>
                      <Text style={[styles.bodyCell, styles.hoursCol]}>
                        {log.totalHours}
                      </Text>
                      <View style={[styles.statusCol, styles.statusCell]}>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: statusStyle.backgroundColor,
                              borderColor: statusStyle.borderColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              { color: statusStyle.textColor },
                            ]}
                          >
                            {log.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  headerBlock: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  filterCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  filterRow: {
    paddingTop: 12,
    paddingBottom: 2,
  },
  filterChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  mobileCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  mobileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  mobileHeaderText: {
    flex: 1,
    paddingRight: 10,
  },
  mobileName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  mobileDate: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  mobileInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoBox: {
    minWidth: 90,
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginRight: 10,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "800",
  },
  desktopCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerCell: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    backgroundColor: "#FFFFFF",
  },
  altRow: {
    backgroundColor: "#FCFDFE",
  },
  bodyCell: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  nameCol: {
    width: 240,
  },
  dateCol: {
    width: 130,
  },
  timeCol: {
    width: 110,
  },
  hoursCol: {
    width: 120,
  },
  statusCol: {
    width: 140,
  },
  statusCell: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTableBox: {
    paddingVertical: 40,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },
});