const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReporteInsumo = sequelize.define('ReporteInsumo', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  tipo: {
    type:      DataTypes.STRING(20),
    allowNull: false,
    validate:  { isIn: [['dano', 'perdida']] },
  },
  insumoId: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  codigoInsumo: {
    type:      DataTypes.STRING(50),
    allowNull: true,
  },
  motivo: {
    type:      DataTypes.TEXT,
    allowNull: false,
  },
  fotosRutas: {
    type:         DataTypes.JSONB,
    allowNull:    true,
    defaultValue: [],
  },
  fecha: {
    type:      DataTypes.DATEONLY,
    allowNull: false,
  },
  hora: {
    type:      DataTypes.TIME,
    allowNull: false,
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
  tableName:  'ReportesInsumo',
  timestamps: true,
  updatedAt:  false,
});

module.exports = ReporteInsumo;
