#!/bin/bash
# =============================================================================
# SwissPhoto Multi-Instance Manager
# =============================================================================
# Automatische Verwaltung von Kunden-Instanzen
# =============================================================================

set -e

INSTANCES_DIR="/opt/swissphoto/instances"
TEMPLATE_DIR="/opt/swissphoto/template"
SHARED_ML_URL="http://swissphoto-ml:3003"

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[SwissPhoto]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# =============================================================================
# Neue Instanz erstellen
# =============================================================================
create_instance() {
    local CUSTOMER_ID=$1
    local STORAGE_GB=$2
    local EMAIL=$3
    
    if [ -z "$CUSTOMER_ID" ]; then
        error "Usage: $0 create <customer_id> <storage_gb> <email>"
    fi
    
    local INSTANCE_DIR="$INSTANCES_DIR/$CUSTOMER_ID"
    
    if [ -d "$INSTANCE_DIR" ]; then
        error "Instance $CUSTOMER_ID already exists!"
    fi
    
    log "Creating instance for: $CUSTOMER_ID"
    
    # Verzeichnisse erstellen
    mkdir -p "$INSTANCE_DIR"/{uploads,postgres,config}
    
    # Zufälliges Passwort generieren
    local DB_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
    
    # Docker Compose für diese Instanz
    cat > "$INSTANCE_DIR/docker-compose.yml" << COMPOSE
name: swissphoto-${CUSTOMER_ID}

services:
  server:
    container_name: swissphoto_${CUSTOMER_ID}_server
    image: ghcr.io/immich-app/immich-server:\${IMMICH_VERSION:-release}
    volumes:
      - ./uploads:/data
      - /etc/localtime:/etc/localtime:ro
    environment:
      - DB_URL=postgresql://swissphoto:${DB_PASS}@database:5432/swissphoto
      - REDIS_HOSTNAME=redis
      - MACHINE_LEARNING_URL=${SHARED_ML_URL}
    depends_on:
      - redis
      - database
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${CUSTOMER_ID}.rule=Host(\`${CUSTOMER_ID}.swissphoto.ch\`)"
      - "traefik.http.routers.${CUSTOMER_ID}.entrypoints=websecure"
      - "traefik.http.routers.${CUSTOMER_ID}.tls.certresolver=letsencrypt"
      - "traefik.http.services.${CUSTOMER_ID}.loadbalancer.server.port=2283"
    networks:
      - swissphoto-shared
      - internal

  redis:
    container_name: swissphoto_${CUSTOMER_ID}_redis
    image: docker.io/valkey/valkey:9
    restart: unless-stopped
    networks:
      - internal

  database:
    container_name: swissphoto_${CUSTOMER_ID}_db
    image: ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0
    environment:
      - POSTGRES_PASSWORD=${DB_PASS}
      - POSTGRES_USER=swissphoto
      - POSTGRES_DB=swissphoto
    volumes:
      - ./postgres:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - internal

networks:
  swissphoto-shared:
    external: true
  internal:
    driver: bridge
COMPOSE

    # Metadata speichern
    cat > "$INSTANCE_DIR/metadata.json" << META
{
  "customer_id": "$CUSTOMER_ID",
  "email": "$EMAIL",
  "storage_gb": $STORAGE_GB,
  "created_at": "$(date -Iseconds)",
  "status": "active"
}
META
    
    log "Starting instance..."
    cd "$INSTANCE_DIR"
    docker compose up -d
    
    log "✅ Instance $CUSTOMER_ID created!"
    log "   URL: https://${CUSTOMER_ID}.swissphoto.ch"
    log "   Storage: ${STORAGE_GB}GB"
}

# =============================================================================
# Instanz stoppen (bei Nichtzahlung)
# =============================================================================
stop_instance() {
    local CUSTOMER_ID=$1
    local INSTANCE_DIR="$INSTANCES_DIR/$CUSTOMER_ID"
    
    if [ ! -d "$INSTANCE_DIR" ]; then
        error "Instance $CUSTOMER_ID not found!"
    fi
    
    log "Stopping instance: $CUSTOMER_ID"
    cd "$INSTANCE_DIR"
    docker compose down
    
    # Status updaten
    jq '.status = "stopped"' metadata.json > tmp.json && mv tmp.json metadata.json
    
    log "✅ Instance $CUSTOMER_ID stopped"
}

# =============================================================================
# Instanz starten
# =============================================================================
start_instance() {
    local CUSTOMER_ID=$1
    local INSTANCE_DIR="$INSTANCES_DIR/$CUSTOMER_ID"
    
    if [ ! -d "$INSTANCE_DIR" ]; then
        error "Instance $CUSTOMER_ID not found!"
    fi
    
    log "Starting instance: $CUSTOMER_ID"
    cd "$INSTANCE_DIR"
    docker compose up -d
    
    # Status updaten
    jq '.status = "active"' metadata.json > tmp.json && mv tmp.json metadata.json
    
    log "✅ Instance $CUSTOMER_ID started"
}

# =============================================================================
# Instanz komplett löschen
# =============================================================================
delete_instance() {
    local CUSTOMER_ID=$1
    local INSTANCE_DIR="$INSTANCES_DIR/$CUSTOMER_ID"
    
    if [ ! -d "$INSTANCE_DIR" ]; then
        error "Instance $CUSTOMER_ID not found!"
    fi
    
    warn "This will DELETE ALL DATA for $CUSTOMER_ID!"
    read -p "Type 'DELETE' to confirm: " confirm
    
    if [ "$confirm" != "DELETE" ]; then
        log "Aborted."
        exit 0
    fi
    
    log "Deleting instance: $CUSTOMER_ID"
    cd "$INSTANCE_DIR"
    docker compose down -v
    cd ..
    rm -rf "$CUSTOMER_ID"
    
    log "✅ Instance $CUSTOMER_ID deleted permanently"
}

# =============================================================================
# Alle Instanzen auflisten
# =============================================================================
list_instances() {
    log "SwissPhoto Instances:"
    echo ""
    printf "%-20s %-10s %-10s %-25s\n" "CUSTOMER" "STATUS" "STORAGE" "CREATED"
    printf "%-20s %-10s %-10s %-25s\n" "--------" "------" "-------" "-------"
    
    for dir in "$INSTANCES_DIR"/*/; do
        if [ -f "$dir/metadata.json" ]; then
            local customer=$(jq -r '.customer_id' "$dir/metadata.json")
            local status=$(jq -r '.status' "$dir/metadata.json")
            local storage=$(jq -r '.storage_gb' "$dir/metadata.json")
            local created=$(jq -r '.created_at' "$dir/metadata.json" | cut -d'T' -f1)
            printf "%-20s %-10s %-10s %-25s\n" "$customer" "$status" "${storage}GB" "$created"
        fi
    done
}

# =============================================================================
# RAM-Nutzung pro Instanz
# =============================================================================
stats() {
    log "Resource Usage:"
    echo ""
    docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}" | grep swissphoto
}

# =============================================================================
# Main
# =============================================================================
case "$1" in
    create)
        create_instance "$2" "$3" "$4"
        ;;
    stop)
        stop_instance "$2"
        ;;
    start)
        start_instance "$2"
        ;;
    delete)
        delete_instance "$2"
        ;;
    list)
        list_instances
        ;;
    stats)
        stats
        ;;
    *)
        echo "SwissPhoto Instance Manager"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  create <id> <gb> <email>  Create new instance"
        echo "  start <id>                Start stopped instance"
        echo "  stop <id>                 Stop instance (keeps data)"
        echo "  delete <id>               Delete instance permanently"
        echo "  list                      List all instances"
        echo "  stats                     Show resource usage"
        ;;
esac
