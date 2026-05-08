import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(11, 11, { message: 'CPF deve ter exatamente 11 dígitos' })
  @Matches(/^\d{11}$/, { message: 'CPF deve conter apenas números' })
  cpf!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
