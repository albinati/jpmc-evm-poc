FROM node:20-bookworm AS build
WORKDIR /f
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx-frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /f/dist /usr/share/nginx/html
EXPOSE 80
