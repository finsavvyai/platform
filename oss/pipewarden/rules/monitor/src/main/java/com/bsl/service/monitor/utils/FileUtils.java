package com.bsl.service.monitor.utils;

import java.io.*;

public class FileUtils {

    public final static String XML_REQ_DIR = File.separator + "requestXMLs" + File.separator;

    public static String loadFileToString(String fileName) {

        String strFile = "";

        String newLine = "\n";


        BufferedReader in = null;

        try {
            InputStream is = FileUtils.class.getResourceAsStream(fileName);
            in = new BufferedReader(new InputStreamReader(is));
            String str;
            while ((str = in.readLine()) != null) {
                strFile = strFile + str + newLine;
            }
        } catch (FileNotFoundException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } finally {

            if (in != null) {
                try {
                    in.close();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

        }

        return strFile;

    }


}


