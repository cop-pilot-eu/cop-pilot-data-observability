import { MigrationInterface, QueryRunner } from 'typeorm';

// Per-entity reads (slow-entity queries, native interval, first timestamp, entity skip-scan at startup).
// Blocks inserts into context_history while it builds.
export class ContextHistoryEntityIndex1793700000001 implements MigrationInterface {
  name = 'ContextHistoryEntityIndex1793700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "context_history_entity_observed_idx" ON "context_history" ("broker_id", "entity_id", "observed_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "context_history_entity_observed_idx"`);
  }
}
