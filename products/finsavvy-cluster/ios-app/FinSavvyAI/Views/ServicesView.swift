//
//  ServicesView.swift
//  View for managing FinSavvyAI services
//

import SwiftUI

struct ServicesView: View {
    @EnvironmentObject var clusterManager: ClusterManager
    @State private var showingAlert = false
    @State private var alertMessage = ""
    @State private var alertTitle = ""

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Services Overview
                    servicesOverview

                    // Service Controls
                    serviceControls

                    // Service Details
                    serviceDetails
                }
                .padding()
            }
            .navigationTitle("Services")
        }
        .refreshable {
            Task {
                await clusterManager.refreshData()
            }
        }
        .alert(alertTitle, isPresented: $showingAlert) {
            Button("OK") {}
        } message: {
            Text(alertMessage)
        }
    }

    private var servicesOverview: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Cluster Services")
                .font(.headline)
                .foregroundColor(.primary)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                ForEach(clusterManager.services) { service in
                    ServiceCard(service: service)
                }
            }
        }
    }

    private var serviceControls: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Service Management")
                .font(.headline)
                .foregroundColor(.primary)

            HStack(spacing: 12) {
                Button(action: {
                    Task {
                        await startAllServices()
                    }
                }) {
                    Label("Start All", systemImage: "play.circle.fill")
                }
                .buttonStyle(.borderedProminent)

                Button(action: {
                    Task {
                        await stopAllServices()
                    }
                }) {
                    Label("Stop All", systemImage: "stop.circle.fill")
                }
                .buttonStyle(.bordered)

                Spacer()
            }

            HStack(spacing: 12) {
                Button("Start Master") {
                    Task {
                        await clusterManager.startService("master")
                    }
                }
                .buttonStyle(.bordered)

                Button("Start Worker") {
                    Task {
                        await clusterManager.startService("worker")
                    }
                }
                .buttonStyle(.bordered)

                Spacer()
            }
        }
    }

    private var serviceDetails: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Service Details")
                .font(.headline)
                .foregroundColor(.primary)

            ForEach(clusterManager.services) { service in
                ServiceDetailRow(service: service)
            }
        }
    }

    private func startAllServices() async {
        do {
            let masterSuccess = try await clusterManager.apiService.startService(service: "master")
            let workerSuccess = try await clusterManager.apiService.stopService(service: "worker")

            if masterSuccess && workerSuccess {
                showAlert(title: "Success", message: "All services started successfully")
            } else {
                showAlert(title: "Partial Success", message: "Some services may not have started")
            }

            await clusterManager.refreshData()
        } catch {
            showAlert(title: "Error", message: error.localizedDescription)
        }
    }

    private func stopAllServices() async {
        do {
            let masterSuccess = try await clusterManager.apiService.stopService(service: "master")
            let workerSuccess = try await clusterManager.apiService.stopService(service: "worker")

            if masterSuccess && workerSuccess {
                showAlert(title: "Success", message: "All services stopped successfully")
            } else {
                showAlert(title: "Partial Success", message: "Some services may not have stopped")
            }

            await clusterManager.refreshData()
        } catch {
            showAlert(title: "Error", message: error.localizedDescription)
        }
    }

    private func showAlert(title: String, message: String) {
        alertTitle = title
        alertMessage = message
        showingAlert = true
    }
}

struct ServiceCard: View {
    let service: ServiceStatus

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: serviceIcon)
                    .foregroundColor(statusColor)
                    .font(.title2)

                VStack(alignment: .leading) {
                    Text(service.service)
                        .font(.headline)
                        .foregroundColor(.primary)

                    Text(service.status)
                        .font(.subheadline)
                        .foregroundColor(statusColor)
                }

                Spacer()
            }

            Divider()

            HStack {
                DetailRow(title: "Port", value: service.port)
                Spacer()
            }

            HStack {
                DetailRow(title: "Endpoint", value: service.endpoint)
                    .lineLimit(1)
                Spacer()
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var serviceIcon: String {
        switch service.service.lowercased() {
        case "master":
            return "cpu"
        case "worker":
            return "server.rack"
        default:
            return "gear.circle"
        }
    }

    private var statusColor: Color {
        if service.status.contains("RUNNING") {
            return .green
        } else if service.status.contains("STOPPED") {
            return .red
        } else {
            return .orange
        }
    }
}

struct ServiceDetailRow: View {
    let service: ServiceStatus

    var body: some View {
        HStack {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 4) {
                Text(service.service)
                    .font(.subheadline)
                    .fontWeight(.medium)

                HStack {
                    Text("Port \(service.port)")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text(statusText)
                        .font(.caption)
                        .foregroundColor(statusColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(statusColor.opacity(0.2))
                        .cornerRadius(4)
                }
            }

            Spacer()

            ChevronRight()
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }

    private var statusColor: Color {
        if service.status.contains("RUNNING") {
            return .green
        } else if service.status.contains("STOPPED") {
            return .red
        } else {
            return .orange
        }
    }

    private var statusText: String {
        if service.status.contains("RUNNING") {
            return "ONLINE"
        } else if service.status.contains("STOPPED") {
            return "OFFLINE"
        } else {
            return service.status
        }
    }
}

struct DetailRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .foregroundColor(.secondary)
                .font(.caption)

            Spacer()

            Text(value)
                .foregroundColor(.primary)
                .font(.caption)
        }
    }
}

#Preview {
    ServicesView()
        .environmentObject(ClusterManager())
}
