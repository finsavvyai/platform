package com.pgdesk.android

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import androidx.work.WorkManager
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class PGDeskApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override fun onCreate() {
        super.onCreate()

        // Initialize WorkManager with Hilt
        WorkManager.initialize(
            this,
            Configuration.Builder()
                .setWorkerFactory(workerFactory)
                .build()
        )

        createNotificationChannels()
    }

    override fun getWorkManagerConfiguration() =
        Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            // Database monitoring channel
            val monitoringChannel = NotificationChannel(
                MONITORING_CHANNEL_ID,
                "Database Monitoring",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for database health and performance alerts"
            }

            // Query execution channel
            val queryChannel = NotificationChannel(
                QUERY_CHANNEL_ID,
                "Query Execution",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifications for long-running query operations"
            }

            // AI processing channel
            val aiChannel = NotificationChannel(
                AI_CHANNEL_ID,
                "AI Processing",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifications for AI-powered analysis and insights"
            }

            // Background sync channel
            val syncChannel = NotificationChannel(
                SYNC_CHANNEL_ID,
                "Background Sync",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifications for data synchronization"
            }

            notificationManager.createNotificationChannels(
                listOf(monitoringChannel, queryChannel, aiChannel, syncChannel)
            )
        }
    }

    companion object {
        const val MONITORING_CHANNEL_ID = "monitoring_channel"
        const val QUERY_CHANNEL_ID = "query_channel"
        const val AI_CHANNEL_ID = "ai_channel"
        const val SYNC_CHANNEL_ID = "sync_channel"
    }
}