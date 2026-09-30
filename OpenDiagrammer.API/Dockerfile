# Stage 1: Build Client
FROM node:22-alpine AS client-build
WORKDIR /src/OpenDiagrammer.Client
COPY OpenDiagrammer.Client/package*.json ./
RUN npm install
COPY OpenDiagrammer.Client/ .
RUN npm run build:production

# Stage 2: Build API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY OpenDiagrammer.API/OpenDiagrammer.API.csproj OpenDiagrammer.API/
COPY OpenDiagrammer.Core/OpenDiagrammer.Core.csproj OpenDiagrammer.Core/
COPY OpenDiagrammer.Data/OpenDiagrammer.Data.csproj OpenDiagrammer.Data/
COPY OpenDiagrammer.Infrastructure/OpenDiagrammer.Infrastructure.csproj OpenDiagrammer.Infrastructure/

RUN dotnet restore OpenDiagrammer.API/OpenDiagrammer.API.csproj

COPY . .
WORKDIR /src/OpenDiagrammer.API
RUN dotnet publish -c Release -o /app/publish

# Stage 3: Final Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=api-build /app/publish .
# Copy client build to wwwroot
COPY --from=client-build /src/OpenDiagrammer.Client/dist/OpenDiagrammer.Client/browser ./wwwroot

EXPOSE 8080
ENTRYPOINT ["dotnet", "OpenDiagrammer.API.dll"]
