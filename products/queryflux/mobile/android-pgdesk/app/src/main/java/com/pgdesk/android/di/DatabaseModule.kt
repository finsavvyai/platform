package com.pgdesk.android.di

import android.content.Context
import androidx.room.Room
import com.pgdesk.android.data.local.AppDatabase
import com.pgdesk.android.data.local.dao.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            AppDatabase.DATABASE_NAME
        )
            .enableMultiInstanceInvalidation()
            .fallbackToDestructiveMigration() // For development, use proper migrations in production
            .build()
    }

    @Provides
    fun provideConnectionDao(database: AppDatabase): ConnectionDao {
        return database.connectionDao()
    }

    @Provides
    fun provideQueryHistoryDao(database: AppDatabase): QueryHistoryDao {
        return database.queryHistoryDao()
    }

    @Provides
    fun provideQueryTemplateDao(database: AppDatabase): QueryTemplateDao {
        return database.queryTemplateDao()
    }

    @Provides
    fun providePerformanceMetricDao(database: AppDatabase): PerformanceMetricDao {
        return database.performanceMetricDao()
    }

    @Provides
    fun provideAIInsightDao(database: AppDatabase): AIInsightDao {
        return database.aiInsightDao()
    }

    @Provides
    fun provideUserPreferenceDao(database: AppDatabase): UserPreferenceDao {
        return database.userPreferenceDao()
    }

    @Provides
    fun provideCachedQueryDao(database: AppDatabase): CachedQueryDao {
        return database.cachedQueryDao()
    }

    @Provides
    fun provideSecurityProfileDao(database: AppDatabase): SecurityProfileDao {
        return database.securityProfileDao()
    }
}