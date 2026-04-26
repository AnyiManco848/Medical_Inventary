// Punto central de modelos: importa todos, define asociaciones y exporta
const sequelize = require('../config/database');

const Role = require('./Role');
const Usuario = require('./Usuario');
const Ambulancia = require('./Ambulancia');
const Hospital = require('./Hospital');
const Insumo = require('./Insumo');
const Trazabilidad = require('./Trazabilidad');
const MovimientoInventario = require('./MovimientoInventario');

// --- Asociaciones ---

// Usuario pertenece a un Role
Usuario.belongsTo(Role, { foreignKey: 'roleId', as: 'rol' });
Role.hasMany(Usuario, { foreignKey: 'roleId' });

// Usuario puede pertenecer a una Ambulancia (relación N:1, campo opcional)
Usuario.belongsTo(Ambulancia, { foreignKey: 'ambulanciaId', as: 'ambulancia' });
Ambulancia.hasMany(Usuario, { foreignKey: 'ambulanciaId', as: 'usuarios' });

// Trazabilidad pertenece a Insumo, Ambulancia, Hospital y Usuario
Trazabilidad.belongsTo(Insumo, { foreignKey: 'insumoId', as: 'insumo' });
Trazabilidad.belongsTo(Ambulancia, { foreignKey: 'ambulanciaId', as: 'ambulancia' });
Trazabilidad.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital' });
Trazabilidad.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

// Movimientos de inventario pertenecen a un Insumo
MovimientoInventario.belongsTo(Insumo, { foreignKey: 'id_insumo', as: 'insumo' });
Insumo.hasMany(MovimientoInventario, { foreignKey: 'id_insumo', as: 'movimientos' });

module.exports = {
  sequelize,
  Role,
  Usuario,
  Ambulancia,
  Hospital,
  Insumo,
  Trazabilidad,
  MovimientoInventario,
};
