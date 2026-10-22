import { MigrationInterface, QueryRunner } from 'typeorm';

export class Brokers1788784913827 implements MigrationInterface {
  name = 'Brokers1788784913827';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "brokers" ("id" character varying NOT NULL, "cluster_id" character varying NOT NULL, "org" character varying NOT NULL, "ngsi" character varying NOT NULL, CONSTRAINT "PK_brokers_id" PRIMARY KEY ("id"))`,
    );
    // Nullable: existing context_history rows predate broker_id.
    await queryRunner.query(
      `ALTER TABLE "context_history" ADD "broker_id" character varying`,
    );
    // context_history is a hypertable — ADD CONSTRAINT support on hypertables
    // is unverified. If Postgres
    // rejects it, keep the column and skip the FK; broker_id is still
    // populated on every write.
    try {
      await queryRunner.query(
        `ALTER TABLE "context_history" ADD CONSTRAINT "FK_context_history_broker_id" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
      );
    } catch (err) {
      console.warn(
        `Brokers1788784913827: skipping context_history.broker_id FK, not supported on this hypertable: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "context_history" DROP CONSTRAINT IF EXISTS "FK_context_history_broker_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "context_history" DROP COLUMN "broker_id"`,
    );
    await queryRunner.query(`DROP TABLE "brokers"`);
  }
}
