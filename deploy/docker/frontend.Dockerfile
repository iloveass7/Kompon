FROM node:20-bookworm-slim AS build

WORKDIR /app/Frontend

ARG VITE_API_ORIGIN=http://localhost:3001
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN

COPY Frontend/package*.json ./
RUN npm ci

COPY Frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/Frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
