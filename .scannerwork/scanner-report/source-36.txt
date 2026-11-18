const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Trazabilidad = sequelize.define('Trazabilidad', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  insumoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Insumos', key: 'id' },
  },
  ambulanciaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Ambulancias', key: 'id' },
  },
  hospitalId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Hospitales', key: 'id' },
  },
  usuarioId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Usuarios', key: 'id' },
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fecha_entrega: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_recuperacion: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Estado del insumo en la trazabilidad
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'entregado',
    validate: {
      isIn: {
        args: [['entregado', 'recuperado', 'perdido', 'dañado']],
        msg: 'Estado debe ser: entregado, recuperado, perdido o dañado',
      },
    },
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'Trazabilidad',
  timestamps: true,
});

module.exports = Trazabilidad;
