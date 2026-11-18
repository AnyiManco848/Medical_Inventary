const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Historial de insumos dados de baja (registro permanente)
const BajaInsumo = sequelize.define('BajaInsumo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  insumoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  codigo: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  familia: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  especificaciones: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  ambulancia_codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  motivo: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  foto_ruta: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  fecha_baja: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'BajasInsumos',
  timestamps: false,
});

module.exports = BajaInsumo;
