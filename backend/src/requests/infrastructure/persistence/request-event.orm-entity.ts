import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AuditAction } from '../../domain/entities/request-event';
import { RequestStatus } from '../../domain/value-objects/request-status';

@Entity('request_events')
export class RequestEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'request_id', type: 'uuid' })
  requestId!: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @Column({ type: 'varchar', length: 32 })
  action!: AuditAction;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status',
    nullable: true,
  })
  fromStatus!: RequestStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status',
  })
  toStatus!: RequestStatus;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
