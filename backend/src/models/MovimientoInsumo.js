const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoInsumo = sequelize.define('MovimientoInsumo', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  tipo: {
    type:      DataTypes.STRING(20),
    allowNull: false,
    validate:  { isIn: [['entrega', 'recogida']] },
  },
  insumoId: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  codigoInsumo: {
    type:      DataTypes.STRING(20),
    allowNull: true,
  },
  nombrePaciente: {
    type:      DataTypes.STRING(200),
    allowNull: true,
  },
  historiaClinica: {
    type:      DataTypes.STRING(100),
    allowNull: true,
  },
  centroAsistencialId: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  centroOtro: {
    type:      DataTypes.STRING(200),
    allowNull: true,
  },
  fecha: {
    type:      DataTypes.DATEONLY,
    allowNull: false,
  },
  hora: {
    type:      DataTypes.TIME,
    allowNull: false,
  },
  tripulacion: {
    type:      DataTypes.STRING(200),
    allowNull: true,
  },
  nombreMedico: {
    type:      DataTypes.STRING(200),
    allowNull: true,
  },
  ambulanciaId: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  usuarioId: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName:  'MovimientosInsumo',
  timestamps: true,
  updatedAt:  false,
});

module.exports = MovimientoInsumo;
