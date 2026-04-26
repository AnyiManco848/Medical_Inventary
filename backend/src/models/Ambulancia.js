const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ambulancia = sequelize.define('Ambulancia', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
    // unique gestionado en indexes para compatibilidad con SQL Server + alter: true
  },
  placa: {
    type: DataTypes.STRING(20),
    allowNull: true,
    // unique gestionado en indexes para compatibilidad con SQL Server + alter: true
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  activa: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'Ambulancias',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['codigo'] },
    { unique: true, fields: ['placa'] },
  ],
});

module.exports = Ambulancia;
