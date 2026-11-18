const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false,
    // No poner unique: true aquí — SQL Server no acepta ALTER COLUMN ... UNIQUE
    // El índice único se define en la opción indexes del modelo
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'Roles',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['nombre'] },
  ],
});

module.exports = Role;
