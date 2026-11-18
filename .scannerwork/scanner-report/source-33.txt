const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Registro de reasignaciones (permanentes) y préstamos temporales entre ambulancias
const ReasignacionAmbulancia = sequelize.define('ReasignacionAmbulancia', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  insumoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  codigo_insumo: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  ambulancia_anterior_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  ambulancia_anterior_codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  ambulancia_nueva_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  ambulancia_nueva_codigo: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  // permanente = cambio definitivo, prestamo = uso temporal
  tipo: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'permanente',
    validate: { isIn: [['permanente', 'prestamo']] },
  },
  notas: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  fecha_reasignacion: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  // Solo para préstamos: fecha esperada de devolución
  fecha_devolucion_esperada: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  usuario_responsable: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'ReasignacionesAmbulancia',
  timestamps: false,
});

module.exports = ReasignacionAmbulancia;
