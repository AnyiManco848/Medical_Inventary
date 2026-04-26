const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Insumo = sequelize.define('Insumo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  cantidad_disponible: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'activo',
    validate: {
      isIn: [['activo', 'en_mal_estado', 'dado_de_baja', 'prestado']],
    },
  },
  codigo_qr: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  imagen_ruta: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  fecha_registro: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  observaciones: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'Insumos',
  timestamps: true,
});

module.exports = Insumo;
