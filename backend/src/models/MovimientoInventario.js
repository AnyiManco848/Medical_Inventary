const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoInventario = sequelize.define('MovimientoInventario', {
  id_movimiento: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_insumo: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tipo: {
    type: DataTypes.STRING(10),
    allowNull: false,
    validate: { isIn: [['entrada', 'salida']] },
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1 },
  },
  fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  usuario: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  numero_ambulancia: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  motivo: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'MovimientosInventario',
  timestamps: false,
});

module.exports = MovimientoInventario;
