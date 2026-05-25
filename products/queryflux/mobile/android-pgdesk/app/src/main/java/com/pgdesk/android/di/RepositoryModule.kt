package com.pgdesk.android.di

import com.pgdesk.android.data.local.dao.*
import com.pgdesk.android.data.remote.ApiService
import com.pgdesk.android.data.repository.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideConnectionRepository(
        connectionDao: ConnectionDao,
        securityProfileDao: SecurityProfileDao,
        apiService: ApiService
    ): ConnectionRepository {
        return ConnectionRepositoryImpl(connectionDao, securityProfileDao, apiService)
    }

    @Provides
    @Singleton
    fun provideQueryRepository(
        queryHistoryDao: QueryHistoryDao,
        queryTemplateDao: QueryTemplateDao,
        cachedQueryDao: CachedQueryDao,
        apiService: ApiService
    ): QueryRepository {
        return QueryRepositoryImpl(queryHistoryDao, queryTemplateDao, cachedQueryDao, apiService)
    }

    @Provides
    @Singleton
    fun provideAIRepository(
        aiInsightDao: AIInsightDao,
        apiService: ApiService
    ): AIRepository {
        return AIRepositoryImpl(aiInsightDao, apiService)
    }

    @Provides
    @Singleton
    fun providePerformanceRepository(
        performanceMetricDao: PerformanceMetricDao,
        apiService: ApiService
    ): PerformanceRepository {
        return PerformanceRepositoryImpl(performanceMetricDao, apiService)
    }

    @Provides
    @Singleton
    fun provideUserPreferenceRepository(
        userPreferenceDao: UserPreferenceDao
    ): UserPreferenceRepository {
        return UserPreferenceRepositoryImpl(userPreferenceDao)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        userPreferenceDao: UserPreferenceDao
    ): AuthRepository {
        return AuthRepositoryImpl(userPreferenceDao)
    }
}