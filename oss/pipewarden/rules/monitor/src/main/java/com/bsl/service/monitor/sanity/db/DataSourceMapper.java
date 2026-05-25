package com.bsl.service.monitor.sanity.db;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface DataSourceMapper {
    @Select("SELECT sysdate FROM dual")
    String getSysDate();
}