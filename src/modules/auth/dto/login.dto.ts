import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  usuario!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  /** IMEI simulado del dispositivo (Android ID, HU-39). Solo login de cobrador. */
  @IsOptional()
  @IsString()
  imei?: string;

  /** WhatsApp autorizado del cobrador (HU-39). Solo login de cobrador. */
  @IsOptional()
  @IsString()
  whatsappNumber?: string;
}
