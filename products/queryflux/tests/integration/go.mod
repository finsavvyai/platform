module queryflux-tests

go 1.21

require (
	github.com/stretchr/testify v1.8.4
	github.com/jackc/pgx/v5 v5.5.0
	go.mongodb.org/mongo-driver v1.13.1
	redis v5.0.1+incompatible
	go-sql-driver/mysql v1.7.1

	// Include backend modules
	github.com/queryflux/backend v0.0.0
)

replace github.com/queryflux/backend => ../..