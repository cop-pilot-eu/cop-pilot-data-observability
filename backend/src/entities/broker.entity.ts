import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { ClusterId } from '../brokers/brokers.types';

@Entity('brokers')
export class Broker {
  @PrimaryColumn()
  id: string;

  @Column()
  clusterId: ClusterId;

  @Column()
  org: string;

  @Column()
  ngsi: string;
}
