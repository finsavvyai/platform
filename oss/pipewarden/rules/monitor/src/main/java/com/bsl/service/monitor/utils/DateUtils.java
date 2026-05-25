package com.bsl.service.monitor.utils;

import java.text.SimpleDateFormat;
import java.util.Calendar;

public class DateUtils {
    // format 24hre ex. 12:12 , 17:15
    private static String  HOUR_FORMAT = "HH:mm";

    private DateUtils() {    }

    public static String getCurrentHour() {
        Calendar cal = Calendar.getInstance();
        SimpleDateFormat sdfHour = new SimpleDateFormat(HOUR_FORMAT);
        String hour = sdfHour.format(cal.getTime());
        return hour;
    }


    public static boolean isHourInInterval(String targetTime, String startTime, String endTime) {
        return ((targetTime.compareTo(startTime) >= 0)
                && (targetTime.compareTo(endTime) <= 0));
    }


    public static boolean isNowInInterval(String startTime, String endTime) {
        return isHourInInterval
                (getCurrentHour(), startTime, endTime);
    }

    public static void main (String[] args) {
        String now = DateUtils.getCurrentHour();
        String startTime = "23:00";
        String endTime   = "23:45";
        System. out.println(now + " between " + startTime + "-" + endTime + "?");
        System. out.println(isHourInInterval(now,startTime,endTime));

    }
}
