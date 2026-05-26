USE padron;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE sync_log;
TRUNCATE TABLE incidencias;
TRUNCATE TABLE logistica_traslados;
TRUNCATE TABLE logistica_vehiculos;
TRUNCATE TABLE electores;
TRUNCATE TABLE mesas;
TRUNCATE TABLE barrios;
TRUNCATE TABLE usuarios;
SET FOREIGN_KEY_CHECKS = 1;

-- Usuarios (password: '123456' bcrypt hashed)
INSERT INTO usuarios (id, nombre, email, password_hash, rol, qr_uuid, activo, telefono, direccion, avatar, permisos) VALUES
(1, 'Admin General', 'admin@padron.py', '$2a$10$DzJwLoUkoBlSbD2.4vH7O.y/HsvPbGaTc3LsjSE2uD88TDoVzgXLK', 'admin', UUID(), 1, '0981999999', 'Avda. Principal 123', NULL, '{"dashboard":true,"electores":true,"cargar":true,"mesas":true,"mapa":true,"logistica":true,"emergencia":true}'),
(2, 'Juan Veedor', 'veedor1@padron.py', '$2a$10$DzJwLoUkoBlSbD2.4vH7O.y/HsvPbGaTc3LsjSE2uD88TDoVzgXLK', 'veedor', UUID(), 1, '0981888888', 'Calle Secundaria 456', NULL, '{"dashboard":true,"electores":true,"cargar":true,"mesas":true,"mapa":true,"logistica":false,"emergencia":true}'),
(3, 'Maria Coordinadora', 'coord1@padron.py', '$2a$10$DzJwLoUkoBlSbD2.4vH7O.y/HsvPbGaTc3LsjSE2uD88TDoVzgXLK', 'coordinador', UUID(), 1, '0981777777', 'Pasaje 1 789', NULL, '{"dashboard":true,"electores":true,"cargar":true,"mesas":true,"mapa":true,"logistica":true,"emergencia":true}'),
(4, 'Pedro Logistica', 'log1@padron.py', '$2a$10$DzJwLoUkoBlSbD2.4vH7O.y/HsvPbGaTc3LsjSE2uD88TDoVzgXLK', 'logistica', UUID(), 1, '0981666666', 'Calle Principal 101', NULL, '{"dashboard":true,"electores":false,"cargar":false,"mesas":true,"mapa":true,"logistica":true,"emergencia":false}'),
(5, 'Candidato Principal', 'candidato@padron.py', '$2a$10$DzJwLoUkoBlSbD2.4vH7O.y/HsvPbGaTc3LsjSE2uD88TDoVzgXLK', 'candidato', UUID(), 1, '0981555555', 'Avda. Costanera 202', NULL, '{"dashboard":true,"electores":true,"cargar":false,"mesas":true,"mapa":true,"logistica":false,"emergencia":false}');

-- Barrios
INSERT INTO barrios (id, nombre, lat, lng, color_mapa) VALUES
(1, 'San Miguel', -25.2829, -57.6350, '#28a745'),
(2, 'Centro', -25.2867, -57.3333, '#007bff'),
(3, 'Villa Morra', -25.2934, -57.5800, '#ffc107'),
(4, 'La Recoleta', -25.3100, -57.6200, '#dc3545'),
(5, 'Fernando de la Mora', -25.3200, -57.5500, '#6f42c1');

-- Mesas
INSERT INTO mesas (id, numero, local, direccion, lat, lng, electores_esperados, barrio_id) VALUES
(1, 1450, 'Escuela San Jose', 'Calle 1 esq. 2', -25.2830, -57.6351, 320, 1),
(2, 1451, 'Escuela San Jose', 'Calle 1 esq. 2', -25.2832, -57.6353, 310, 1),
(3, 1452, 'Colegio Nacional', 'Avda. Principal 456', -25.2868, -57.3334, 350, 2),
(4, 1453, 'Colegio Nacional', 'Avda. Principal 456', -25.2870, -57.3336, 340, 2),
(5, 1454, 'Escuela Villa Morra', 'Calle Villa 789', -25.2935, -57.5801, 300, 3);

-- Electores
INSERT INTO electores (nombre, ci, telefono, direccion, barrio_id, mesa_id, estado, observaciones, veedor_id) VALUES
('Juan Carlos Benitez', '4523112', '0981222333', 'Calle A 123', 1, 1, 'confirmado', 'Necesita transporte', 2),
('Maria Gomez', '3214555', '0981444555', 'Calle B 456', 2, 3, 'confirmado', '', 2),
('Pedro Martinez', '5123001', '0981666777', 'Calle C 789', 1, 1, 'dudoso', 'No contesta telefono', 2),
('Ana Lopez', '3789123', '0981888999', 'Calle D 012', 3, 5, 'confirmado', '', 2),
('Juan Gimenez', '4987654', '0981000111', 'Calle E 345', 1, 2, 'ausente', 'Viajo al interior', 2),
('Maria Acosta', '4012345', '0981222334', 'Calle F 678', 2, 3, 'ya_voto', '', 2),
('Luis Fernandez', '5234567', '0981444556', 'Calle G 901', 4, 4, 'no_vota', 'Cambio de domicilio', 2),
('Carmen Ruiz', '3890123', '0981666778', 'Calle H 234', 5, 1, 'confirmado', 'Movilidad reducida', 2);

-- Vehiculos
INSERT INTO logistica_vehiculos (tipo, chofer, telefono, placa, combustible, lat, lng, activo) VALUES
('movil', 'Carlos Chofer', '0981111222', 'ABC123', 75.50, -25.2867, -57.3333, 1),
('moto', 'Luis Motociclista', '0981333444', 'XYZ789', 40.00, -25.2829, -57.6350, 1),
('movil', 'Ana Conductora', '0981555666', 'DEF456', 60.00, -25.2934, -57.5800, 1);
