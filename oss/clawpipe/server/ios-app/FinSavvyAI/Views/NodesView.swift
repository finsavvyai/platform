//
//  NodesView.swift
//  View for managing cluster worker nodes
//

import SwiftUI

struct NodesView: View {
    @EnvironmentObject var clusterManager: ClusterManager

    var body: some View {
        NavigationView {
            Group {
                if clusterManager.nodes.isEmpty && !clusterManager.isLoading {
                    emptyState
                } else {
                    nodesList
                }
            }
            .navigationTitle("Nodes")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        Task { await clusterManager.refreshData() }
                    }) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(clusterManager.isLoading)
                }
            }
        }
        .refreshable {
            await clusterManager.refreshData()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "server.rack")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No Nodes Found")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Worker nodes will appear here once they register with the cluster master.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            if let error = clusterManager.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(.top, 8)
            }

            Button("Refresh") {
                Task { await clusterManager.refreshData() }
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var nodesList: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Summary bar
                nodesSummary

                // Node cards
                ForEach(clusterManager.nodes) { node in
                    NodeCard(node: node)
                }
            }
            .padding()
        }
    }

    private var nodesSummary: some View {
        HStack(spacing: 20) {
            SummaryPill(
                label: "Total",
                value: "\(clusterManager.nodes.count)",
                color: .blue
            )
            SummaryPill(
                label: "Online",
                value: "\(clusterManager.nodes.filter { $0.isOnline }.count)",
                color: .green
            )
            SummaryPill(
                label: "Offline",
                value: "\(clusterManager.nodes.filter { !$0.isOnline }.count)",
                color: .red
            )
            Spacer()
        }
    }
}

// MARK: - Supporting Views

struct SummaryPill: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(color.opacity(0.1))
        .cornerRadius(10)
    }
}

struct NodeCard: View {
    let node: ClusterNode

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Circle()
                    .fill(node.isOnline ? Color.green : Color.red)
                    .frame(width: 10, height: 10)

                Text(node.displayName)
                    .font(.headline)

                Spacer()

                Text(node.status.uppercased())
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(node.isOnline ? .green : .red)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background((node.isOnline ? Color.green : Color.red).opacity(0.15))
                    .cornerRadius(6)
            }

            Divider()

            // Details grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                NodeDetailItem(label: "Host", value: node.host)
                NodeDetailItem(label: "Port", value: "\(node.port)")
                NodeDetailItem(label: "Load", value: "\(Int(node.loadPercent))%")
                NodeDetailItem(label: "Requests", value: "\(node.requestCount ?? 0)")
            }

            // Models
            if !node.models.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    Text("Models")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    FlowLayout(spacing: 6) {
                        ForEach(node.models, id: \.self) { model in
                            Text(model)
                                .font(.caption2)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.blue.opacity(0.15))
                                .foregroundColor(.blue)
                                .cornerRadius(6)
                        }
                    }
                }
            }

            // Heartbeat
            if let heartbeat = node.lastHeartbeat {
                HStack {
                    Image(systemName: "heart.fill")
                        .font(.caption2)
                        .foregroundColor(.pink)
                    Text("Last heartbeat: \(timeAgo(from: heartbeat))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(node.displayName), \(node.status)")
    }

    private func timeAgo(from dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        // Try with fractional seconds first, then without
        guard
            let date = formatter.date(from: dateString)
                ?? ISO8601DateFormatter().date(from: dateString)
        else {
            return "Unknown"
        }

        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "Just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        return "\(Int(interval / 3600))h ago"
    }
}

struct NodeDetailItem: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

// Simple flow layout for model tags
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = layout(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(
        in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
    ) {
        let result = layout(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified)
        }
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> (
        size: CGSize, positions: [CGPoint]
    ) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return (CGSize(width: maxWidth, height: y + rowHeight), positions)
    }
}

#Preview {
    NodesView()
        .environmentObject(ClusterManager())
}
