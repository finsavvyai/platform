package com.pgdesk.android.data.local.dao

import androidx.room.*
import com.pgdesk.android.data.local.entity.DatabaseConnection
import kotlinx.coroutines.flow.Flow
import java.util.Date

@Dao
interface ConnectionDao {

    @Query("SELECT * FROM database_connections ORDER BY lastConnected DESC, name ASC")
    fun getAllConnections(): Flow<List<DatabaseConnection>>

    @Query("SELECT * FROM database_connections WHERE isFavorite = 1 ORDER BY name ASC")
    fun getFavoriteConnections(): Flow<List<DatabaseConnection>>

    @Query("SELECT * FROM database_connections WHERE environment = :environment ORDER BY name ASC")
    fun getConnectionsByEnvironment(environment: String): Flow<List<DatabaseConnection>>

    @Query("SELECT * FROM database_connections WHERE id = :id")
    suspend fun getConnectionById(id: String): DatabaseConnection?

    @Query("SELECT * FROM database_connections WHERE isActive = 1 LIMIT 1")
    suspend fun getActiveConnection(): DatabaseConnection?

    @Query("SELECT COUNT(*) FROM database_connections")
    suspend fun getConnectionCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertConnection(connection: DatabaseConnection)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertConnections(connections: List<DatabaseConnection>)

    @Update
    suspend fun updateConnection(connection: DatabaseConnection)

    @Delete
    suspend fun deleteConnection(connection: DatabaseConnection)

    @Query("DELETE FROM database_connections WHERE id = :id")
    suspend fun deleteConnectionById(id: String)

    @Query("UPDATE database_connections SET isActive = 0")
    suspend fun deactivateAllConnections()

    @Query("UPDATE database_connections SET isActive = 1 WHERE id = :id")
    suspend fun activateConnection(id: String)

    @Query("UPDATE database_connections SET lastConnected = :timestamp WHERE id = :id")
    suspend fun updateLastConnected(id: String, timestamp: Date = Date())

    @Query("UPDATE database_connections SET isFavorite = :isFavorite WHERE id = :id")
    suspend fun updateFavoriteStatus(id: String, isFavorite: Boolean)

    @Query("SELECT * FROM database_connections WHERE name LIKE '%' || :query || '%' OR host LIKE '%' || :query || '%' OR database LIKE '%' || :query || '%'")
    fun searchConnections(query: String): Flow<List<DatabaseConnection>>

    @Query("SELECT DISTINCT environment FROM database_connections ORDER BY environment ASC")
    suspend fun getAllEnvironments(): List<String>

    @Query("SELECT DISTINCT tags FROM database_connections")
    suspend fun getAllTags(): List<String>

    @Query("SELECT * FROM database_connections WHERE tags LIKE '%' || :tag || '%'")
    fun getConnectionsByTag(tag: String): Flow<List<DatabaseConnection>>

    @Transaction
    suspend fun setActiveConnection(connectionId: String) {
        deactivateAllConnections()
        activateConnection(connectionId)
        updateLastConnected(connectionId)
    }
}