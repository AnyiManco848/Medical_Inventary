const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Tabla con una sola fila: contador global para generar INS-FAM-### únicos
const ContadorCodigo = sequelize.define('ContadorCodigo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  valor: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'ContadorCodigo',
  timestamps: false,
});

module.exports = ContadorCodigo;
