import { Body, Controller, Get, Inject, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
    constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) { }

    @Post()
    @UseInterceptors(IdempotencyInterceptor)
    create(@Body() dto: CreatePaymentDto) {
        return this.payments.create(dto);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.payments.findOne(id);
    }

    @Get()
    list(@Query('merchantId') merchantId: string) {
        return this.payments.listByMerchant(merchantId);
    }

    @Get(':id/events')
    events(@Param('id') id: string) {
        return this.payments.timeline(id);
    }
}

