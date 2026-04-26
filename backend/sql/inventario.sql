-- ============================================================
-- Script: Módulo de Inventario de Insumos Médicos
-- Base de datos: MedicalInventary (SQL Server 2017+)
-- Ejecutar sobre la base de datos MedicalInventary
-- ============================================================

USE MedicalInventary;
GO

-- ─── Tabla Insumos ────────────────────────────────────────────────────────────
-- Crea la tabla si no existe; si existe, agrega las columnas nuevas del módulo
IF NOT EXISTS (
  SELECT 1 FROM sys.objects
  WHERE object_id = OBJECT_ID(N'[dbo].[Insumos]') AND type = 'U'
)
BEGIN
  CREATE TABLE [dbo].[Insumos] (
    [id]                   INT           IDENTITY(1,1) NOT NULL,
    [nombre]               VARCHAR(100)  NOT NULL,
    [cantidad_disponible]  INT           NOT NULL DEFAULT 0,
    [estado]               VARCHAR(20)   NOT NULL DEFAULT 'activo',
    [codigo_qr]            VARCHAR(255)  NULL,
    [imagen_ruta]          VARCHAR(500)  NULL,
    [fecha_registro]       DATETIME      NOT NULL DEFAULT GETDATE(),
    [observaciones]        VARCHAR(500)  NULL,
    [createdAt]            DATETIME      NOT NULL DEFAULT GETDATE(),
    [updatedAt]            DATETIME      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_Insumos PRIMARY KEY ([id]),
    CONSTRAINT CK_Insumos_Estado CHECK ([estado] IN ('activo','en_mal_estado','dado_de_baja','prestado'))
  );
  PRINT 'Tabla Insumos creada.';
END
ELSE
BEGIN
  -- Agregar columnas del módulo de inventario si no existen (migración)
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Insumos') AND name = 'cantidad_disponible')
    ALTER TABLE [dbo].[Insumos] ADD [cantidad_disponible] INT NOT NULL DEFAULT 0;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Insumos') AND name = 'estado')
    ALTER TABLE [dbo].[Insumos] ADD [estado] VARCHAR(20) NOT NULL DEFAULT 'activo';

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Insumos') AND name = 'codigo_qr')
    ALTER TABLE [dbo].[Insumos] ADD [codigo_qr] VARCHAR(255) NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Insumos') AND name = 'imagen_ruta')
    ALTER TABLE [dbo].[Insumos] ADD [imagen_ruta] VARCHAR(500) NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Insumos') AND name = 'fecha_registro')
    ALTER TABLE [dbo].[Insumos] ADD [fecha_registro] DATETIME NOT NULL DEFAULT GETDATE();

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Insumos') AND name = 'observaciones')
    ALTER TABLE [dbo].[Insumos] ADD [observaciones] VARCHAR(500) NULL;

  PRINT 'Columnas de Insumos verificadas/agregadas.';
END
GO

-- Poblar codigo_qr con UUID para filas existentes que tengan NULL
UPDATE [dbo].[Insumos]
SET [codigo_qr] = LOWER(CONVERT(VARCHAR(36), NEWID()))
WHERE [codigo_qr] IS NULL;
GO

-- Índice único parcial sobre codigo_qr (WHERE IS NOT NULL)
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Insumos') AND name = 'UQ_Insumos_CodigoQR'
)
BEGIN
  CREATE UNIQUE INDEX [UQ_Insumos_CodigoQR]
    ON [dbo].[Insumos]([codigo_qr])
    WHERE [codigo_qr] IS NOT NULL;
  PRINT 'Índice único en codigo_qr creado.';
END
GO

-- ─── Tabla MovimientosInventario ──────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.objects
  WHERE object_id = OBJECT_ID(N'[dbo].[MovimientosInventario]') AND type = 'U'
)
BEGIN
  CREATE TABLE [dbo].[MovimientosInventario] (
    [id_movimiento]      INT           IDENTITY(1,1) NOT NULL,
    [id_insumo]          INT           NOT NULL,
    [tipo]               VARCHAR(10)   NOT NULL,
    [cantidad]           INT           NOT NULL,
    [fecha]              DATETIME      NOT NULL DEFAULT GETDATE(),
    [usuario]            VARCHAR(100)  NOT NULL,
    [numero_ambulancia]  VARCHAR(50)   NULL,
    [motivo]             VARCHAR(255)  NULL,
    CONSTRAINT PK_MovimientosInventario PRIMARY KEY ([id_movimiento]),
    CONSTRAINT CK_Movimientos_Tipo CHECK ([tipo] IN ('entrada','salida')),
    CONSTRAINT FK_Movimientos_Insumo FOREIGN KEY ([id_insumo])
      REFERENCES [dbo].[Insumos]([id])
  );

  CREATE INDEX IX_Movimientos_Insumo ON [dbo].[MovimientosInventario]([id_insumo]);
  CREATE INDEX IX_Movimientos_Fecha  ON [dbo].[MovimientosInventario]([fecha] DESC);

  PRINT 'Tabla MovimientosInventario creada.';
END
ELSE
BEGIN
  PRINT 'Tabla MovimientosInventario ya existe, omitiendo.';
END
GO

-- ─── Datos iniciales ──────────────────────────────────────────────────────────
-- Solo inserta si la tabla está vacía para evitar duplicados
IF NOT EXISTS (SELECT 1 FROM [dbo].[Insumos] WHERE [nombre] IN ('Baxstrap','Bloque','Botiquín','Araña','Collar','Estuche'))
BEGIN
  INSERT INTO [dbo].[Insumos] ([nombre],[cantidad_disponible],[estado],[codigo_qr]) VALUES
    ('Baxstrap', 6,  'activo', LOWER(CONVERT(VARCHAR(36), NEWID()))),
    ('Bloque',   6,  'activo', LOWER(CONVERT(VARCHAR(36), NEWID()))),
    ('Botiquín', 16, 'activo', LOWER(CONVERT(VARCHAR(36), NEWID()))),
    ('Araña',    12, 'activo', LOWER(CONVERT(VARCHAR(36), NEWID()))),
    ('Collar',   14, 'activo', LOWER(CONVERT(VARCHAR(36), NEWID()))),
    ('Estuche',  17, 'activo', LOWER(CONVERT(VARCHAR(36), NEWID())));
  PRINT 'Datos iniciales de insumos insertados.';
END
ELSE
BEGIN
  PRINT 'Datos iniciales ya existen, omitiendo.';
END
GO

PRINT '✅ Script de inventario ejecutado correctamente.';
