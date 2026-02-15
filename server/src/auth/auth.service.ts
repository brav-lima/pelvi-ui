import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';
import { LoginDto } from './dto/login.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personService: PersonService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const person = await this.prisma.person.findUnique({
      where: { cpf: dto.cpf },
    });

    if (!person || !person.active) {
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const passwordValid = await bcrypt.compare(dto.password, person.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('CPF ou senha inválidos');
    }

    const organizations = await this.personService.findOrganizations(person.id);

    if (organizations.length === 0) {
      throw new UnauthorizedException(
        'Nenhuma clínica vinculada a este usuário',
      );
    }

    const personData = {
      id: person.id,
      cpf: person.cpf,
      name: person.name,
      email: person.email,
    };

    if (organizations.length === 1) {
      const org = organizations[0];
      const accessToken = this.generateToken(
        person.id,
        org.organization.id,
        org.role,
      );

      return {
        accessToken,
        person: personData,
        organization: org.organization,
        role: org.role,
      };
    }

    return {
      accessToken: null,
      person: personData,
      organizations,
    };
  }

  async selectOrganization(dto: SelectOrganizationDto) {
    const link = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: {
          organizationId: dto.organizationId,
          personId: dto.personId,
        },
      },
      include: {
        organization: true,
        person: {
          select: {
            id: true,
            cpf: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!link || !link.active) {
      throw new UnauthorizedException(
        'Vínculo inválido ou inativo',
      );
    }

    const accessToken = this.generateToken(
      dto.personId,
      dto.organizationId,
      link.role,
    );

    return {
      accessToken,
      person: link.person,
      organization: link.organization,
      role: link.role,
    };
  }

  async getProfile(payload: JwtPayload) {
    const person = await this.prisma.person.findUnique({
      where: { id: payload.sub },
      select: { id: true, cpf: true, name: true, email: true, phone: true },
    });

    const orgUser = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: {
          organizationId: payload.organizationId,
          personId: payload.sub,
        },
      },
      include: { organization: true },
    });

    return {
      person,
      organization: orgUser?.organization ?? null,
      role: payload.role,
    };
  }

  async updateProfile(payload: JwtPayload, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.prisma.person.findFirst({
        where: { email: dto.email, NOT: { id: payload.sub } },
      });
      if (existing) {
        throw new ConflictException('Email já cadastrado');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;

    return this.prisma.person.update({
      where: { id: payload.sub },
      data,
      select: { id: true, cpf: true, name: true, email: true, phone: true },
    });
  }

  async changePassword(payload: JwtPayload, dto: ChangePasswordDto) {
    const person = await this.prisma.person.findUnique({
      where: { id: payload.sub },
    });

    if (!person) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const valid = await bcrypt.compare(dto.currentPassword, person.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.person.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });

    return { message: 'Senha alterada com sucesso' };
  }

  private generateToken(
    personId: string,
    organizationId: string,
    role: string,
  ): string {
    return this.jwtService.sign({
      sub: personId,
      organizationId,
      role,
    });
  }
}
