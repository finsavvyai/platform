package com.querylens.service;

import com.querylens.model.Datasource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class DatasourceService {

    private final ConcurrentHashMap<Long, Datasource> datasources = new ConcurrentHashMap<>();
    private final AtomicLong idCounter = new AtomicLong(1);

    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    @PostConstruct
    public void init() {
        if (activeProfile.contains("duckdb")) {
            initializeDuckDB();
        } else if (activeProfile.contains("h2")) {
            initializeH2();
        } else {
            // Default or other profile
            initializeDefault();
        }
    }

    private void initializeDuckDB() {
        Datasource duckDB = new Datasource();
        duckDB.setId(idCounter.getAndIncrement());
        duckDB.setName("DuckDB");
        duckDB.setDescription("Local DuckDB instance");
        duckDB.setUrl("jdbc:duckdb:./db/querylens.db");
        duckDB.setDriverClassName("org.duckdb.DuckDBDriver");
        datasources.put(duckDB.getId(), duckDB);
    }

    private void initializeH2() {
        Datasource h2 = new Datasource();
        h2.setId(idCounter.getAndIncrement());
        h2.setName("H2");
        h2.setDescription("In-memory H2 database");
        h2.setUrl("jdbc:h2:mem:querylens;DB_CLOSE_DELAY=-1");
        h2.setDriverClassName("org.h2.Driver");
        datasources.put(h2.getId(), h2);
    }

    private void initializeDefault() {
        // Add default datasource configuration
        Datasource defaultDS = new Datasource();
        defaultDS.setId(idCounter.getAndIncrement());
        defaultDS.setName("Default");
        defaultDS.setDescription("Default database");
        defaultDS.setUrl("jdbc:postgresql://localhost:5432/querylens");
        defaultDS.setDriverClassName("org.postgresql.Driver");
        datasources.put(defaultDS.getId(), defaultDS);
    }

    // Rest of your methods remain the same
    public List<Datasource> getAllDatasources() {
        return new ArrayList<>(datasources.values());
    }

    public Optional<Datasource> getDatasourceById(Long id) {
        return Optional.ofNullable(datasources.get(id));
    }

    public Long saveDatasource(Datasource datasource) {
        if (datasource.getId() == null) {
            datasource.setId(idCounter.getAndIncrement());
        }
        datasources.put(datasource.getId(), datasource);
        return datasource.getId();
    }
}