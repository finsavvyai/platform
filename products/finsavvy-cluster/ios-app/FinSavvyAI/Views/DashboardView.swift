//
//  DashboardView.swift
//  Main dashboard showing cluster overview
//

import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var clusterManager: ClusterManager

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Status Card
                    statusCard

                    // Quick Stats
                    quickStatsGrid

                    // Recent Activity
                    recentActivitySection

                    // Quick Actions
                    quickActionsSection
                }
                .padding()
            }
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        Task {
                            await clusterManager.refreshData()
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(clusterManager.isLoading)
                }
            }
        }
        .refreshable {
            Task {
                await clusterManager.refreshData()
            }
        }
        .overlay {
            if clusterManager.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.1))
            }
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(
                    systemName: clusterManager.isConnected
                        ? "checkmark.circle.fill" : "xmark.circle.fill"
                )
                .foregroundColor(clusterManager.isConnected ? .green : .red)
                .font(.title2)

                VStack(alignment: .leading) {
                    Text("FinSavvyAI Cluster")
                        .font(.headline)
                        .foregroundColor(.primary)

                    Text(clusterManager.isConnected ? "Connected" : "Disconnected")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            if let status = clusterManager.clusterStatus {
                Divider()

                HStack {
                    StatItem(title: "Nodes", value: "\(status.onlineNodes)/\(status.totalNodes)")
                    Spacer()
                    StatItem(title: "Status", value: status.status)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var quickStatsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
            StatCard(
                title: "Online Nodes",
                value: "\(clusterManager.nodes.filter { $0.status == "online" }.count)",
                icon: "server.rack",
                color: .green
            )

            StatCard(
                title: "Total Models",
                value: "\(clusterManager.nodes.flatMap { $0.models }.count)",
                icon: "brain.head.profile",
                color: .blue
            )

            StatCard(
                title: "Services",
                value: "\(clusterManager.services.filter { $0.status.contains("RUNNING") }.count)",
                icon: "gear.circle",
                color: .orange
            )

            StatCard(
                title: "Load Average",
                value: calculateAverageLoad(),
                icon: "speedometer",
                color: .purple
            )
        }
    }

    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.headline)
                .foregroundColor(.primary)

            if clusterManager.nodes.isEmpty {
                Text("No activity detected")
                    .foregroundColor(.secondary)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
            } else {
                ForEach(clusterManager.nodes.prefix(3)) { node in
                    ActivityRow(node: node)
                }
            }
        }
    }

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
                .foregroundColor(.primary)

            HStack(spacing: 12) {
                Button("Refresh") {
                    Task {
                        await clusterManager.refreshData()
                    }
                }
                .buttonStyle(.bordered)

                Button("Start All") {
                    Task {
                        await clusterManager.startService("all")
                    }
                }
                .buttonStyle(.bordered)

                Button("Stop All") {
                    Task {
                        await clusterManager.stopService("all")
                    }
                }
                .buttonStyle(.bordered)

                Spacer()
            }
        }
    }

    private func calculateAverageLoad() -> String {
        let loads = clusterManager.nodes.compactMap { node -> Double? in
            let parts = node.load.split(separator: "/")
            guard parts.count == 2,
                let current = Double(parts[0]),
                let max = Double(parts[1])
            else { return nil }
            return (current / max) * 100
        }

        guard !loads.isEmpty else { return "0%" }
        let average = loads.reduce(0, +) / Double(loads.count)
        return String(format: "%.0f%%", average)
    }
}

struct StatItem: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(value)
                .font(.headline)
                .foregroundColor(.primary)
        }
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title2)

                Spacer()
            }

            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.primary)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct ActivityRow: View {
    let node: ClusterNode

    var body: some View {
        HStack {
            Circle()
                .fill(node.status == "online" ? Color.green : Color.red)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(node.name)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text("Load: \(node.load)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text(timeAgo(from: node.lastHeartbeat))
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
        .padding(.horizontal)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }

    private func timeAgo(from dateString: String?) -> String {
        guard let dateString = dateString else { return "Never" }

        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: dateString) else { return "Unknown" }

        let interval = Date().timeIntervalSince(date)

        if interval < 60 {
            return "Just now"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else {
            return "\(Int(interval / 3600))h ago"
        }
    }
}

#Preview {
    DashboardView()
        .environmentObject(ClusterManager())
}
