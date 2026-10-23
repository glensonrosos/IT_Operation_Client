FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json yarn.lock ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN corepack enable && yarn install --frozen-lockfile --ignore-scripts
COPY client ./client
RUN yarn workspace @itms/client build

FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
