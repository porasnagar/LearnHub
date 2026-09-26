# LearnHub — one image containing the ASP.NET Core API and the built Angular client.
#   docker build -t learnhub .
#   docker run -p 8080:8080 -v learnhub-data:/data learnhub

# ---- 1. Build the Angular client ----
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
# angular.json writes the build to ../src/LearnHub.Web/wwwroot
RUN npm run build

# ---- 2. Publish the ASP.NET Core app ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS server
WORKDIR /app
COPY src/LearnHub.Web/LearnHub.Web.csproj src/LearnHub.Web/
RUN dotnet restore src/LearnHub.Web/LearnHub.Web.csproj
COPY src/LearnHub.Web/ src/LearnHub.Web/
COPY --from=client /app/src/LearnHub.Web/wwwroot src/LearnHub.Web/wwwroot
RUN dotnet publish src/LearnHub.Web/LearnHub.Web.csproj -c Release -o /out --no-restore -p:SkipClientBuild=true

# ---- 3. Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=server /out ./
# Database, uploads and login keys live here — mount a persistent volume/disk at /data.
# (Runs as root because platform-mounted disks are often root-owned.)
ENV DataDirectory=/data \
    ASPNETCORE_ENVIRONMENT=Production
RUN mkdir -p /data
EXPOSE 8080
# Listen on the platform-provided $PORT (Render, Railway, Cloud Run…), defaulting to 8080.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet LearnHub.Web.dll"]
