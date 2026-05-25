package com.bsl.service.monitor.controller;

import com.bsl.service.monitor.service.DBSanityCheck;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class Sanity {
    @Autowired
    DBSanityCheck dbSanityCheck;
    @CrossOrigin(origins = "*")
    @GetMapping("sanity")
    public String all() {
        if (dbSanityCheck.execute().isEmpty()) {
            return "OK";
        }
        return "Failure";
    }
}
