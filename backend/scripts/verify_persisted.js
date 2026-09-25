const { pool } = require('../db');

async function main() {
  const res = await pool.query(`
    SELECT d.id, d.food_description, d.food_type, d.quantity, d.status, d.notes, d.temperature_condition,
           dn.org_name, drv.name as driver_name, del.id as delivery_id
    FROM donations d
    JOIN donors dn ON dn.id = d.donor_id
    JOIN drivers drv ON drv.id = d.matched_driver_id
    LEFT JOIN deliveries del ON del.donation_id = d.id
    WHERE drv.id = '6eb70465-624a-4a2f-9fbb-c43657e02ef4'
  `);
  console.log('Persisted Database Record:', JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch(console.error);
