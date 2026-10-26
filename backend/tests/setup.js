// Variables de entorno para las pruebas (se ejecuta antes de cada archivo de test).
// No se usa ninguna base de datos real: los modelos se simulan en cada prueba.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-solo-para-pruebas';
process.env.JWT_EXPIRES_IN = '1h';
process.env.FRONTEND_URL = 'http://localhost:3000';
