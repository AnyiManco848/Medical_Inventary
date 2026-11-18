const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Insumo = sequelize.define('Insumo', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Nuevo: código único por unidad física (INS-FAM-###)
  codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  // Nuevo: familia del insumo (Collarín cervical, Venda, etc.)
  familia: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  // Nuevo: abreviatura de 3-5 letras usada en el código (COL, VEN, OXI…)
  familia_abrev: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  // Nuevo: especificaciones de la unidad (talla S, 4", etc.)
  especificaciones: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'activo',
    validate: {
      isIn: [['activo', 'dado_de_baja']],
    },
  },
  // Nuevo: ambulancia asignada a este insumo
  ambulanciaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // Campos legacy mantenidos por compatibilidad con datos existentes
  cantidad_disponible: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  codigo_qr: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  imagen_ruta: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  fecha_registro: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  observaciones: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
}, {
  tableName: 'Insumos',
  timestamps: true, // createdAt = fecha_creacion, updatedAt = fecha_modificacion
});

module.exports = Insumo;
