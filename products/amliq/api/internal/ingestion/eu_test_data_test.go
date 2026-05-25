package ingestion

// 24 columns: 0-Date_file 1-Entity_logical_id 2-Subject_type
// 3-Naal_wholename 4-Naal_firstname 5-Naal_lastname 6-Naal_middlename
// 7-Programme 8-Naal_programme
// 9-Addr_number 10-Addr_street 11-Addr_zipcode 12-Addr_city
// 13-Addr_country 14-Addr_other
// 15-Birt_date 16-Birt_place 17-Birt_country
// 18-Iden_number 19-Iden_country 20-Citi_country 21-EU_ref_num
// 22-Leba_publication_date 23-Leba_url

const euTestHeader = "Date_file;Entity_logical_id;Subject_type;" +
	"Naal_wholename;Naal_firstname;Naal_lastname;Naal_middlename;" +
	"Programme;Naal_programme;" +
	"Addr_number;Addr_street;Addr_zipcode;Addr_city;Addr_country;" +
	"Addr_other;" +
	"Birt_date;Birt_place;Birt_country;" +
	"Iden_number;Iden_country;Citi_country;EU_ref_num;" +
	"Leba_publication_date;Leba_url\n"

// 24 fields: date, id, P, name, 3 empty, UKRAINE, empty,
// 6 empty addr, dob, place, country, iden, 2 country, ref, pub, url
const euSinglePerson = "2024-01-01;e00000000001;P;" +
	"John Smith;;;;" +
	"UKRAINE;;" +
	";;;;;;" +
	"1980-01-15;Moscow;RU;" +
	"PP123;RU;RU;REF1;2024-01-01;http://eu.example\n"

// 24 fields: date, id, E, name, 3 empty, 2 empty prog,
// 6 empty addr, 3 empty birt, 3 empty iden, ref, 2 empty
const euCompany = "2024-01-01;e00000000002;E;" +
	"ACME Corp;;;;" +
	";;" +
	";;;;;;" +
	";;;" +
	";;;REF2;;\n"

const euMultiRow = "2024-01-01;e00000000003;P;" +
	"Jane Doe;;;;" +
	"SYRIA;;" +
	"10;Main St;12345;Berlin;DE;;" +
	"1975-05-20;Damascus;SY;" +
	"ID1;SY;SY;REF3;2024-01-01;\n" +
	"2024-01-01;e00000000003;P;" +
	";;;;" +
	"SYRIA;;" +
	"20;Oak Ave;54321;Munich;DE;;" +
	";;;" +
	"ID2;DE;;REF3;;\n"

const euFallbackFirstLast = "2024-01-01;e00000000004;P;" +
	";John;Smith;;" +
	";;" +
	";;;;;;" +
	";;;" +
	";;;REF4;;\n"
