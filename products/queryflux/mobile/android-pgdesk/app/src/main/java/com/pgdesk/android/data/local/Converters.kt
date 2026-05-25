package com.pgdesk.android.data.local

import androidx.room.TypeConverter
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.pgdesk.android.data.local.entity.QueryParameter
import java.util.Date

class Converters {
    private val gson = Gson()

    @TypeConverter
    fun fromTimestamp(value: Long?): Date? {
        return value?.let { Date(it) }
    }

    @TypeConverter
    fun dateToTimestamp(date: Date?): Long? {
        return date?.time
    }

    @TypeConverter
    fun fromStringList(value: List<String>?): String {
        return gson.toJson(value ?: emptyList<String>())
    }

    @TypeConverter
    fun toStringList(value: String): List<String> {
        val listType = object : TypeToken<List<String>>() {}.type
        return gson.fromJson(value, listType) ?: emptyList()
    }

    @TypeConverter
    fun fromQueryParameterList(value: List<QueryParameter>?): String {
        return gson.toJson(value ?: emptyList<QueryParameter>())
    }

    @TypeConverter
    fun toQueryParameterList(value: String): List<QueryParameter> {
        val listType = object : TypeToken<List<QueryParameter>>() {}.type
        return gson.fromJson(value, listType) ?: emptyList()
    }

    @TypeConverter
    fun fromStringMap(value: Map<String, String>?): String {
        return gson.toJson(value ?: emptyMap<String, String>())
    }

    @TypeConverter
    fun toStringMap(value: String): Map<String, String> {
        val mapType = object : TypeToken<Map<String, String>>() {}.type
        return gson.fromJson(value, mapType) ?: emptyMap()
    }

    @TypeConverter
    fun fromAnyMap(value: Map<String, Any>?): String {
        return gson.toJson(value ?: emptyMap<String, Any>())
    }

    @TypeConverter
    fun toAnyMap(value: String): Map<String, Any> {
        val mapType = object : TypeToken<Map<String, Any>>() {}.type
        return gson.fromJson(value, mapType) ?: emptyMap()
    }
}