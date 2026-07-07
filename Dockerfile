FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV OLLAMA_URL=http://ollama:11434
ENV DATA_DIR=/data
ENV WORKSPACE_ROOT=/workspace

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY . .
RUN mkdir -p /data /workspace

EXPOSE 8787

CMD ["npm", "start"]
