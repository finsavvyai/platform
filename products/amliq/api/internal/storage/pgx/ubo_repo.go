package pgx

import (
	"context"
	"database/sql"
	"errors"

	"github.com/aegis-aml/aegis/internal/domain"
)

type UBORepository struct {
	db *sql.DB
}

func NewUBORepository(db *sql.DB) *UBORepository {
	return &UBORepository{db: db}
}

func (r *UBORepository) Create(
	ctx context.Context, owner domain.BeneficialOwner,
) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO beneficial_owners
		(id, tenant_id, organization_id, owner_name, nationality,
		 ownership_pct, is_direct_owner, is_pep, pep_tier,
		 is_sanctioned, verified, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		owner.ID, owner.TenantID.String(), owner.OrganizationID,
		owner.OwnerName, owner.OwnerNationality, owner.OwnershipPct,
		owner.IsDirectOwner, owner.IsPEP, owner.PEPTier, false,
		owner.Status == domain.UBOVerified, owner.CreatedAt)
	return err
}

func (r *UBORepository) ListByOrg(
	ctx context.Context, orgID string,
) ([]domain.BeneficialOwner, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, tenant_id, organization_id, owner_name, nationality,
		       ownership_pct, is_direct_owner, is_pep, pep_tier,
		       verified, verified_at, created_at
		FROM beneficial_owners WHERE organization_id=$1
		ORDER BY ownership_pct DESC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOwners(rows)
}

func (r *UBORepository) Update(
	ctx context.Context, owner domain.BeneficialOwner,
) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE beneficial_owners SET
		  is_pep=$1, pep_tier=$2, verified=$3, verified_at=$4
		WHERE id=$5`,
		owner.IsPEP, owner.PEPTier,
		owner.Status == domain.UBOVerified, owner.VerifiedAt, owner.ID)
	return err
}

func (r *UBORepository) GetByID(
	ctx context.Context, id string,
) (domain.BeneficialOwner, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, organization_id, owner_name, nationality,
		       ownership_pct, is_direct_owner, is_pep, pep_tier,
		       verified, verified_at, created_at
		FROM beneficial_owners WHERE id=$1`, id)
	var o domain.BeneficialOwner
	var tid string
	var verified bool
	err := row.Scan(&o.ID, &tid, &o.OrganizationID, &o.OwnerName,
		&o.OwnerNationality, &o.OwnershipPct, &o.IsDirectOwner,
		&o.IsPEP, &o.PEPTier, &verified, &o.VerifiedAt, &o.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return o, errors.New("not found")
		}
		return o, err
	}
	o.TenantID, _ = domain.NewTenantID(tid)
	if verified {
		o.Status = domain.UBOVerified
	} else {
		o.Status = domain.UBOPending
	}
	return o, nil
}

func (r *UBORepository) Delete(
	ctx context.Context, id string,
) error {
	_, err := r.db.ExecContext(ctx,
		"DELETE FROM beneficial_owners WHERE id=$1", id)
	return err
}
