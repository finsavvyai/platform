package com.bsl.service.monitor.utils;


public class StringUtils {


    public static final boolean isNullOrEmpty(final String s) {
        return s == null ? true : s.length() == 0;
    }



    public static final String strAfterStr(String strInput, String strSearch) {
        String strOutput = "";
        String strNotFound = null;

        if (isNullOrEmpty(strInput)) {
            return strNotFound;
        }
        if (isNullOrEmpty(strSearch)) {
            return strNotFound;
        }

        int i = strInput.indexOf(strSearch);
        if (i == -1) {
            return strNotFound;
        }

        i = i + strSearch.length();

        strOutput = strInput.substring(i);

        return strOutput;
    }

    public static final String strBeforeStr(String strInput, String strSearch) {
        String strOutput = "";
        String strNotFound = null;

        if (isNullOrEmpty(strInput)) {
            return strNotFound;
        }
        if (isNullOrEmpty(strSearch)) {
            return strNotFound;
        }

        int i = strInput.indexOf(strSearch);
        if (i == -1) {
            return strNotFound;
        }

        strOutput = strInput.substring(0, i);

        return strOutput;
    }

    public static final String strBetweenStr(String strInput, String strSearch1, String strSearch2) {
        String strOutput;

        strOutput = strAfterStr(strInput, strSearch1);

        strOutput = strBeforeStr(strOutput, strSearch2);

        return strOutput;
    }


    public static final String strFilterXmlRemarks(String strXml) {

        if (strXml == null) {
            return null;
        }

        String strOutput = strXml;

        while (strOutput.contains("<!--")) {
            strOutput = strBeforeStr(strOutput, "<!--") + strAfterStr(strOutput, "-->");
        }
        return strOutput;
    }


    public static final String strFindXmlTag(String strXml, String strInputTagName) {

        String strTemp = strFilterXmlRemarks(strXml);

        while (strTemp != null && strTemp.contains("<")) {
            String strTag = strTag = "<" + strBetweenStr(strTemp, "<", ">") + ">";

            String strCurrentTagName = strBetweenStr(strTag, "<", ">");

            if (strCurrentTagName.contains(" ")) {
                strCurrentTagName = strBeforeStr(strCurrentTagName, " ");
            }

            if (strCurrentTagName.contains(":")) {
                strCurrentTagName = strAfterStr(strCurrentTagName, ":");
            }


            if (strCurrentTagName.equals(strInputTagName)) {
                return strTag;
            }

            strTemp = strAfterStr(strTemp, strTag);

        }
        return null;
    }


    public static final String strTranslate(String strInput, String strSearch, String strReplace) {
        String strOutput = strInput;

        while (strOutput.contains(strSearch)) {
            strOutput = strBeforeStr(strOutput, strSearch) + strReplace + strAfterStr(strOutput, strSearch);
        }

        return strOutput;
    }

    public static final String strTranslateFileSeperator(String strDir) {
        return strTranslate(strDir, "\\", "/");
    }



}
