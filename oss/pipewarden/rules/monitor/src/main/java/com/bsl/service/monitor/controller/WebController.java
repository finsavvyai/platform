package com.bsl.service.monitor.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class WebController {

    @RequestMapping(value = {"/", "/dashboard/**"})
    public String index() {
        return "forward:/index.html";
    }
}