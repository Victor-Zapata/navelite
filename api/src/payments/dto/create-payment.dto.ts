import { IsIn, IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CreatePaymentDto {
    @IsString()
    @Length(3, 40)
    merchantId: string;

    @IsInt({ message: 'amountCents must be an integer number of cents' })
    @Min(100)
    @Max(100_000_000)
    amountCents: number;

    @IsIn([1, 3, 6, 12])
    installments: 1 | 3 | 6 | 12;

    @IsString()
    @Length(1, 80)
    orderId: string;
}