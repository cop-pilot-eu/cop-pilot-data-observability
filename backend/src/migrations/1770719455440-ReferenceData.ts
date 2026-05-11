import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReferenceData1770719455440 implements MigrationInterface {
  name = 'ReferenceData1770719455440';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reference_data" ("observed_at" TIMESTAMP WITH TIME ZONE NOT NULL, "time" TIMESTAMP WITH TIME ZONE NOT NULL, "entity_id" character varying NOT NULL, "entity_type" character varying NOT NULL, "attr_name" character varying NOT NULL, "attr_type" character varying, "value" jsonb, "metadata" jsonb, CONSTRAINT "PK_82cc80b58787b72dccd7b055690" PRIMARY KEY ("observed_at", "entity_id", "attr_name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reference_data"`);
  }
}
