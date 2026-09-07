import { Railway } from "@railway/app";

export default {
  services: {
    backend: {
      source: ".",
      dockerfilePath: "Dockerfile.backend",
      build: {
        builder: "dockerfile",
      },
      deploy: {
        startCommand: "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
      },
    },
    frontend: {
      source: ".",
      dockerfilePath: "frontend/Dockerfile",
      build: {
        builder: "dockerfile",
      },
      deploy: {
        startCommand: "npm start",
      },
    },
  },
  databases: {
    mysql: {
      type: "mysql",
    },
  },
} satisfies Railway.Config;