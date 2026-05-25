package ingestion

import "encoding/xml"

// Shared XML sub-element types for UN sanctions.

type unAlias struct {
	XMLName    xml.Name `xml:""`
	Quality    string   `xml:"QUALITY"`
	AliasName  string   `xml:"ALIAS_NAME"`
	FirstName  string   `xml:"FIRST_NAME"`
	SecondName string   `xml:"SECOND_NAME"`
	ThirdName  string   `xml:"THIRD_NAME"`
	FourthName string   `xml:"FOURTH_NAME"`
}

type unDOB struct {
	Date     string `xml:"DATE"`
	Year     string `xml:"YEAR"`
	Month    string `xml:"MONTH"`
	Day      string `xml:"DAY"`
	FromYear string `xml:"FROM_YEAR"`
	ToYear   string `xml:"TO_YEAR"`
}

type unPOB struct {
	City          string `xml:"CITY"`
	StateProvince string `xml:"STATE_PROVINCE"`
	Country       string `xml:"COUNTRY"`
}

type unNationality struct {
	Value string `xml:"VALUE"`
}

type unAddress struct {
	Street        string `xml:"STREET"`
	City          string `xml:"CITY"`
	StateProvince string `xml:"STATE_PROVINCE"`
	Country       string `xml:"COUNTRY"`
	Note          string `xml:"NOTE"`
}

type unDocument struct {
	TypeOfDoc      string `xml:"TYPE_OF_DOCUMENT"`
	Number         string `xml:"NUMBER"`
	IssuingCountry string `xml:"ISSUING_COUNTRY"`
	Note           string `xml:"NOTE"`
}
