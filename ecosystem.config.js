// PM2 ecosystem config for FinestSites on the Hetzner app server (188.245.35.52)
// Usage: pm2 start ecosystem.config.js && pm2 save
// Port: 3002 (Caddy proxies origin.womenplus.io → 3002)

module.exports = {
  apps: [
    {
      name: 'finestsites',
      script: '.next/standalone/server.js',
      cwd: '/var/www/finestsites',
      instances: 2,
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
