import { DuckDBInstance } from '@duckdb/node-api';
import os from 'os';
import path from 'path';

async function test() {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  const file = path.join(os.tmpdir(), "kompon-data", "hazard_grid.parquet");
  try {
    const prepared = await connection.prepare(`SELECT * FROM read_parquet('${file.replace(/\\/g, '/')}') LIMIT 1`);
    const result = await prepared.run();
    const rows = await result.getRows();
    const columns = result.columnNames();
    const row = {};
    columns.forEach((col, idx) => { row[col] = rows[0][idx]; });
    console.log(JSON.stringify(row, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
