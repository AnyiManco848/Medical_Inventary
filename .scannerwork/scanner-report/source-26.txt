const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CentroAsistencial = sequelize.define('CentroAsistencial', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true,
  },
  nombre: {
    type:      DataTypes.STRING(200),
    allowNull: false,
  },
  municipio: {
    type:         DataTypes.STRING(100),
    defaultValue: 'Valle de Aburrá',
  },
  activo: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
  },
  esOtro: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false,
  },
  direccion: {
    type:      DataTypes.STRING(300),
    allowNull: true,
  },
  telefono: {
    type:      DataTypes.STRING(30),
    allowNull: true,
  },
  correo: {
    type:      DataTypes.STRING(150),
    allowNull: true,
  },
  fechaRegistro: {
    type:      DataTypes.DATEONLY,
    allowNull: true,
  },
}, {
  tableName:  'CentrosAsistenciales',
  timestamps: false,
});

module.exports = CentroAsistencial;
