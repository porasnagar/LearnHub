# LearnHub — one image containing the ASP.NET Core API and the built Angular client.
# Two stages only (build + runtime), so it fits hosts that limit multi-stage builds (e.g. SnapDeploy Small).
#   docker build -t learnhub .
#   docker run -p 8080:8080 -v learnhub-data:/data learnhub

# ---- 1. Build: Angular client + ASP.NET Core publish, in the .NET SDK image ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

# Node.js for the Angular build (official binary; the Debian package is too old for Angular 19).
ARG NODE_VERSION=22.12.0
RUN ARCH="$(dpkg --print-architecture)" \
 && case "$ARCH" in amd64) NODE_ARCH=x64 ;; arm64) NODE_ARCH=arm64 ;; *) echo "unsupported arch $ARCH" && exit 1 ;; esac \
 && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.gz" \
    | tar -xz -C /usr/local --strip-components=1 \
 && node --version

WORKDIR /app

# Restore first so dependency layers are cached between builds.
COPY client/package.json client/package-lock.json client/
RUN cd client && npm ci --no-audit --no-fund
COPY src/LearnHub.Web/LearnHub.Web.csproj src/LearnHub.Web/
RUN dotnet restore src/LearnHub.Web/LearnHub.Web.csproj

# Angular writes its build to src/LearnHub.Web/wwwroot (see client/angular.json).
# Node's heap is capped so the build fits small (512 MB) build machines.
COPY client/ client/
RUN cd client && NODE_OPTIONS=--max-old-space-size=400 npm run build \
 && rm -rf node_modules

COPY src/LearnHub.Web/ src/LearnHub.Web/
RUN dotnet publish src/LearnHub.Web/LearnHub.Web.csproj -c Release -o /out --no-restore -p:SkipClientBuild=true

# ---- 2. Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /out ./
# Database, uploads and login keys live here — mount a persistent volume/disk at /data.
# (Runs as root because platform-mounted disks are often root-owned.)
ENV DataDirectory=/data
ENV ASPNETCORE_ENVIRONMENT=Production
RUN mkdir -p /data
EXPOSE 8080
# Listen on the platform-provided $PORT (Render, Railway, SnapDeploy…), defaulting to 8080.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet LearnHub.Web.dll"]
