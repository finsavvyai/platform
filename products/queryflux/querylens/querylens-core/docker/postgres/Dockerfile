FROM postgres:14

# Environment variables to configure the database
ENV POSTGRES_DB=querylens
ENV POSTGRES_USER=querylens
ENV POSTGRES_PASSWORD=querylens

# Copy initialization scripts
COPY init.sql /docker-entrypoint-initdb.d/

# Expose the PostgreSQL port
EXPOSE 5432
