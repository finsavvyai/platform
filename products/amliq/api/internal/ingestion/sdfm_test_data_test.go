package ingestion

const sdfmIndividualXML = `<consolidated-list>
	<acount-list>
		<number-entry>12345</number-entry>
		<program-entry>TERRORISM</program-entry>
		<type-entry>0</type-entry>
		<aka-list>
			<aka-name1>Ivan</aka-name1>
			<aka-name3>Petrov</aka-name3>
			<type-aka>N</type-aka>
		</aka-list>
	</acount-list>
</consolidated-list>`

const sdfmCompanyXML = `<consolidated-list>
	<acount-list>
		<number-entry>99999</number-entry>
		<type-entry>1</type-entry>
		<aka-list>
			<aka-name1>Bad</aka-name1>
			<aka-name3>Corp</aka-name3>
			<type-aka>N</type-aka>
		</aka-list>
	</acount-list>
</consolidated-list>`

const sdfmAliasXML = `<consolidated-list>
	<acount-list>
		<number-entry>55555</number-entry>
		<aka-list>
			<aka-name1>Oleh</aka-name1>
			<aka-name3>Kovalenko</aka-name3>
			<type-aka>A</type-aka>
		</aka-list>
	</acount-list>
</consolidated-list>`

const sdfmSingleWordXML = `<consolidated-list>
	<acount-list>
		<number-entry>11111</number-entry>
		<aka-list>
			<aka-name1>Madonna</aka-name1>
			<type-aka>N</type-aka>
		</aka-list>
	</acount-list>
</consolidated-list>`

const sdfmBOMXML = `<consolidated-list>
	<acount-list>
		<number-entry>77777</number-entry>
		<aka-list>
			<aka-name1>Test</aka-name1>
			<aka-name3>Person</aka-name3>
			<type-aka>N</type-aka>
		</aka-list>
	</acount-list>
</consolidated-list>`
