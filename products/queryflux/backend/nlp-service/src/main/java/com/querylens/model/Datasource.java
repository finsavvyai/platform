package com.querylens.model;

import lombok.Data;

@Data
public class Datasource {
    private Long id;
    private String name;
    private String description;
    private String url;
    private String username;
    private String password;
    private String driverClassName;
}