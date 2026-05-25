package pgx

// bulkEntityCols is the number of placeholder arguments per entity
// in upsertBatch. Must match the column list in bulkInsertHeader +
// entityArgs order.
const bulkEntityCols = 23

const bulkInsertHeader = `INSERT INTO entities (
	id, tenant_id, type, full_name, given_name, family_name,
	original_script, list_id, name_normalized,
	dob, nationalities, metadata,
	created_at, updated_at,
	addresses, identifiers, aliases,
	pep_tier, designation_date, delisting_date,
	position_title, place_of_birth, gender
) VALUES `

// tenant_id is part of the UPDATE so reingest-global can claim rows
// that were seeded under a non-global tenant in legacy paths — the
// PK is id alone, so without this line the ON CONFLICT would update
// list fields but leave the row stranded under the wrong tenant and
// invisible to __global__ queries.
const bulkOnConflictClause = ` ON CONFLICT (id) DO UPDATE SET
	tenant_id = EXCLUDED.tenant_id,
	full_name = EXCLUDED.full_name,
	given_name = EXCLUDED.given_name,
	family_name = EXCLUDED.family_name,
	list_id = EXCLUDED.list_id,
	name_normalized = EXCLUDED.name_normalized,
	dob = EXCLUDED.dob,
	nationalities = EXCLUDED.nationalities,
	metadata = EXCLUDED.metadata,
	addresses = EXCLUDED.addresses,
	identifiers = EXCLUDED.identifiers,
	aliases = EXCLUDED.aliases,
	pep_tier = EXCLUDED.pep_tier,
	designation_date = EXCLUDED.designation_date,
	delisting_date = EXCLUDED.delisting_date,
	position_title = EXCLUDED.position_title,
	place_of_birth = EXCLUDED.place_of_birth,
	gender = EXCLUDED.gender,
	updated_at = EXCLUDED.updated_at`
