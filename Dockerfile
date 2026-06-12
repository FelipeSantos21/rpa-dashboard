# ==========================================
# Build Stage
# ==========================================
FROM maven:3.8-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
# Pre-fetch dependencies to speed up subsequent builds
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# ==========================================
# Runtime Stage
# ==========================================
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/rpa-dashboard-*.jar app.jar

EXPOSE 8080

# Configure default spring properties (can be overridden by docker-compose or run args)
ENV SPRING_OUTPUT_ANSI_ENABLED=ALWAYS
ENV JAVA_OPTS="-XX:+UseG1GC -XX:+UseStringDeduplication"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
