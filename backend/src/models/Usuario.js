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
  // cedula: identificador principal de login — único, solo dígitos, 6-15 caracteres
  cedula: {
    type: DataTypes.STRING(15),
    allowNull: false,
    validate: {
      is: {
        args: /^[0-9]{6,15}$/,
        msg: 'La cédula debe contener solo dígitos y tener entre 6 y 15 caracteres',
      },
    },
  },
  // numero_ambulancia: segundo factor de autenticación almacenado por usuario
  numero_ambulancia: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El número de ambulancia no puede estar vacío',
      },
    },
  },
  // email: ahora opcional, conservado para datos históricos
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: {
      isEmail: {
        msg: 'El email debe tener un formato válido',
      },
    },
  },
  // Siempre almacenar hash bcrypt, nunca la contraseña en texto plano
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
  // FK opcional: solo usuarios con rol "ambulancia" tienen ambulancia asignada
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
    // cedula es el nuevo identificador único de login
    { unique: true, fields: ['cedula'] },
  ],
});

module.exports = Usuario;
