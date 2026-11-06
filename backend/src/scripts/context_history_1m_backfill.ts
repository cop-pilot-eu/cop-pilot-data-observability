import dataSource from '../ormconfig';

// Fill context_history_1m history one hypertable chunk (7 days) at a time.
// refresh_continuous_aggregate cannot run in a transaction, so each CALL is its
// own autocommit query. A failed chunk is logged with its CALL; re-run only
// that one.
async function main(): Promise<void> {
  await dataSource.initialize();
  const chunks: { range_start: Date; range_end: Date }[] =
    await dataSource.query(
      `SELECT range_start, range_end FROM timescaledb_information.chunks
       WHERE hypertable_name = 'context_history' ORDER BY range_start`,
    );
  const failed: string[] = [];
  for (const { range_start: start, range_end: end } of chunks) {
    const call = `CALL refresh_continuous_aggregate('context_history_1m', '${start.toISOString()}', '${end.toISOString()}');`;
    const t0 = Date.now();
    try {
      await dataSource.query(
        `CALL refresh_continuous_aggregate('context_history_1m', $1::timestamptz, $2::timestamptz)`,
        [start, end],
      );
      console.log(
        `ok   ${start.toISOString()} .. ${end.toISOString()} (${Date.now() - t0} ms)`,
      );
    } catch (err) {
      failed.push(call);
      console.error(
        `FAIL ${start.toISOString()} .. ${end.toISOString()}: ${(err as Error).message}`,
      );
    }
  }
  await dataSource.destroy();
  if (failed.length) {
    console.error(
      `${failed.length} chunk(s) failed. Re-run:\n${failed.join('\n')}`,
    );
    process.exit(1);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
