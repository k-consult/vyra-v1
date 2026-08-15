# Single shared image for ingest / api / ui, entrypoint-switched.
FROM node:20-slim

WORKDIR /app

# Install all workspace deps in one pass (root package.json declares workspaces).
COPY package.json package-lock.json ./
COPY lib/package.json        lib/package.json
COPY cli/package.json        cli/package.json
COPY agents/package.json     agents/package.json
COPY api/package.json        api/package.json
COPY ui/package.json         ui/package.json
RUN npm ci

# Source.
COPY . .

# Build the shared foundation (lib/dist is used by the DB-ensure helper).
RUN npm run build:lib

# Bake the Next.js production build into the image. The browser runs on the
# host, so the default points at the host-published API port.
ARG NEXT_PUBLIC_API_URL=http://localhost:4001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN cd ui && npm run build

ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["api"]
