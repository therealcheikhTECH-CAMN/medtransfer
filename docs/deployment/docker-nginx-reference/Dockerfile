# ==============================================================================
# MEDTRANSFER — Dockerfile Frontend (Build Multi-stage React/Vite + Nginx)
# ==============================================================================

# Étape 1 : Build de l'application Vite
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Étape 2 : Production Nginx ultra-légère avec redirection SPA index.html
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
