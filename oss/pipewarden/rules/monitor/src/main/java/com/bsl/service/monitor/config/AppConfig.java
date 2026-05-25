package com.bsl.service.monitor.config;

import com.bsl.service.monitor.ds.DatasourceFactory;
import com.bsl.service.monitor.sanity.db.*;
import com.bsl.service.monitor.sanity.db.DataSourceMapper;
import com.zaxxer.hikari.HikariDataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.SqlSessionTemplate;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
@MapperScan("com.bsl.service.monitor.sanity.db")
public class AppConfig {
    @Autowired
    DatasourceFactory datasourceFactory;



    @Bean
    public DataSourceMapperFactory dataSourceMapper() throws Exception {
        DataSourceMapperFactory datasourceMapperFactory = new DataSourceMapperFactory();


        Map<String, HikariDataSource> datatasourcesMap = datasourceFactory.getDataSources();
        for (String datasourceName : datatasourcesMap.keySet()) {
            HikariDataSource datasource = datatasourcesMap.get(datasourceName);
            SqlSessionFactoryBean factoryBean = new SqlSessionFactoryBean();
            factoryBean.setDataSource(datasource);
            System.out.println("Configuring..."+datasourceName+"..Done");
            SqlSessionFactory sqlSessionFactory = factoryBean.getObject();
            sqlSessionFactory.getConfiguration().addMapper(DataSourceMapper.class);
            SqlSessionTemplate sqlSessionTemplate = new SqlSessionTemplate(sqlSessionFactory);
            datasourceMapperFactory.addMapper(datasourceName, sqlSessionTemplate);
        }

        return datasourceMapperFactory;
    }
}

