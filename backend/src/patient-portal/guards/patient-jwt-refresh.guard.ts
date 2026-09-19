import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PatientJwtRefreshGuard extends AuthGuard('patient-jwt-refresh') {}
