package com.bsl.service.monitor.ds;

import com.bsl.service.monitor.config.DataSourceProperties;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Log
public class DatasourceFactory {
    @Autowired
    DataSourceProperties dataSourceProperties;
    public Map <String ,HikariDataSource> getDataSources() {
        Map <String ,HikariDataSource> hikariDataSources = new HashMap<>();
        List<DataSourceDTO> dataSourceDTOList =dataSourceProperties.getDataSources();
        if (dataSourceDTOList == null || dataSourceDTOList.size()==0){
            return hikariDataSources;
//            throw  new IllegalMonitorStateException("Can't find data sources");
        }
        for(DataSourceDTO dataSourceDTO : dataSourceDTOList) {

            HikariDataSource hikariDataSource = new HikariDataSource();
            hikariDataSource.setUsername(dataSourceDTO.getUser());
            hikariDataSource.setPassword(dataSourceDTO.getPassword());
            hikariDataSource.setJdbcUrl("jdbc:oracle:thin:@" + dataSourceDTO.getJdbcUrl());
            hikariDataSource.setDriverClassName(dataSourceDTO.getDriverClassName());
            hikariDataSources.put(dataSourceDTO.getName(),hikariDataSource);
        }

        return hikariDataSources;
    }
}
