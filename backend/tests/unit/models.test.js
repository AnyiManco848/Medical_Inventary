import { describe, it, expect } from 'vitest';
import { cjs } from '../helpers.js';

// models/index.js define las asociaciones entre modelos. Si un alias o una clave foránea cambia,
// los include: [{ as: '...' }] de los controladores dejan de funcionar; estas pruebas lo detectan.
// Solo se inspecciona la metadata de Sequelize: no se conecta a ninguna base.
const modelos = cjs('../src/models');
const sequelize = cjs('../src/config/database');

const EXPORTADOS = [
  'sequelize', 'Role', 'Usuario', 'Ambulancia', 'Hospital', 'Insumo', 'Trazabilidad',
  'MovimientoInventario', 'BajaInsumo', 'ReasignacionAmbulancia', 'ContadorCodigo',
  'CentroAsistencial', 'MovimientoInsumo', 'ReporteInsumo',
];

describe('models/index.js', () => {
  it('exporta todos los modelos y la misma instancia de Sequelize de config/database', () => {
    expect(Object.keys(modelos).sort()).toEqual([...EXPORTADOS].sort());
    expect(modelos.sequelize).toBe(sequelize);
  });

  it('todos los modelos están registrados en esa instancia', () => {
    for (const nombre of EXPORTADOS.filter((n) => n !== 'sequelize')) {
      expect(modelos[nombre].sequelize, nombre).toBe(sequelize);
    }
  });

  // [modelo, alias, tipo, destino, clave foránea]
  it.each([
    ['Usuario', 'rol', 'BelongsTo', 'Role', 'roleId'],
    ['Usuario', 'ambulancia', 'BelongsTo', 'Ambulancia', 'ambulanciaId'],
    ['Ambulancia', 'usuarios', 'HasMany', 'Usuario', 'ambulanciaId'],
    ['Insumo', 'ambulancia', 'BelongsTo', 'Ambulancia', 'ambulanciaId'],
    ['Ambulancia', 'insumos', 'HasMany', 'Insumo', 'ambulanciaId'],
    ['BajaInsumo', 'insumo', 'BelongsTo', 'Insumo', 'insumoId'],
    ['Insumo', 'bajas', 'HasMany', 'BajaInsumo', 'insumoId'],
    ['ReasignacionAmbulancia', 'insumo', 'BelongsTo', 'Insumo', 'insumoId'],
    ['Insumo', 'reasignaciones', 'HasMany', 'ReasignacionAmbulancia', 'insumoId'],
    ['Trazabilidad', 'insumo', 'BelongsTo', 'Insumo', 'insumoId'],
    ['Trazabilidad', 'ambulancia', 'BelongsTo', 'Ambulancia', 'ambulanciaId'],
    ['Trazabilidad', 'hospital', 'BelongsTo', 'Hospital', 'hospitalId'],
    ['Trazabilidad', 'usuario', 'BelongsTo', 'Usuario', 'usuarioId'],
    ['MovimientoInventario', 'insumo', 'BelongsTo', 'Insumo', 'id_insumo'],
    ['Insumo', 'movimientos', 'HasMany', 'MovimientoInventario', 'id_insumo'],
    ['MovimientoInsumo', 'insumo', 'BelongsTo', 'Insumo', 'insumoId'],
    ['MovimientoInsumo', 'centroAsistencial', 'BelongsTo', 'CentroAsistencial', 'centroAsistencialId'],
    ['MovimientoInsumo', 'ambulancia', 'BelongsTo', 'Ambulancia', 'ambulanciaId'],
    ['MovimientoInsumo', 'usuario', 'BelongsTo', 'Usuario', 'usuarioId'],
    ['ReporteInsumo', 'insumo', 'BelongsTo', 'Insumo', 'insumoId'],
    ['ReporteInsumo', 'ambulancia', 'BelongsTo', 'Ambulancia', 'ambulanciaId'],
    ['ReporteInsumo', 'usuario', 'BelongsTo', 'Usuario', 'usuarioId'],
  ])('%s.%s es %s de %s por %s', (modelo, alias, tipo, destino, fk) => {
    const asociacion = modelos[modelo].associations[alias];

    expect(asociacion, `falta la asociación ${modelo}.${alias}`).toBeDefined();
    expect(asociacion.associationType).toBe(tipo);
    expect(asociacion.target).toBe(modelos[destino]);
    expect(asociacion.foreignKey).toBe(fk);
  });

  it('Role.hasMany(Usuario) usa roleId (sin alias)', () => {
    const asociacion = Object.values(modelos.Role.associations).find((a) => a.target === modelos.Usuario);

    expect(asociacion.associationType).toBe('HasMany');
    expect(asociacion.foreignKey).toBe('roleId');
  });

  it('las relaciones con Insumo no crean restricciones de clave foránea en la base', () => {
    expect(modelos.Insumo.associations.ambulancia.options.constraints).toBe(false);
    expect(modelos.BajaInsumo.associations.insumo.options.constraints).toBe(false);
    expect(modelos.MovimientoInsumo.associations.centroAsistencial.options.constraints).toBe(false);
  });
});
