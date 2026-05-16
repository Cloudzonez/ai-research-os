module.exports = {
  apps: [
    {
      name: "ai-research-api",
      script: "server/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "./logs/api-error.log",
      out_file: "./logs/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_memory_restart: "500M",
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: "ai-research-worker",
      script: "server/workers/runner.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_memory_restart: "500M",
      autorestart: true,
      watch: false,
      max_restarts: 5,
      restart_delay: 10000,
    },
  ],
};
