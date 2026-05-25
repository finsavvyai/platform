package com.bsl.service.monitor.service;

import com.bsl.service.monitor.config.DataSourceMapperFactory;
import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.sanity.db.*;
import com.bsl.service.monitor.MonitorUtils;
import com.bsl.service.monitor.sanity.db.DataSourceMapper;
import lombok.extern.java.Log;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;


@Log
@Service
public class DBSanityCheck {

    @Autowired
    private DataSourceMapperFactory dataSourceMapperFactory;

    public List<ResponseDetails> execute(){

        List<ResponseDetails> responseDetailsList = new ArrayList<>();
        Map<String, SqlSessionTemplate> mappers = dataSourceMapperFactory.getMappers();
        for(String dataSourceMapperName: mappers.keySet() ){

            String res = "";
            try{
                SqlSessionTemplate sqlSessionTemplate = mappers.get(dataSourceMapperName);
                res = sqlSessionTemplate.getMapper(DataSourceMapper.class).getSysDate();
                log.info("Result from db " + dataSourceMapperName + " " +res);
            }
            catch (Exception e){
                log.warning("Error connection to " + dataSourceMapperName + ": " + e.getMessage());
            }

            createResponse(res,dataSourceMapperName,responseDetailsList);

        }

        return responseDetailsList;

    }

    private void createResponse(String res,String dbSubName,List<ResponseDetails> responseDetailsList){

        if (!StringUtils. hasText(res)){
            ResponseDetails responseDetails = new ResponseDetails();
            responseDetails.setDbName(dbSubName );
            responseDetails.setMessage(MonitorUtils.FAIL);
            responseDetailsList.add(responseDetails);
        }

    }
}
