import { Role } from '../../users/domain/value-objects/role';

export interface AuthUser {
  sub: string; // user id
  email: string;
  role: Role;
}
