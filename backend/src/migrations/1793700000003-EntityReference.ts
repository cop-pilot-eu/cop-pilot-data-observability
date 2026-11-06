import { MigrationInterface, QueryRunner } from 'typeorm';

// entity_reference is filled by EntityReferenceService (boot, then hourly).
// reference_data is replaced by a time range of context_history /
// context_history_1m; check it is empty before running.
export class EntityReference1793700000003 implements MigrationInterface {
  name = 'EntityReference1793700000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "entity_reference" ("broker_id" character varying NOT NULL, "entity_id" character varying NOT NULL, "ref_start" TIMESTAMP WITH TIME ZONE NOT NULL, "ref_end" TIMESTAMP WITH TIME ZONE NOT NULL, "native_interval_s" double precision NOT NULL, "resampled" boolean NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_entity_reference" PRIMARY KEY ("broker_id", "entity_id"))`,
    );
    await queryRunner.query(`DROP TABLE "reference_data"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reference_data" ("observed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "time" TIMESTAMP WITH TIME ZONE NOT NULL, "entity_id" character varying NOT NULL, "entity_type" character varying NOT NULL, "attr_name" character varying NOT NULL, "attr_type" character varying, "value" jsonb, "metadata" jsonb, CONSTRAINT "PK_82cc80b58787b72dccd7b055690" PRIMARY KEY ("observed_at", "entity_id", "attr_name"))`,
    );
    await queryRunner.query(`DROP TABLE "entity_reference"`);
  }
}
