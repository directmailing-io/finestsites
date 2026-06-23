// PM2 ecosystem config for FinestSites on Hostinger VPS
// Usage: pm2 start ecosystem.config.js
// Port: 3002 (directmailing.io uses 3000)

module.exports = {
  apps: [
    {
      name: 'finestsites',
      script: '.next/standalone/server.js',
      cwd: '/var/www/finestsites',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
        HOSTNAME: '0.0.0.0',
      },
      env_file: '/var/www/finestsites/.env.production',
    },
  ],
}
