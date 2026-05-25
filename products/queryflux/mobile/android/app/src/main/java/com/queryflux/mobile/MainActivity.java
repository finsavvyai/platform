package com.queryflux.mobile;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView tv = new TextView(this);
        tv.setText("QueryFlux Mobile - Database Monitoring & Alerts");
        tv.setTextSize(18);
        tv.setPadding(32, 32, 32, 32);
        setContentView(tv);
    }
}