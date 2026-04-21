FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /w
COPY backend/pom.xml backend/pom.xml
COPY backend/src backend/src
COPY backend/.mvn backend/.mvn
COPY backend/mvnw backend/mvnw
RUN chmod +x backend/mvnw && cd backend && ./mvnw -B -q package -DskipTests

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /w/backend/target/evm-orchestration-api-*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
