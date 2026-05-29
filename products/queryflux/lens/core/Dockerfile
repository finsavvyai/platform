# Build Stage
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy the entire project context
COPY . .

# Build using the pom.xml in build directory
# We assume the pom.xml is configured to look for src correctly relative to itself
# or we run it from the root context using -f
RUN mvn -f build/pom.xml clean package -DskipTests

# Runtime Stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Create a non-root user for security
RUN addgroup -S querylens && adduser -S querylens -G querylens
USER querylens

# Copy the built artifact from the target directory
# Based on file listing, 'target' is in the root of querylens-core
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget -q --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
