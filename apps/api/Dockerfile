FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine3.22 AS build
WORKDIR /source

COPY apps/api/CharacterForge.Api.csproj apps/api/
RUN dotnet restore apps/api/CharacterForge.Api.csproj

COPY apps/api/ apps/api/
RUN dotnet publish apps/api/CharacterForge.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine3.22 AS runtime
RUN apk add --no-cache curl
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

COPY --from=build --chown=$APP_UID:$APP_UID /app/publish .
USER $APP_UID

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["dotnet", "CharacterForge.Api.dll"]
