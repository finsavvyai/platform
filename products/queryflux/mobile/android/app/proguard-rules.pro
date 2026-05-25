# Add project specific ProGuard rules here.

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep custom exceptions
-keep public class * extends java.lang.Exception

# Keep model classes
-keep class com.queryflux.mobile.models.** { *; }
-keep class com.queryflux.mobile.dto.** { *; }

# Keep Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**

# Keep OkHttp
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**

# Keep Gson
-keep class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**

# Keep WebRTC
-keep class org.webrtc.** { *; }
-keep class com.twilio.** { *; }
-dontwarn org.webrtc.**

# Keep React Native packages
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.reactnativecommunity.netinfo.** { *; }
-keep class com.reactnativecommunity.clipboard.** { *; }

# Keep vector libraries
-keep class org.apache.commons.** { *; }
-keep class org.bouncycastle.** { *; }
-dontwarn org.apache.commons.**
-dontwarn org.bouncycastle.**

# Keep SQLCipher
-keep class net.sqlcipher.** { *; }
-dontwarn net.sqlcipher.**

# Keep Biometric
-keep class androidx.biometric.** { *; }
-dontwarn androidx.biometric.**

# Keep ChartKit
-keep class com.github.mikephil.charting.** { *; }
-dontwarn com.github.mikephil.charting.**

# Keep SVG library
-keep class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**

# Keep Linear Gradient
-keep class com.BV.LinearGradient.** { *; }
-dontwarn com.BV.LinearGradient.**

# Keep Haptics
-keep class com.horcrux.haptic.** { *; }
-dontwarn com.horcrux.haptic.**

# Keep Vector Icons
-keep class com.reactnativecommunity.vector.** { *; }
-dontwarn com.reactnativecommunity.vector.**

# Keep permissions
-keep class com.reactnativecommunity.permissions.** { *; }
-dontwarn com.reactnativecommunity.permissions.**

# Keep keychain
-keep class com.oblador.keychain.** { *; }
-dontwarn com.oblador.keychain.**

# Keep device info
-keep class com.learnium.RNDeviceInfo.** { *; }
-dontwarn com.learnium.RNDeviceInfo.**

# Keep background services
-keep class com.asterinet.react.bgactions.** { *; }
-dontwarn com.asterinet.react.bgactions.**

# Keep file system
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-dontwarn com.reactnativecommunity.asyncstorage.**

# Keep push notifications
-keep class com.dieam.reactnativepushnotification.** { *; }
-dontwarn com.dieam.reactnativepushnotification.**

# Optimization
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-keep public class com.mopub.** { *; }
-dontwarn com.mopub.**

# Keep JSI interface
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.bridge.** { *; }

# Keep Hermes
-keep class com.facebook.hermes.** { *; }

# Keep Flipper in debug
-keep class com.facebook.flipper.** { *; }
-keep class com.facebook.flipper.plugins.** { *; }

# Native code
-keepclasseswithmembernames class * {
    native <methods>;
}

# R8 full mode
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

# Retrofit and OkHttp
-keepattributes Signature
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface <1>

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Gson
-keepattributes Signature
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Platform specific
-keep class androidx.appcompat.** { *; }
-keep class androidx.core.** { *; }
-keep class androidx.lifecycle.** { *; }
-keep class com.google.android.material.** { *; }

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# Keep test models
-keep class **_Test { *; }
-keep class **_Mock { *; }