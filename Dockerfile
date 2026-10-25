FROM node:18.20.4-bookworm-slim

RUN groupadd -r appgrp && useradd -r -g appgrp appuser

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . ./

ENV NODE_ENV=production
EXPOSE 3000

USER appuser

HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('http').get('http://localhost:3000/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
