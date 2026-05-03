require('dotenv').config();
const { sequelize } = require('../models');

async function diagnostico() {
  await sequelize.authenticate();

  const [cols] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Usuarios' ORDER BY ORDINAL_POSITION`
  );
  console.log('COLUMNAS Usuarios:', cols.map(c => c.COLUMN_NAME));

  const [users] = await sequelize.query(`SELECT id, nombre, numero_ambulancia, roleId, activo FROM Usuarios`);
  console.log('TOTAL USUARIOS:', users.length);
  console.log('USUARIOS:', JSON.stringify(users, null, 2));

  const [roles] = await sequelize.query(`SELECT * FROM Roles`);
  console.log('ROLES:', JSON.stringify(roles, null, 2));

  const [indexes] = await sequelize.query(
    `SELECT i.name, c.name as columna FROM sys.indexes i
     JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
     JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
     WHERE i.object_id = OBJECT_ID('Usuarios')`
  );
  console.log('INDEXES Usuarios:', JSON.stringify(indexes, null, 2));

  await sequelize.close();
}
diagnostico().catch(e => { console.error(e); process.exit(1); });
