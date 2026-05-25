package com.pgdesk.android.data.local

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import android.content.Context
import com.pgdesk.android.data.local.dao.*
import com.pgdesk.android.data.local.entity.*

@Database(
    entities = [
        DatabaseConnection::class,
        QueryHistory::class,
        QueryTemplate::class,
        PerformanceMetric::class,
        AIInsight::class,
        UserPreference::class,
        CachedQuery::class,
        SecurityProfile::class
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {

    abstract fun connectionDao(): ConnectionDao
    abstract fun queryHistoryDao(): QueryHistoryDao
    abstract fun queryTemplateDao(): QueryTemplateDao
    abstract fun performanceMetricDao(): PerformanceMetricDao
    abstract fun aiInsightDao(): AIInsightDao
    abstract fun userPreferenceDao(): UserPreferenceDao
    abstract fun cachedQueryDao(): CachedQueryDao
    abstract fun securityProfileDao(): SecurityProfileDao

    companion object {
        const val DATABASE_NAME = "pgdesk_database"

        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    DATABASE_NAME
                )
                    .enableMultiInstanceInvalidation()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}