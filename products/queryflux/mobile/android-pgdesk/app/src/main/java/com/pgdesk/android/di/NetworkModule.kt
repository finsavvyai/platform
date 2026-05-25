package com.pgdesk.android.di

import android.content.Context
import com.pgdesk.android.BuildConfig
import com.pgdesk.android.data.remote.ApiService
import com.pgdesk.android.utils.NetworkConnectionInterceptor
import com.pgdesk.android.utils.AuthTokenInterceptor
import com.pgdesk.android.utils.CertificatePinningInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideHttpLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
    }

    @Provides
    @Singleton
    fun provideNetworkConnectionInterceptor(
        @ApplicationContext context: Context
    ): NetworkConnectionInterceptor {
        return NetworkConnectionInterceptor(context)
    }

    @Provides
    @Singleton
    fun provideAuthTokenInterceptor(
        @ApplicationContext context: Context
    ): AuthTokenInterceptor {
        return AuthTokenInterceptor(context)
    }

    @Provides
    @Singleton
    fun provideCertificatePinningInterceptor(): CertificatePinningInterceptor {
        return CertificatePinningInterceptor()
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        httpLoggingInterceptor: HttpLoggingInterceptor,
        networkConnectionInterceptor: NetworkConnectionInterceptor,
        authTokenInterceptor: AuthTokenInterceptor,
        certificatePinningInterceptor: CertificatePinningInterceptor
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(networkConnectionInterceptor)
            .addInterceptor(authTokenInterceptor)
            .addInterceptor(httpLoggingInterceptor)
            .addNetworkInterceptor(certificatePinningInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.AI_API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(
        retrofit: Retrofit
    ): ApiService {
        return retrofit.create(ApiService::class.java)
    }
}