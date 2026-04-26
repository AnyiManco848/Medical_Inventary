const sequelize = require('../config/database');

const Role = require('./Role');
const Usuario = require('./Usuario');
const Ambulancia = require('./Ambulancia');
const Hospital = require('./Hospital');
const Insumo = require('./Insumo');
const Trazabilidad = require('./Trazabilidad');
const MovimientoInventario = require('./MovimientoInventario');
const BajaInsumo = require('./BajaInsumo');
const ReasignacionAmbulancia = require('./ReasignacionAmbulancia');
const ContadorCodigo = require('./ContadorCodigo');

// --- Asociaciones ---

Usuario.belongsTo(Role, { foreignKey: 'roleId', as: 'rol' });
Role.hasMany(Usuario, { foreignKey: 'roleId' });

Usuario.belongsTo(Ambulancia, { foreignKey: 'ambulanciaId', as: 'ambulancia' });
Ambulancia.hasMany(Usuario, { foreignKey: 'ambulanciaId', as: 'usuarios' });

// Cada insumo pertenece a una ambulancia
Insumo.belongsTo(Ambulancia, { foreignKey: 'ambulanciaId', as: 'ambulancia', constraints: false });
Ambulancia.hasMany(Insumo, { foreignKey: 'ambulanciaId', as: 'insumos', constraints: false });

// Historial de bajas
BajaInsumo.belongsTo(Insumo, { foreignKey: 'insumoId', as: 'insumo', constraints: false });
Insumo.hasMany(BajaInsumo, { foreignKey: 'insumoId', as: 'bajas', constraints: false });

// Historial de reasignaciones
ReasignacionAmbulancia.belongsTo(Insumo, { foreignKey: 'insumoId', as: 'insumo', constraints: false });
Insumo.hasMany(ReasignacionAmbulancia, { foreignKey: 'insumoId', as: 'reasignaciones', constraints: false });

// Trazabilidad (módulo legacy)
Trazabilidad.belongsTo(Insumo, { foreignKey: 'insumoId', as: 'insumo', constraints: false });
Trazabilidad.belongsTo(Ambulancia, { foreignKey: 'ambulanciaId', as: 'ambulancia', constraints: false });
Trazabilidad.belongsTo(Hospital, { foreignKey: 'hospitalId', as: 'hospital', constraints: false });
Trazabilidad.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario', constraints: false });

MovimientoInventario.belongsTo(Insumo, { foreignKey: 'id_insumo', as: 'insumo', constraints: false });
Insumo.hasMany(MovimientoInventario, { foreignKey: 'id_insumo', as: 'movimientos', constraints: false });

module.exports = {
  sequelize,
  Role,
  Usuario,
  Ambulancia,
  Hospital,
  Insumo,
  Trazabilidad,
  MovimientoInventario,
  BajaInsumo,
  ReasignacionAmbulancia,
  ContadorCodigo,
};
