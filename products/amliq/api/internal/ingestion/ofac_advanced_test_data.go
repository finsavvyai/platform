package ingestion

func personPassportXML() string {
	return `<?xml version="1.0"?>
<sdnList>
<sdnEntry>
<uid>1234</uid>
<sdnType>Individual</sdnType>
<firstName>John</firstName>
<lastName>Doe</lastName>
<remarks>Test entry</remarks>
<genderCode>M</genderCode>
<programList><program><programID>SDNTK</programID></program></programList>
<idList><id><idType>Passport</idType><idNumber>AB123456</idNumber><issuanceCountry>XX</issuanceCountry></id></idList>
<dateOfBirthList><dateOfBirth><dateOfBirth>1970-01-15</dateOfBirth></dateOfBirth></dateOfBirthList>
<placeOfBirthList><placeOfBirth><city>London</city><country>UK</country></placeOfBirth></placeOfBirthList>
<akaList></akaList>
</sdnEntry>
</sdnList>`
}

func personAliasesXML() string {
	return `<?xml version="1.0"?>
<sdnList>
<sdnEntry>
<uid>5678</uid>
<sdnType>Individual</sdnType>
<firstName>Jane</firstName>
<lastName>Smith</lastName>
<remarks></remarks>
<akaList>
<aka><firstName>Janet</firstName><lastName>Smythe</lastName></aka>
<aka><firstName></firstName><lastName>Smith-Jones</lastName></aka>
</akaList>
<programList></programList>
<idList></idList>
<dateOfBirthList></dateOfBirthList>
<placeOfBirthList></placeOfBirthList>
</sdnEntry>
</sdnList>`
}

func vesselXML() string {
	return `<?xml version="1.0"?>
<sdnList>
<sdnEntry>
<uid>9999</uid>
<sdnType>Vessel</sdnType>
<firstName></firstName>
<lastName>TankerShip</lastName>
<remarks>Vessel sanctions</remarks>
<akaList></akaList>
<programList><program><programID>SDN</programID></program></programList>
<idList><id><idType>IMO Number</idType><idNumber>1234567</idNumber></id></idList>
<dateOfBirthList></dateOfBirthList>
<placeOfBirthList></placeOfBirthList>
</sdnEntry>
</sdnList>`
}

func orgXML() string {
	return `<?xml version="1.0"?>
<sdnList>
<sdnEntry>
<uid>2021</uid>
<sdnType>Organization</sdnType>
<firstName>Acme</firstName>
<lastName>Corporation</lastName>
<remarks>Org remarks</remarks>
<akaList></akaList>
<programList></programList>
<idList></idList>
<dateOfBirthList></dateOfBirthList>
<placeOfBirthList></placeOfBirthList>
</sdnEntry>
</sdnList>`
}

func singleNameXML() string {
	return `<?xml version="1.0"?>
<sdnList>
<sdnEntry>
<uid>8888</uid>
<sdnType>Individual</sdnType>
<firstName></firstName>
<lastName>Singularity</lastName>
<remarks></remarks>
<akaList></akaList>
<programList></programList>
<idList></idList>
<dateOfBirthList></dateOfBirthList>
<placeOfBirthList></placeOfBirthList>
</sdnEntry>
</sdnList>`
}
