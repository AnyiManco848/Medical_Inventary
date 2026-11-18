const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  // numero_ambulancia: identificador único de login (ej: "Ambulancia01", "Administrador01")
  numero_ambulancia: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El identificador de usuario no puede estar vacío',
      },
    },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  intentos_fallidos: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  bloqueado_hasta: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Roles',
      key: 'id',
    },
  },
  ambulanciaId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
    references: {
      model: 'Ambulancias',
      key: 'id',
    },
  },
}, {
  tableName: 'Usuarios',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['numero_ambulancia'] },
  ],
});

module.exports = Usuario;
