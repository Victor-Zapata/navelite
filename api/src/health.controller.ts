import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
    @Get()
    check() {
        return {
            status: 'ok',
            service: 'navelite-api',
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
        };
    }
}