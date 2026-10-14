# TrueNAS Scale Deployment Guide

This guide provides step-by-step instructions for deploying OpenDiagrammer on **TrueNAS Scale** (supporting both **Electric Eel 24.10+** native Docker Compose and **Dragonfish 24.04** Custom Apps).

---

## Table of Contents

1. [Overview & Prerequisites](#overview--prerequisites)
2. [Step 1: Create Datasets & Set Permissions](#step-1-create-datasets--set-permissions)
3. [Step 2: Deployment on TrueNAS Scale](#step-2-deployment-on-truenas-scale)
   - [Method A: Electric Eel (24.10+) Native Docker Compose (Recommended)](#method-a-electric-eel-2410-native-docker-compose-recommended)
   - [Method B: Dragonfish (24.04) Custom App](#method-b-dragonfish-2404-custom-app)
4. [Step 3: Reverse Proxy & WebSocket Configuration](#step-3-reverse-proxy--websocket-configuration)
   - [Nginx Proxy Manager on TrueNAS](#nginx-proxy-manager-on-truenas)
   - [Traefik / Caddy on TrueNAS](#traefik--caddy-on-truenas)
   - [Cloudflare Tunnel](#cloudflare-tunnel)
5. [Step 4: Automated ZFS Snapshots & Backups](#step-4-automated-zfs-snapshots--backups)
6. [Updating OpenDiagrammer on TrueNAS](#updating-opendiagrammer-on-truenas)
7. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## Overview & Prerequisites

OpenDiagrammer runs as a self-contained web service that includes:

- The ASP.NET Core 10 backend API & real-time SignalR CRDT synchronization.
- The Angular interactive web application served from static files.
- Microsoft SQL Server 2022 for persistent storage.

### Prerequisites

- A running **TrueNAS Scale** instance.
- An initialized storage pool (e.g. `tank` or `pool0`).
- **Apps** service configured and running on your preferred storage pool (**Apps** -> **Settings** -> **Choose Pool**).
- A domain name or local DNS record pointing to your TrueNAS host (e.g. `diagrams.myhomelab.net` or `192.168.1.100`).

---

## Step 1: Create Datasets & Set Permissions

Microsoft SQL Server runs inside its container as UID `10001`. To ensure the database can write its data files (`.mdf`, `.ldf`), create a dedicated ZFS dataset and configure appropriate permissions.

### 1. Create the AppData Dataset

1. In the TrueNAS Scale WebUI, navigate to **Datasets**.
2. Select your main storage pool (e.g. `tank`) and click **Add Dataset**.
3. Configure the dataset:
   - **Name**: `opendiagrammer`
   - **Dataset Preset**: `Generic`
4. Click **Save**.
5. Select the newly created `opendiagrammer` dataset, click **Add Dataset**, and create a child dataset:
   - **Name**: `db`
   - **Path**: `/mnt/tank/opendiagrammer/db`
6. Click **Save**.

### 2. Configure Permissions for SQL Server

Open the TrueNAS Scale web shell or an SSH session to your TrueNAS host:

```bash
# Set ownership to SQL Server UID 10001
sudo chown -R 10001:0 /mnt/tank/opendiagrammer/db
sudo chmod -R 770 /mnt/tank/opendiagrammer/db
```

> [!NOTE]
> Adjust `/mnt/tank` to match your actual ZFS pool name (e.g. `/mnt/pool0`).

---

## Step 2: Deployment on TrueNAS Scale

### Method A: Electric Eel (24.10+) Native Docker Compose (Recommended)

TrueNAS Scale 24.10 (Electric Eel) natively supports Docker Compose via **Custom App**.

1. In the TrueNAS Scale WebUI, navigate to **Apps**.
2. Click **Discover Apps** in the top-right corner.
3. In the top-right search/menu area, click the three-dots menu or **Custom App** / **Install via Docker Compose**.
4. Set the **Application Name**: `opendiagrammer`.
5. Under **Compose File**, paste the following configuration:

```yaml
name: open-diagrammer-prod

services:
  api:
    image: ghcr.io/tylersmart/opendiagrammer:latest
    container_name: open-diagrammer-api
    restart: unless-stopped
    ports:
      - "8080:8080" # Change host port if another app is already using 8080
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_HTTP_PORTS: 8080
      ConnectionStrings__DefaultConnection: "Server=sqlserver;Database=OpenDiagrammer;User Id=sa;Password=YourStrongPassword123!_MustIncludeCaps;TrustServerCertificate=True;"
      Authentication__Jwt__Secret: "ReplaceWithAStrongSecretKeyAtLeast32CharactersLong!"
      Authentication__Jwt__Issuer: "OpenDiagrammer"
      Authentication__Jwt__Audience: "OpenDiagrammer"
      Authentication__Jwt__ExpirationMinutes: 1440
      
      # Optional: External OIDC / SSO (Google, Authentik, Keycloak)
      # Authentication__Oidc__Enabled: "true"
      # Authentication__Oidc__ProviderName: "Authentik"
      # Authentication__Oidc__Authority: "https://auth.myhomelab.net/application/o/opendiagrammer/"
      # Authentication__Oidc__ClientId: "your-client-id"
      # Authentication__Oidc__ClientSecret: "your-client-secret"
      # Authentication__Oidc__Scope: "openid profile email"
    depends_on:
      sqlserver:
        condition: service_healthy

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: open-diagrammer-sqlserver
    restart: unless-stopped
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "YourStrongPassword123!_MustIncludeCaps"
      MSSQL_PID: "Developer"
    volumes:
      - /mnt/tank/opendiagrammer/db:/var/opt/mssql
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrongPassword123!_MustIncludeCaps' -C -Q 'SELECT 1' -b -o /dev/null",
        ]
      interval: 5s
      timeout: 5s
      retries: 24
      start_period: 20s
```

> [!IMPORTANT]
> - Replace `YourStrongPassword123!_MustIncludeCaps` with your own secure password.
> - Replace `ReplaceWithAStrongSecretKeyAtLeast32CharactersLong!` with a 32+ character random string (e.g. generated via `openssl rand -base64 32`).
> - Update `/mnt/tank/opendiagrammer/db` to your actual dataset path.

6. Click **Save** / **Install**.
7. Wait for the status indicator to transition from `Deploying` to `Running`.

---

### Method B: Dragonfish (24.04) Custom App

For TrueNAS Scale 24.04 (Dragonfish), deploy using the Custom App wizard:

1. In the WebUI, go to **Apps** -> **Discover Apps** -> **Custom App**.
2. **Application Name**: `opendiagrammer`.
3. **Container Image**:
   - Repository: `ghcr.io/tylersmart/opendiagrammer`
   - Tag: `latest`
4. **Port Forwarding**:
   - Container Port: `8080`
   - Node Port / Host Port: `8080` (or `30080` if using NodePort ranges)
5. **Environment Variables**:
   - `ASPNETCORE_ENVIRONMENT`: `Production`
   - `ASPNETCORE_HTTP_PORTS`: `8080`
   - `ConnectionStrings__DefaultConnection`: `Server=sqlserver;Database=OpenDiagrammer;User Id=sa;Password=...`
   - `Authentication__Jwt__Secret`: `Your32CharKeyHere`
6. **Storage**:
   - Mount Type: `Host Path`
   - Host Path: `/mnt/tank/opendiagrammer/db`
   - Mount Path: `/var/opt/mssql`
7. Click **Save** to deploy.

---

## Step 3: Reverse Proxy & WebSocket Configuration

To access OpenDiagrammer with a friendly URL (e.g. `https://diagrams.yourdomain.com`) and secure SSL encryption, route external traffic through a reverse proxy.

### Nginx Proxy Manager on TrueNAS

If you run **Nginx Proxy Manager** (available from the TrueNAS community catalog):

1. Log into Nginx Proxy Manager.
2. Go to **Proxy Hosts** -> **Add Proxy Host**.
3. **Details Tab**:
   - Domain Names: `diagrams.yourdomain.com`
   - Scheme: `http`
   - Forward Hostname / IP: IP address of your TrueNAS server (e.g. `192.168.1.100`)
   - Forward Port: `8080`
   - Enable: **Cache Assets**, **Block Common Exploits**, **Websockets Support** (Essential for SignalR live collaboration!)
4. **SSL Tab**:
   - SSL Certificate: Request a new Let's Encrypt Certificate or choose your wildcard certificate.
   - Enable: **Force SSL**, **HTTP/2 Support**.
5. Click **Save**.

---

### Traefik / Caddy on TrueNAS

Ensure your reverse proxy enables WebSocket upgrades. In Caddy, WebSockets are proxied automatically:

```caddy
diagrams.yourdomain.com {
    reverse_proxy 192.168.1.100:8080
}
```

---

### Cloudflare Tunnel

If using a Cloudflare Tunnel:

1. In Cloudflare Zero Trust, add a public hostname:
   - Subdomain: `diagrams`
   - Domain: `yourdomain.com`
   - Service: `HTTP://<truenas-internal-ip>:8080`
2. Under **Additional application settings**:
   - Ensure **WebSockets** is toggled ON.

---

## Step 4: Automated ZFS Snapshots & Backups

One of the greatest benefits of running on TrueNAS Scale is atomic, zero-downtime backups using ZFS snapshots.

### Configure Periodic Snapshots

1. In the TrueNAS Scale WebUI, navigate to **Data Protection** -> **Periodic Snapshot Tasks**.
2. Click **Add**.
3. **Dataset**: `tank/opendiagrammer`.
4. **Recursive**: Checked.
5. **Schedule**:
   - Frequency: Daily (e.g. at `02:00 AM`).
   - Lifetime: 14 Days (or your retention preference).
6. Click **Save**.

Now, if a user accidentally deletes a board, or if data corruption occurs, you can roll back the database instantly to any previous day's snapshot without losing disk space.

---

## Updating OpenDiagrammer on TrueNAS

1. In the TrueNAS Scale WebUI, navigate to **Apps**.
2. Locate the `opendiagrammer` app.
3. If an update is detected, an **Upgrade** badge will appear. Click **Upgrade**.
4. Or, in the app's three-dot menu, select **Restart** / **Redeploy** to pull the latest image.
5. On container start, the application checks for pending database migrations and applies them automatically.
6. Check the container logs in the WebUI (**Apps** -> **opendiagrammer** -> **Logs**) to confirm:
   ```text
   Database migration complete.
   Now listening on: http://[::]:8080
   ```

---

## Troubleshooting & FAQs

### 1. Database fails to start with "Permission Denied"

- **Cause**: SQL Server running as UID 10001 cannot write to the ZFS host dataset.
- **Solution**: Open the TrueNAS shell and run:
  ```bash
  sudo chown -R 10001:0 /mnt/tank/opendiagrammer/db
  sudo chmod -R 770 /mnt/tank/opendiagrammer/db
  ```
  Then restart the app.

### 2. Collaborators cannot see live cursors or real-time board updates

- **Cause**: The reverse proxy or Cloudflare tunnel is blocking WebSocket connections.
- **Solution**: Ensure **WebSockets Support** is enabled in Nginx Proxy Manager or that your reverse proxy passes `Upgrade: websocket` and `Connection: Upgrade` headers for the `/hubs/board` endpoint.

### 3. Port conflict with TrueNAS WebUI

- **Cause**: TrueNAS uses port 80/443 for its management portal.
- **Solution**: In the Compose file, map the container to port `8080` (or `30080`):
  ```yaml
  ports:
    - "8080:8080"
  ```
  Access the web interface at `http://truenas-ip:8080`.
