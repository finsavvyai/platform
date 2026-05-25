package com.bsl.service.monitor.config;


import org.mybatis.spring.SqlSessionTemplate;

import java.util.HashMap;
import java.util.Map;

public class DataSourceMapperFactory {

    Map<String, SqlSessionTemplate> mappers = new HashMap<>();

    public Map<String, SqlSessionTemplate> getMappers() {
        return mappers;
    }

    public void setMappers(Map<String, SqlSessionTemplate> mappers) {
        this.mappers = mappers;
    }
    public Map<String, SqlSessionTemplate> addMapper(String mapperName ,SqlSessionTemplate mapper){
        //TODO add check that inputs and mappers are not null
        this.mappers.put(mapperName,mapper);
        return this.mappers;
    }
}
