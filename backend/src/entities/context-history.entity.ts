import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class ContextHistory {
  @PrimaryColumn({ type: 'timestamptz' })
  observedAt: Date;

  @Column({ type: 'timestamptz' })
  time: Date;

  @PrimaryColumn()
  entityId: string;

  @Column()
  entityType: string;

  @PrimaryColumn()
  attrName: string;

  @Column({ nullable: true })
  attrType: string;

  @Column({ type: 'jsonb', nullable: true })
  value: any;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  brokerId: string;
}

export type ContextHistoryType = ContextHistory;
